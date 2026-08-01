package com.chyyo.agent.server

import com.chyyo.agent.config.ConsoleConfig
import java.io.File
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger

data class ConsoleLine(val line: String, val timestamp: Long)

/** 콘솔 라인 리스너 (WebSocket 전송용) */
fun interface ConsoleListener {
    fun onLine(line: String, timestamp: Long)
}

/**
 * Minecraft 프로세스의 콘솔 출력을 수집, 버퍼링, 파일 저장, 플레이어 수 추적.
 * RCON을 사용하지 않고 stdout/stderr 직접 스트리밍만 사용한다.
 */
class ConsoleManager(
    private val serverDir: File,
    private val config: ConsoleConfig,
    private val listener: ConsoleListener
) {
    private val buffer = ArrayDeque<ConsoleLine>(config.bufferSize + 16)
    private val lock = Object()

    private val playerNames = LinkedHashSet<String>()
    private val playerLock = Object()

    private var logFile: File? = null
    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    private val playerCount = AtomicInteger(0)
    private val playerSet = ConcurrentLinkedQueue<String>()

    init {
        if (config.logToFile) {
            val logDir = File(serverDir, "logs").apply { mkdirs() }
            logFile = File(logDir, "console-${LocalDateTime.now().format(dateFormatter)}.log")
        }
    }

    /** 새 콘솔 라인 수신 (stdout/stderr에서 호출) */
    fun push(line: String, timestamp: Long = System.currentTimeMillis()) {
        val clean = stripAnsi(line)
        synchronized(lock) {
            buffer.addLast(ConsoleLine(clean, timestamp))
            if (buffer.size > config.bufferSize) buffer.removeFirst()
        }
        logFile?.appendText("[$timestamp] $clean\n")
        trackPlayers(clean)
        listener.onLine(clean, timestamp)
    }

    /** 최근 콘솔 히스토리 반환 */
    fun history(): List<ConsoleLine> = synchronized(lock) { buffer.toList() }

    fun clear() {
        synchronized(lock) { buffer.clear() }
    }

    fun search(query: String): List<ConsoleLine> =
        synchronized(lock) { buffer.filter { it.line.contains(query, ignoreCase = true) } }

    /** 현재 온라인 플레이어 목록 */
    fun players(): List<String> = synchronized(playerLock) { playerNames.toList() }

    fun playerCount(): Int = playerCount.get()

    /** 콘솔 로그를 새 파일로 회전 (자정 기준) */
    fun rotateIfNeeded() {
        val name = "console-${LocalDateTime.now().format(dateFormatter)}.log"
        val current = logFile?.name
        if (config.logToFile && current != name) {
            val logDir = File(serverDir, "logs").apply { mkdirs() }
            logFile = File(logDir, name)
        }
    }

    private fun trackPlayers(line: String) {
        val lower = line.lowercase()

        // "name joined the game"
        if (lower.contains("joined the game")) {
            val name = extractName(line)
            if (name != null) addPlayer(name)
        }
        // "name left the game"
        else if (lower.contains("left the game")) {
            val name = extractName(line)
            if (name != null) removePlayer(name)
        }
        // "There are X of a max of Y players online: ..."
        else if (lower.contains("players online:")) {
            val after = line.substringAfter(":").trim()
            val names = after.split(",").map { it.trim().removePrefix("[").substringBefore("]").trim() }
                .filter { it.isNotEmpty() }
            synchronized(playerLock) {
                playerNames.clear()
                playerNames.addAll(names)
            }
            playerCount.set(names.size)
            playerSet.clear()
            playerSet.addAll(names)
        }
        // 서버 종료 로그에서 플레이어 초기화
        else if (lower.contains("stopping server") || lower.contains("closing")) {
            synchronized(playerLock) { playerNames.clear() }
            playerCount.set(0)
        }
    }

    private fun addPlayer(name: String) {
        synchronized(playerLock) {
            if (playerNames.add(name)) {
                playerCount.set(playerNames.size)
                playerSet.add(name)
            }
        }
    }

    private fun removePlayer(name: String) {
        synchronized(playerLock) {
            playerNames.remove(name)
            playerCount.set(playerNames.size)
        }
    }

    /** "INFO]: Steve joined the game" 형태에서 플레이어 이름 추출 */
    private fun extractName(line: String): String? {
        val name = line.substringBefore(" joined the game").substringBefore(" left the game")
        return name.substringAfterLast("]: ").trim().ifEmpty { null }
    }

    companion object {
        /** ANSI 컬러 코드 제거 */
        fun stripAnsi(text: String): String =
            text.replace(Regex("\u001B\\[[;\\d]*m"), "").replace("\u0000", "")
    }
}
