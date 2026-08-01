package com.chyyo.agent.server

import com.chyyo.agent.backup.BackupManager
import com.chyyo.agent.config.AppConfig
import com.chyyo.agent.file.FileManager
import com.chyyo.agent.monitor.ResourceMonitor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

data class ServerDefinition(
    val id: String,
    val name: String,
    val path: String,
    val jarFile: String,
    val javaArgs: String
)

data class ServerStatus(
    val state: ServerState,
    val pid: Long? = null,
    val uptimeSec: Long = 0,
    val players: Int = 0,
    val playerNames: List<String> = emptyList(),
    val cpuPercent: Double = 0.0,
    val ramMb: Long = 0
)

/** 서버 상태/콘솔 이벤트 -> WebSocket 전송용 콜백 */
class EventBridge(
    val onStatus: (serverId: String, status: ServerStatus) -> Unit = { _, _ -> },
    val onConsole: (serverId: String, line: String, ts: Long) -> Unit = { _, _, _ -> },
    val onBackup: (serverId: String, fileName: String, sizeBytes: Long, status: String) -> Unit = { _, _, _, _ -> }
)

/**
 * 여러 Minecraft 서버 인스턴스를 관리.
 * Panel에서 전달된 서버 정의를 기반으로 ProcessManager/ConsoleManager를 생성/해제한다.
 */
class ServerManager(
    private val config: AppConfig,
    private val monitor: ResourceMonitor,
    private val bridge: EventBridge
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    private val mutex = Mutex()
    private val instances = mutableMapOf<String, ServerInstance>()

    private var statsJob: Job? = null
    private var backupJob: Job? = null

    /** Panel에서 서버 목록 수신 시 호출. 추가/변경/삭제를 반영한다. */
    suspend fun applyServers(definitions: List<ServerDefinition>) = mutex.withLock {
        val incomingIds = definitions.map { it.id }.toSet()

        // 삭제된 서버 정리 (실행 중이면 종료)
        instances.keys.filter { it !in incomingIds }.forEach { id ->
            val inst = instances.remove(id) ?: return@forEach
            inst.shutdown()
        }

        // 추가/업데이트
        for (def in definitions) {
            val existing = instances[def.id]
            if (existing == null) {
                instances[def.id] = ServerInstance(config, def, bridge)
            } else {
                existing.updateDefinition(def)
            }
        }
        startBackgroundJobsIfNeeded()
    }

    suspend fun getServerIds(): List<String> = mutex.withLock { instances.keys.toList() }

    suspend fun start(id: String): Result<Unit> = instance(id)?.start()
        ?: Result.failure(IllegalStateException("서버를 찾을 수 없습니다: $id"))

    suspend fun stop(id: String): Result<Unit> = instance(id)?.stop()
        ?: Result.failure(IllegalStateException("서버를 찾을 수 없습니다: $id"))

    suspend fun restart(id: String): Result<Unit> = instance(id)?.restart()
        ?: Result.failure(IllegalStateException("서버를 찾을 수 없습니다: $id"))

    suspend fun sendCommand(id: String, command: String): Result<Unit> =
        instance(id)?.sendCommand(command)
            ?: Result.failure(IllegalStateException("서버를 찾을 수 없습니다: $id"))

    suspend fun status(id: String): ServerStatus? = instance(id)?.status()

    /** 서버별 FileManager 제공 */
    suspend fun fileManager(id: String): FileManager? =
        mutex.withLock { instances[id]?.serverDir }?.let { FileManager(it) }

    /** 서버별 BackupManager 제공 */
    suspend fun backupManager(id: String): BackupManager? =
        mutex.withLock { instances[id]?.backupManager }

    /** 서버 실행 여부 확인 (백업 복원 안전성 등) */
    suspend fun isRunning(id: String): Boolean = status(id)?.state == ServerState.ONLINE

    suspend fun consoleHistory(id: String, count: Int = 200): List<ConsoleLine> =
        instance(id)?.consoleHistory(count) ?: emptyList()

    suspend fun clearConsole(id: String) {
        instance(id)?.clearConsole()
    }

    fun serverDir(id: String): File? = instances[id]?.serverDir

    /** 등록된 서버를 설정(autoStartServers)에 따라 기동 */
    suspend fun autoStart() {
        mutex.withLock { instances.values.toList() }.filter { it.autoStart }.forEach {
            it.start()
        }
    }

    suspend fun shutdownAll() {
        mutex.withLock { instances.values.toList() }.forEach { it.shutdown() }
    }

    private suspend fun instance(id: String): ServerInstance? = mutex.withLock { instances[id] }

    private fun startBackgroundJobsIfNeeded() {
        if (statsJob == null) {
            statsJob = scope.launch { statsLoop() }
        }
        if (backupJob == null) {
            backupJob = scope.launch { autoBackupLoop() }
        }
    }

    /** 2초마다 각 서버 상태를 Panel로 전송 */
    private suspend fun statsLoop() {
        while (true) {
            delay(2000)
            val snapshot = mutex.withLock { instances.values.toList() }
            for (inst in snapshot) {
                val status = inst.status()
                bridge.onStatus(inst.definition.id, status)
            }
        }
    }

    private suspend fun autoBackupLoop() {
        val intervalMs = config.backup.autoBackupIntervalHours * 60L * 60L * 1000L
        while (true) {
            delay(intervalMs)
            mutex.withLock { instances.values.toList() }.forEach { inst ->
                if (inst.autoStart) inst.backup()
            }
        }
    }
}
