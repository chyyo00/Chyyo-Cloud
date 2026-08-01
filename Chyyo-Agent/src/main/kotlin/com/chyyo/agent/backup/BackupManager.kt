package com.chyyo.agent.backup

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

data class BackupInfo(
    val name: String,
    val sizeBytes: Long,
    val modified: Long
)

/** ZIP 백업 생성/복원/관리 */
class BackupManager(
    private val serverDir: File,
    private val backupDir: File,
    private val compressionLevel: Int,
    private val keepLast: Int,
    private val onDone: (File, Long, String) -> Unit
) {
    init {
        backupDir.mkdirs()
    }

    /** 서버 월드/설정을 ZIP으로 압축. 백업 디렉토리 자체는 제외. */
    suspend fun createBackup(label: String): Result<File> = withContext(Dispatchers.IO) {
        try {
            val name = "${sanitize(label)}-${LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmss"))}.zip"
            val zipFile = File(backupDir, name)
            ZipOutputStream(zipFile.outputStream().buffered()).use { zos ->
                zos.setLevel(compressionLevel)
                serverDir.walkTopDown().forEach { file ->
                    val rel = serverDir.toPath().relativize(file.toPath()).toString()
                    if (rel.isBlank()) return@forEach
                    // 백업/로그 디렉토리는 제외
                    if (file == backupDir) return@forEach
                    if (rel.startsWith("Backup${File.separator}")) return@forEach
                    if (rel.startsWith("logs${File.separator}")) return@forEach
                    if (file.isDirectory) {
                        zos.putNextEntry(ZipEntry("$rel/"))
                        zos.closeEntry()
                    } else {
                        zos.putNextEntry(ZipEntry(rel.replace(File.separatorChar, '/')))
                        file.inputStream().use { it.copyTo(zos) }
                        zos.closeEntry()
                    }
                }
            }
            pruneOldBackups()
            onDone(zipFile, zipFile.length(), "created")
            Result.success(zipFile)
        } catch (e: Exception) {
            onDone(File(backupDir, "error"), 0, "failed: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun listBackups(): List<BackupInfo> = withContext(Dispatchers.IO) {
        backupDir.listFiles()
            ?.filter { it.extension.equals("zip", true) }
            ?.map { BackupInfo(it.name, it.length(), it.lastModified()) }
            ?.sortedByDescending { it.modified }
            ?: emptyList()
    }

    /** 백업을 서버 디렉토리에 압축 해제 (복원). 서버는 반드시 중지된 상태여야 한다. */
    suspend fun restore(backupName: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val zip = resolveBackup(backupName) ?: return@withContext Result.failure(IllegalStateException("백업을 찾을 수 없습니다"))
            ZipInputStream(zip.inputStream().buffered()).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    val target = resolveSafeTarget(entry.name)
                    if (target != null) {
                        if (entry.isDirectory) {
                            target.mkdirs()
                        } else {
                            target.parentFile?.mkdirs()
                            target.outputStream().use { zis.copyTo(it) }
                        }
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
            onDone(zip, zip.length(), "restored")
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteBackup(backupName: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val zip = resolveBackup(backupName)
                ?: return@withContext Result.failure(IllegalStateException("백업을 찾을 수 없습니다"))
            if (zip.delete()) Result.success(Unit)
            else Result.failure(IllegalStateException("백업 삭제 실패"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun backupFile(backupName: String): File? = withContext(Dispatchers.IO) {
        resolveBackup(backupName)
    }

    private fun resolveBackup(name: String): File? {
        val file = File(backupDir, name)
        if (file.absolutePath.startsWith(backupDir.absolutePath) && file.extension.equals("zip", true)) {
            return file.takeIf { it.exists() }
        }
        return null
    }

    /** ZIP 경로 트래버셜 방지: backupDir 밖으로 나가는 엔트리는 무시 */
    private fun resolveSafeTarget(entryName: String): File? {
        val cleaned = entryName.removePrefix("/")
        if (cleaned.contains("..")) return null
        return File(serverDir, cleaned)
    }

    private fun pruneOldBackups() {
        if (keepLast <= 0) return
        val all = backupDir.listFiles()?.filter { it.extension.equals("zip", true) }
            ?.sortedByDescending { it.lastModified() } ?: return
        all.drop(keepLast).forEach { it.delete() }
    }

    private fun sanitize(label: String): String =
        label.replace(Regex("[^A-Za-z0-9\\-_]"), "").ifEmpty { "backup" }
}
