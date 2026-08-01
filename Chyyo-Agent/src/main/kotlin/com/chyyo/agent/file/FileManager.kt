package com.chyyo.agent.file

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.Base64

data class FileEntry(
    val name: String,
    val path: String,
    val isDirectory: Boolean,
    val size: Long,
    val modified: Long
)

/** 서버 루트 내에서만 동작하는 파일 관리자. 경로 트래버셜 방지 포함. */
class FileManager(private val serverRoot: File) {

    private fun resolve(path: String): File? {
        val base = serverRoot.canonicalFile
        val target = File(base, path.trimStart('/')).canonicalFile
        return target.takeIf { it.absolutePath.startsWith(base.absolutePath) }
    }

    suspend fun list(path: String): Result<List<FileEntry>> = withContext(Dispatchers.IO) {
        try {
            val dir = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            if (!dir.exists()) return@withContext Result.failure(IllegalStateException("경로가 존재하지 않습니다: $path"))
            if (!dir.isDirectory) return@withContext Result.failure(IllegalStateException("디렉토리가 아닙니다: $path"))

            val entries = dir.listFiles()
                ?.map { file ->
                    FileEntry(
                        name = file.name,
                        path = serverRoot.toPath().relativize(file.toPath()).toString().replace('\\', '/'),
                        isDirectory = file.isDirectory,
                        size = if (file.isFile) file.length() else 0,
                        modified = file.lastModified()
                    )
                }
                ?.sortedWith(compareBy<FileEntry> { !it.isDirectory }.thenBy { it.name.lowercase() })
                ?: emptyList()
            Result.success(entries)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** 텍스트 파일 읽기 (2MB 이하) */
    suspend fun read(path: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val file = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            if (!file.isFile) return@withContext Result.failure(IllegalStateException("파일이 아닙니다: $path"))
            if (file.length() > 2 * 1024 * 1024) {
                return@withContext Result.failure(IllegalStateException("2MB를 초과하는 파일은 편집할 수 없습니다"))
            }
            Result.success(file.readText(StandardCharsets.UTF_8))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun write(path: String, content: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val file = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            file.writeText(content, StandardCharsets.UTF_8)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun delete(path: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val file = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            if (!file.exists()) return@withContext Result.failure(IllegalStateException("경로가 존재하지 않습니다"))
            if (file.isDirectory) {
                file.deleteRecursively()
            } else {
                file.delete()
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun rename(path: String, newName: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val file = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            val target = File(file.parentFile, newName)
            if (file.renameTo(target)) Result.success(Unit)
            else Result.failure(IllegalStateException("이름 변경 실패"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun mkdir(path: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val dir = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            if (dir.mkdirs()) Result.success(Unit)
            else Result.failure(IllegalStateException("디렉토리 생성 실패"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** base64 데이터로 파일 업로드 */
    suspend fun upload(path: String, fileName: String, dataBase64: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val dir = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            if (!dir.isDirectory) return@withContext Result.failure(IllegalStateException("디렉토리가 아닙니다: $path"))
            val safeName = fileName.replace(Regex("[/\\\\]"), "_")
            val target = File(dir, safeName)
            val bytes = Base64.getDecoder().decode(dataBase64)
            target.writeBytes(bytes)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** 파일을 base64로 반환 (다운로드용). 100MB 제한. */
    suspend fun download(path: String): Result<Pair<String, ByteArray>> = withContext(Dispatchers.IO) {
        try {
            val file = resolve(path) ?: return@withContext Result.failure(IllegalStateException("잘못된 경로입니다"))
            if (!file.isFile) return@withContext Result.failure(IllegalStateException("파일이 아닙니다: $path"))
            if (file.length() > 100L * 1024 * 1024) {
                return@withContext Result.failure(IllegalStateException("100MB를 초과하는 파일은 다운로드할 수 없습니다"))
            }
            Result.success(Pair(file.name, file.readBytes()))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** 업로드 가능한 jar 파일 목록 (plugins/mods 폴더 내) */
    suspend fun jarFiles(path: String): Result<List<FileEntry>> = list(path)
}
