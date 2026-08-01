package com.chyyo.agent.monitor

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import oshi.SystemInfo
import oshi.software.os.OSProcess
import java.io.File
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.roundToLong

data class Snapshot(
    val cpuPercent: Double,
    val ramUsedMb: Long,
    val ramTotalMb: Long,
    val diskUsedMb: Long,
    val diskTotalMb: Long,
    val netUpKbps: Double,
    val netDownKbps: Double,
    val timestamp: Long
)

data class ProcessStats(
    val pid: Long,
    val cpuPercent: Double,
    val ramMb: Long,
    val threads: Int
)

/**
 * 시스템 리소스 모니터.
 * OSHI 라이브러리를 사용해 Windows/macOS/Linux 모두에서 동작한다.
 */
class ResourceMonitor(private val rootDir: String) {

    private val si = SystemInfo()
    private val hal = si.hardware
    private val processor = hal.processor

    private val mutex = Mutex()
    private val lastNetBytesUp = AtomicLong(0)
    private val lastNetBytesDown = AtomicLong(0)
    private val lastNetTime = AtomicLong(0)

    @Volatile
    private var prevCpuTicks: LongArray? = null

    /** 시스템 전체 리소스 스냅샷 */
    suspend fun snapshot(): Snapshot = mutex.withLock {
        withContext(Dispatchers.IO) {
            // CPU (이전 틱과 비교해 사용률 % 계산)
            val ticks = processor.systemCpuLoadTicks
            val prev = prevCpuTicks
            val cpu = if (prev != null) {
                processor.getSystemCpuLoadBetweenTicks(prev).coerceIn(0.0, 1.0) * 100.0
            } else 0.0
            prevCpuTicks = ticks

            // 메모리
            val mem = hal.memory
            val ramTotal = mem.total / (1024 * 1024)
            val ramUsed = (mem.total - mem.available) / (1024 * 1024)

            // 디스크 (JVM API — 루트 폴더가 위치한 볼륨 기준)
            val root = File(rootDir)
            val diskTotal = root.totalSpace / (1024 * 1024)
            val diskUsed = (root.totalSpace - root.usableSpace) / (1024 * 1024)

            // 네트워크
            val nets = hal.networkIFs.filter { it.bytesRecv > 0 || it.bytesSent > 0 }
            val up = nets.sumOf { it.bytesSent }
            val down = nets.sumOf { it.bytesRecv }
            val now = System.currentTimeMillis()
            val lastTime = lastNetTime.getAndSet(now)
            val dtSec = if (lastTime > 0) (now - lastTime) / 1000.0 else 0.0
            val upKbps = if (dtSec > 0) (up - lastNetBytesUp.getAndSet(up)) * 8.0 / 1000.0 / dtSec else 0.0
            val downKbps = if (dtSec > 0) (down - lastNetBytesDown.getAndSet(down)) * 8.0 / 1000.0 / dtSec else 0.0

            Snapshot(
                cpuPercent = cpu.roundToLong().toDouble(),
                ramUsedMb = ramUsed,
                ramTotalMb = ramTotal,
                diskUsedMb = diskUsed,
                diskTotalMb = diskTotal,
                netUpKbps = upKbps,
                netDownKbps = downKbps,
                timestamp = now
            )
        }
    }

    /** 특정 PID(Java 프로세스)의 통계 */
    suspend fun processStats(pid: Long): ProcessStats? = withContext(Dispatchers.IO) {
        val os = si.operatingSystem
        val p = os.getProcess(pid.toInt()) ?: return@withContext null
        ProcessStats(
            pid = pid,
            cpuPercent = p.processCpuLoadCumulative.coerceIn(0.0, 1.0) * 100.0,
            ramMb = p.residentSetSize / (1024 * 1024),
            threads = p.threadCount
        )
    }

    /** 실행 중인 Java 프로세스 PID 목록 (oshi) */
    suspend fun javaProcesses(): List<OSProcess> = withContext(Dispatchers.IO) {
        si.operatingSystem.getProcesses()
            .filter { it.name.lowercase().contains("java") }
    }
}
