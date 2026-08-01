package com.chyyo.agent.server

import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.io.PrintWriter
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

enum class ServerState { OFFLINE, STARTING, ONLINE, STOPPING, CRASHED }

/** 프로세스 상태 변경 리스너 */
fun interface StateListener {
    fun onStateChange(state: ServerState, pid: Long?, reason: String?)
}

/**
 * Minecraft Java 프로세스 직접 관리.
 * ProcessBuilder + stdin/stdout/stderr 를 사용한다. (RCON 미사용)
 */
class ProcessManager(private val stateListener: StateListener) {

    private var process: Process? = null
    private var consoleManager: ConsoleManager? = null
    private var startTime: Long = 0
    private var lastState: ServerState = ServerState.OFFLINE

    private val stopping = AtomicBoolean(false)

    @Volatile
    var runningCommand: String = ""
        private set

    val state: ServerState get() = lastState

    fun isRunning(): Boolean = process?.isAlive == true

    fun pid(): Long? = process?.takeIf { it.isAlive }?.pid()

    fun uptimeSeconds(): Long =
        if (isRunning()) (System.currentTimeMillis() - startTime) / 1000 else 0

    /**
     * 서버 프로세스 시작.
     * @param serverDir 서버 루트 디렉토리 (C:/Minecraft/Survival)
     * @param jarFile server.jar
     * @param javaArgs -Xms / -Xmx 등 JVM 옵션 문자열
     * @param javaExecutable java 경로 (기본 "java")
     */
    fun start(
        serverDir: File,
        jarFile: String,
        javaArgs: String,
        javaExecutable: String = "java",
        console: ConsoleManager
    ): Result<Unit> {
        synchronized(this) {
            if (isRunning()) return Result.failure(IllegalStateException("서버가 이미 실행 중입니다"))

            val jar = File(serverDir, jarFile)
            if (!jar.exists()) {
                return Result.failure(IllegalStateException("서버 jar 파일을 찾을 수 없습니다: ${jar.absolutePath}"))
            }

            val args = tokenize(javaArgs) + listOf("-jar", jar.name, "nogui")
            val builder = ProcessBuilder(listOf(javaExecutable) + args)
            builder.directory(serverDir)
            builder.redirectErrorStream(false)
            builder.environment()["JAVA_TOOL_OPTIONS"] = builder.environment()["JAVA_TOOL_OPTIONS"] ?: ""

            runningCommand = (listOf(javaExecutable) + args).joinToString(" ")
            consoleManager = console

            try {
                val p = builder.start()
                process = p
                startTime = System.currentTimeMillis()
                stopping.set(false)
                setState(ServerState.STARTING, p.pid())

                // stdout / stderr -> ConsoleManager
                pump(p, p.inputStream, console, "stdout")
                pump(p, p.errorStream, console, "stderr")

                // 프로세스 종료 감지
                thread(name = "proc-monitor") {
                    p.waitFor()
                    if (!stopping.get()) {
                        setState(ServerState.CRASHED, p.pid(), "프로세스가 비정상 종료되었습니다 (exit=${p.exitValue()})")
                    } else {
                        setState(ServerState.OFFLINE, null)
                    }
                }
                return Result.success(Unit)
            } catch (e: Exception) {
                setState(ServerState.OFFLINE, null, e.message)
                return Result.failure(e)
            }
        }
    }

    /** stdin으로 명령 전달 */
    fun sendCommand(command: String): Boolean {
        val p = process ?: return false
        if (!p.isAlive) return false
        return try {
            val writer = PrintWriter(
                OutputStreamWriter(p.outputStream, StandardCharsets.UTF_8),
                true
            )
            writer.println(command)
            writer.flush()
            true
        } catch (e: Exception) {
            false
        }
    }

    /** "stop" 명령으로 우아하게 종료 후, timeout 이후 강제 종료 */
    fun stop(gracefulTimeoutMs: Long = 30_000): Result<Unit> {
        synchronized(this) {
            val p = process ?: return Result.success(Unit)
            if (!p.isAlive) {
                setState(ServerState.OFFLINE, null)
                return Result.success(Unit)
            }
            stopping.set(true)
            setState(ServerState.STOPPING, p.pid())
            sendCommand("stop")
            val deadline = System.currentTimeMillis() + gracefulTimeoutMs
            while (p.isAlive && System.currentTimeMillis() < deadline) {
                Thread.sleep(200)
            }
            if (p.isAlive) {
                p.destroyForcibly()
                p.waitFor(10, java.util.concurrent.TimeUnit.SECONDS)
            }
            setState(ServerState.OFFLINE, null)
            return Result.success(Unit)
        }
    }

    /** 즉시 강제 종료 */
    fun kill() {
        val p = process ?: return
        stopping.set(true)
        p.destroyForcibly()
        setState(ServerState.OFFLINE, null)
    }

    /** 새 프로세스에서 재시작 */
    fun restart(
        serverDir: File,
        jarFile: String,
        javaArgs: String,
        javaExecutable: String = "java",
        console: ConsoleManager
    ): Result<Unit> {
        stop().onFailure { return Result.failure(it) }
        return start(serverDir, jarFile, javaArgs, javaExecutable, console)
    }

    private fun setState(s: ServerState, pid: Long?, reason: String? = null) {
        lastState = s
        stateListener.onStateChange(s, pid, reason)
    }

    private fun pump(p: Process, stream: java.io.InputStream, console: ConsoleManager, tag: String) {
        thread(name = "console-$tag") {
            try {
                BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { reader ->
                    while (true) {
                        val line = reader.readLine() ?: break
                        if (line.isNotBlank()) console.push(line)
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    companion object {
        /** " -Xmx8G -XX:+UseG1GC " 같은 문자열을 인자로 분리 (따옴표 지원) */
        fun tokenize(input: String): List<String> {
            val result = mutableListOf<String>()
            val current = StringBuilder()
            var inQuote = false
            for (c in input) {
                when {
                    c == '"' -> inQuote = !inQuote
                    c.isWhitespace() && !inQuote -> {
                        if (current.isNotEmpty()) {
                            result.add(current.toString())
                            current.clear()
                        }
                    }
                    else -> current.append(c)
                }
            }
            if (current.isNotEmpty()) result.add(current.toString())
            return result
        }
    }
}
