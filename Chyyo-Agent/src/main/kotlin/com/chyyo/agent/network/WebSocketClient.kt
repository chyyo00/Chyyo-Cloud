package com.chyyo.agent.network

import com.chyyo.agent.config.AppConfig
import com.chyyo.agent.model.Protocol
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

/** Panel로부터 온 RPC 요청을 처리하는 핸들러 */
fun interface RpcHandler {
    fun handle(type: String, payload: JSONObject): JSONObject
}

/**
 * Chyyo-Web Panel과의 Socket.IO 연결 관리.
 * - 인증(hello) 후 이벤트 송수신
 * - RPC 요청 수신 및 응답
 * - 서버 상태/콘솔/백업 이벤트 전송
 * - 자동 재연결 (socket.io 내장)
 */
class WebSocketClient(
    private val config: AppConfig,
    private val rpcHandler: RpcHandler,
    private val onAuthenticated: () -> Unit = {}
) {
    private var socket: Socket? = null
    private var authenticated = false

    fun connect() {
        val baseUrl = config.panel.baseUrl.trimEnd('/')
        val nsUrl = "$baseUrl/agent"

        val options = IO.Options().apply {
            transports = arrayOf("websocket")
            reconnection = true
            reconnectionAttempts = Int.MAX_VALUE
            reconnectionDelay = config.panel.reconnectDelayMs
            forceNew = true
            secure = baseUrl.startsWith("https://")
        }

        val s = IO.socket(nsUrl, options)
        socket = s

        s.on(Socket.EVENT_CONNECT) {
            println("[Chyyo-Agent] WebSocket 연결됨 → $nsUrl")
            sendHello()
        }
        s.on(Socket.EVENT_CONNECT_ERROR) { args ->
            println("[Chyyo-Agent] 연결 오류: ${args.firstOrNull()}")
        }
        s.on(Socket.EVENT_DISCONNECT) {
            authenticated = false
            println("[Chyyo-Agent] WebSocket 연결 종료")
        }
        s.on(Protocol.RPC) { args ->
            handleRpc(args)
        }
        s.connect()
    }

    private fun sendHello() {
        val hello = JSONObject()
            .put("token", config.panel.agentToken)
            .put("name", config.agent.name)
            .put("version", "1.0.0")
            .put("platform", "Windows")
        // emit(String event, Object[] args, Ack ack) 오버로드 명시
        socket?.emit(Protocol.HELLO, arrayOf<Any>(hello), Ack { args ->
            val response = args.firstOrNull() as? JSONObject
            val ok = response?.optBoolean("ok", false) ?: false
            authenticated = ok
            if (ok) {
                println("[Chyyo-Agent] 인증 성공 (agentId=${response.optString("agentId")})")
                onAuthenticated()
            } else {
                println("[Chyyo-Agent] 인증 실패: ${response?.optString("error")}")
            }
        })
    }

    private fun handleRpc(args: Array<out Any?>) {
        if (args.isEmpty()) return
        val payload = args[0] as? JSONObject ?: return
        val ack = args.getOrNull(1) as? Ack ?: return
        val type = payload.optString("type")
        val body = payload.optJSONObject("payload") ?: JSONObject()

        val result = try {
            rpcHandler.handle(type, body)
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "내부 오류")
        }
        ack.call(result)
    }

    // ---- Panel로 이벤트 전송 ----

    fun emitServerStatus(serverId: String, status: JSONObject) {
        val payload = status.put("serverId", serverId)
        socket?.emit(Protocol.SERVER_STATUS, payload)
    }

    fun emitAgentStats(stats: Map<String, Any?>) {
        socket?.emit(Protocol.AGENT_STATS, JSONObject(stats))
    }

    fun emitConsole(serverId: String, line: String, ts: Long) {
        socket?.emit(Protocol.CONSOLE_LOG, JSONObject()
            .put("serverId", serverId)
            .put("line", line)
            .put("ts", ts))
    }

    fun emitBackupDone(serverId: String, fileName: String, sizeBytes: Long, status: String) {
        socket?.emit(Protocol.BACKUP_DONE, JSONObject()
            .put("serverId", serverId)
            .put("fileName", fileName)
            .put("sizeBytes", sizeBytes)
            .put("status", status))
    }

    fun isAuthenticated(): Boolean = authenticated

    fun disconnect() {
        socket?.disconnect()
    }
}
