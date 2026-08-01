package com.chyyo.agent

import com.chyyo.agent.config.AppConfig
import com.chyyo.agent.monitor.ResourceMonitor
import com.chyyo.agent.network.ApiClient
import com.chyyo.agent.network.RpcRouter
import com.chyyo.agent.network.WebSocketClient
import com.chyyo.agent.security.TokenManager
import com.chyyo.agent.server.EventBridge
import com.chyyo.agent.server.ServerManager
import com.chyyo.agent.server.ServerStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject

@Volatile
private var ws: WebSocketClient? = null

/**
 * Chyyo-Agent 엔트리 포인트.
 * 1. 설정 로드
 * 2. 서버 매니저 / 모니터 / 보안 초기화
 * 3. Panel WebSocket 연결
 * 4. 서버 목록 수신 및 서버 관리 시작
 */
fun main(args: Array<String>) {
    println("""
        ============================================
          Chyyo-Agent v1.0.0
          Windows Server Minecraft Management Agent
        ============================================
    """.trimIndent())

    val config = AppConfig.load()
    val tokenManager = TokenManager(config)
    val monitor = ResourceMonitor(config.agent.serverRoot)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // 서버/콘솔/백업 이벤트 -> WebSocket 전송 브리지
    val bridge = EventBridge(
        onStatus = { id, status -> ws?.emitServerStatus(id, statusToJson(status)) },
        onConsole = { id, line, ts -> ws?.emitConsole(id, line, ts) },
        onBackup = { id, file, size, status -> ws?.emitBackupDone(id, file, size, status) }
    )

    val serverManager = ServerManager(config, monitor, bridge)
    val router = RpcRouter(serverManager, monitor, tokenManager)

    // WebSocket 연결 및 인증 완료 후 서버 목록 로드
    ws = WebSocketClient(config, router, onAuthenticated = {
        scope.launch { loadServers(config, serverManager) }
    })
    ws?.connect()

    // 시스템 리소스 3초마다 전송
    scope.launch {
        while (true) {
            delay(3000)
            val current = ws
            if (current?.isAuthenticated() == true) {
                val snap = monitor.snapshot()
                current.emitAgentStats(mapOf(
                    "cpuPercent" to snap.cpuPercent,
                    "ramUsedMb" to snap.ramUsedMb,
                    "ramTotalMb" to snap.ramTotalMb,
                    "diskUsedMb" to snap.diskUsedMb,
                    "diskTotalMb" to snap.diskTotalMb,
                    "netUpKbps" to snap.netUpKbps,
                    "netDownKbps" to snap.netDownKbps,
                    "ts" to snap.timestamp
                ))
            }
        }
    }

    Runtime.getRuntime().addShutdownHook(Thread {
        runBlocking { serverManager.shutdownAll() }
        ws?.disconnect()
    })

    println("[Chyyo-Agent] Panel: ${config.panel.baseUrl}")
    Thread.currentThread().join()
}

/** Panel REST API에서 할당된 서버 목록을 조회해 로컬 서버 인스턴스 구성 */
private suspend fun loadServers(config: AppConfig, serverManager: ServerManager) {
    val api = ApiClient(config.panel.baseUrl, config.panel.agentToken)
    api.getAssignedServers()
        .onSuccess { servers ->
            println("[Chyyo-Agent] 서버 ${servers.size}개 수신: ${servers.joinToString { it.name }}")
            serverManager.applyServers(servers)
            if (config.agent.autoStartServers) serverManager.autoStart()
        }
        .onFailure {
            println("[Chyyo-Agent] 서버 목록 조회 실패: ${it.message}")
        }
    api.close()
}

private fun statusToJson(status: ServerStatus): JSONObject = JSONObject()
    .put("state", status.state.name)
    .put("pid", status.pid ?: JSONObject.NULL)
    .put("uptimeSec", status.uptimeSec)
    .put("players", status.players)
    .put("playerNames", JSONArray(status.playerNames))
    .put("cpuPercent", status.cpuPercent)
    .put("ramMb", status.ramMb)
