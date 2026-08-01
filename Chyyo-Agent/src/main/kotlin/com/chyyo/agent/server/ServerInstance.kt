package com.chyyo.agent.server

import com.chyyo.agent.backup.BackupManager
import com.chyyo.agent.config.AppConfig
import com.chyyo.agent.monitor.ResourceMonitor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * 단일 Minecraft 서버 인스턴스.
 * ProcessManager(프로세스) + ConsoleManager(콘솔) + BackupManager(백업)을 묶는다.
 */
class ServerInstance(
    private val config: AppConfig,
    initial: ServerDefinition,
    bridge: EventBridge
) {
    @Volatile
    var definition: ServerDefinition = initial

    val serverDir: File = File(initial.path)
    val backupManager: BackupManager

    private val consoleManager: ConsoleManager
    private val processManager: ProcessManager
    private val monitor: ResourceMonitor

    val autoStart: Boolean get() = config.agent.autoStartServers

    init {
        serverDir.mkdirs()

        val console = ConsoleManager(
            serverDir = serverDir,
            config = config.console,
            listener = ConsoleListener { line, ts ->
                bridge.onConsole(initial.id, line, ts)
            }
        )
        consoleManager = console

        processManager = ProcessManager(
            stateListener = StateListener { state, pid, reason ->
                bridge.onStatus(
                    initial.id,
                    ServerStatus(
                        state = state,
                        pid = pid,
                        uptimeSec = processManager.uptimeSeconds(),
                        players = console.playerCount()
                    )
                )
            }
        )

        backupManager = BackupManager(
            serverDir = serverDir,
            backupDir = File(serverDir, "Backup"),
            compressionLevel = config.backup.compressionLevel,
            keepLast = config.backup.keepLast,
            onDone = { file, size, status ->
                bridge.onBackup(initial.id, file.name, size, status)
            }
        )
        monitor = ResourceMonitor(serverDir.absolutePath)
    }

    fun updateDefinition(def: ServerDefinition) {
        definition = def
    }

    suspend fun start(): Result<Unit> = withContext(Dispatchers.IO) {
        processManager.start(
            serverDir = serverDir,
            jarFile = definition.jarFile,
            javaArgs = definition.javaArgs,
            console = consoleManager
        )
    }

    suspend fun stop(): Result<Unit> = withContext(Dispatchers.IO) {
        processManager.stop()
    }

    suspend fun restart(): Result<Unit> = withContext(Dispatchers.IO) {
        processManager.restart(
            serverDir = serverDir,
            jarFile = definition.jarFile,
            javaArgs = definition.javaArgs,
            console = consoleManager
        )
    }

    suspend fun sendCommand(command: String): Result<Unit> = withContext(Dispatchers.IO) {
        val ok = processManager.sendCommand(command)
        if (ok) Result.success(Unit)
        else Result.failure(IllegalStateException("프로세스가 실행 중이 아닙니다"))
    }

    suspend fun status(): ServerStatus {
        val proc = processManager
        val pid = proc.pid()
        val stats = pid?.let { monitor.processStats(it) }
        return ServerStatus(
            state = proc.state,
            pid = pid,
            uptimeSec = proc.uptimeSeconds(),
            players = consoleManager.playerCount(),
            playerNames = consoleManager.players(),
            cpuPercent = stats?.cpuPercent ?: 0.0,
            ramMb = stats?.ramMb ?: 0
        )
    }

    suspend fun consoleHistory(count: Int): List<ConsoleLine> =
        withContext(Dispatchers.IO) {
            val all = consoleManager.history()
            if (count > 0 && all.size > count) all.subList(all.size - count, all.size) else all
        }

    fun clearConsole() {
        consoleManager.clear()
    }

    suspend fun shutdown() {
        withContext(Dispatchers.IO) { processManager.stop() }
    }

    suspend fun backup(): Result<File> = backupManager.createBackup(definition.name)
}
