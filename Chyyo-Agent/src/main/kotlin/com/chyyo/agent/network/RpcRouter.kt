package com.chyyo.agent.network

import com.chyyo.agent.model.Protocol
import com.chyyo.agent.monitor.ResourceMonitor
import com.chyyo.agent.security.TokenManager
import com.chyyo.agent.server.ServerDefinition
import com.chyyo.agent.server.ServerManager
import com.chyyo.agent.server.ServerStatus
import com.chyyo.agent.server.ServerState
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.util.Base64

/**
 * Panel로부터 수신된 RPC 요청을 실제 작업에 라우팅.
 * 서버 제어, 콘솔, 파일, 백업 기능을 전담한다.
 */
class RpcRouter(
    private val serverManager: ServerManager,
    private val monitor: ResourceMonitor,
    private val tokenManager: TokenManager
) : RpcHandler {

    override fun handle(type: String, payload: JSONObject): JSONObject = runBlocking {
        try {
            when (type) {
                Protocol.RPC_APPLY_SERVERS -> applyServers(payload)
                Protocol.RPC_SERVER_START -> serverStart(payload)
                Protocol.RPC_SERVER_STOP -> serverStop(payload)
                Protocol.RPC_SERVER_RESTART -> serverRestart(payload)
                Protocol.RPC_SERVER_STATUS -> serverStatus(payload)
                Protocol.RPC_CONSOLE_INPUT -> consoleInput(payload)
                Protocol.RPC_CONSOLE_HISTORY -> consoleHistory(payload)
                Protocol.RPC_CONSOLE_CLEAR -> consoleClear(payload)
                Protocol.RPC_FILE_LIST -> fileList(payload)
                Protocol.RPC_FILE_READ -> fileRead(payload)
                Protocol.RPC_FILE_WRITE -> fileWrite(payload)
                Protocol.RPC_FILE_DELETE -> fileDelete(payload)
                Protocol.RPC_FILE_RENAME -> fileRename(payload)
                Protocol.RPC_FILE_MKDIR -> fileMkdir(payload)
                Protocol.RPC_FILE_UPLOAD -> fileUpload(payload)
                Protocol.RPC_FILE_DOWNLOAD -> fileDownload(payload)
                Protocol.RPC_BACKUP_CREATE -> backupCreate(payload)
                Protocol.RPC_BACKUP_LIST -> backupList(payload)
                Protocol.RPC_BACKUP_RESTORE -> backupRestore(payload)
                Protocol.RPC_BACKUP_DELETE -> backupDelete(payload)
                Protocol.RPC_BACKUP_DOWNLOAD -> backupDownload(payload)
                else -> JSONObject().put("ok", false).put("error", "알 수 없는 RPC 타입: $type")
            }
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "내부 오류")
        }
    }

    // ---- 서버 제어 ----

    private suspend fun applyServers(payload: JSONObject): JSONObject {
        val serversJson = payload.optJSONArray("servers") ?: JSONArray()
        val definitions = mutableListOf<ServerDefinition>()
        for (i in 0 until serversJson.length()) {
            val o = serversJson.getJSONObject(i)
            definitions += ServerDefinition(
                id = o.getString("id"),
                name = o.optString("name", "server"),
                path = o.getString("path"),
                jarFile = o.optString("jarFile", "server.jar"),
                javaArgs = o.optString("javaArgs", "")
            )
        }
        serverManager.applyServers(definitions)
        return ok()
    }

    private suspend fun serverStart(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        return result(serverManager.start(id))
    }

    private suspend fun serverStop(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        return result(serverManager.stop(id))
    }

    private suspend fun serverRestart(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        return result(serverManager.restart(id))
    }

    private suspend fun serverStatus(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        val status = serverManager.status(id)
            ?: return JSONObject().put("ok", false).put("error", "서버를 찾을 수 없습니다")
        return ok(statusToJson(status))
    }

    private suspend fun consoleInput(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        val command = payload.optString("command")
        if (command.isBlank()) return JSONObject().put("ok", false).put("error", "명령어가 비어 있습니다")
        if (tokenManager.isDangerousCommand(command)) {
            return JSONObject().put("ok", false).put("error", "보안상 차단된 명령어입니다")
        }
        return result(serverManager.sendCommand(id, command))
    }

    private suspend fun consoleHistory(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        val count = payload.optInt("count", 200)
        val lines = serverManager.consoleHistory(id, count)
        val arr = JSONArray()
        lines.forEach { line ->
            arr.put(JSONObject().put("line", line.line).put("ts", line.timestamp))
        }
        return ok(JSONObject().put("lines", arr))
    }

    private suspend fun consoleClear(payload: JSONObject): JSONObject {
        serverManager.clearConsole(payload.optString("serverId"))
        return ok()
    }

    // ---- 파일 관리 ----

    private suspend fun fileList(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId"))
            ?: return error("서버를 찾을 수 없습니다")
        val path = payload.optString("path", "/")
        val result = fm.list(path)
        return result.fold(
            onSuccess = { entries ->
                val arr = JSONArray()
                entries.forEach { e ->
                    arr.put(JSONObject()
                        .put("name", e.name)
                        .put("path", e.path)
                        .put("isDirectory", e.isDirectory)
                        .put("size", e.size)
                        .put("modified", e.modified))
                }
                ok(JSONObject().put("entries", arr))
            },
            onFailure = { error(it.message ?: "오류") }
        )
    }

    private suspend fun fileRead(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return fm.read(payload.optString("path")).fold(
            onSuccess = { ok(JSONObject().put("content", it)) },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun fileWrite(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return fm.write(payload.optString("path"), payload.optString("content")).fold(
            onSuccess = { ok() },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun fileDelete(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return fm.delete(payload.optString("path")).fold(
            onSuccess = { ok() },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun fileRename(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return fm.rename(payload.optString("path"), payload.optString("newName")).fold(
            onSuccess = { ok() },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun fileMkdir(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return fm.mkdir(payload.optString("path")).fold(
            onSuccess = { ok() },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun fileUpload(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return fm.upload(
            payload.optString("path"),
            payload.optString("fileName"),
            payload.optString("data")
        ).fold(
            onSuccess = { ok() },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun fileDownload(payload: JSONObject): JSONObject {
        val fm = serverManager.fileManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return fm.download(payload.optString("path")).fold(
            onSuccess = { (name, bytes) ->
                ok(JSONObject()
                    .put("name", name)
                    .put("data", Base64.getEncoder().encodeToString(bytes)))
            },
            onFailure = { error(it.message) }
        )
    }

    // ---- 백업 관리 ----

    private suspend fun backupCreate(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        val bm = serverManager.backupManager(id) ?: return error("서버를 찾을 수 없습니다")
        return bm.createBackup(payload.optString("name", "backup")).fold(
            onSuccess = { file -> ok(JSONObject().put("fileName", file.name).put("sizeBytes", file.length())) },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun backupList(payload: JSONObject): JSONObject {
        val bm = serverManager.backupManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        val backups = bm.listBackups()
        val arr = JSONArray()
        backups.forEach { b ->
            arr.put(JSONObject()
                .put("name", b.name)
                .put("sizeBytes", b.sizeBytes)
                .put("modified", b.modified))
        }
        return ok(JSONObject().put("backups", arr))
    }

    private suspend fun backupRestore(payload: JSONObject): JSONObject {
        val id = payload.optString("serverId")
        if (serverManager.isRunning(id)) {
            return error("서버가 실행 중일 때는 복원할 수 없습니다. 서버를 먼저 종료하세요.")
        }
        val bm = serverManager.backupManager(id) ?: return error("서버를 찾을 수 없습니다")
        return bm.restore(payload.optString("name")).fold(
            onSuccess = { ok() },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun backupDelete(payload: JSONObject): JSONObject {
        val bm = serverManager.backupManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        return bm.deleteBackup(payload.optString("name")).fold(
            onSuccess = { ok() },
            onFailure = { error(it.message) }
        )
    }

    private suspend fun backupDownload(payload: JSONObject): JSONObject {
        val bm = serverManager.backupManager(payload.optString("serverId")) ?: return error("서버를 찾을 수 없습니다")
        val file = bm.backupFile(payload.optString("name")) ?: return error("백업을 찾을 수 없습니다")
        return ok(JSONObject()
            .put("name", file.name)
            .put("data", Base64.getEncoder().encodeToString(file.readBytes())))
    }

    // ---- 응답 헬퍼 ----

    private fun ok(data: JSONObject? = null): JSONObject {
        val res = JSONObject().put("ok", true)
        if (data != null) res.put("data", data)
        return res
    }

    private fun error(message: String?): JSONObject =
        JSONObject().put("ok", false).put("error", message ?: "오류")

    private fun result(r: Result<Unit>): JSONObject =
        if (r.isSuccess) ok() else error(r.exceptionOrNull()?.message)

    private fun statusToJson(status: ServerStatus): JSONObject = JSONObject()
        .put("state", status.state.name)
        .put("pid", status.pid ?: JSONObject.NULL)
        .put("uptimeSec", status.uptimeSec)
        .put("players", status.players)
        .put("playerNames", JSONArray(status.playerNames))
        .put("cpuPercent", status.cpuPercent)
        .put("ramMb", status.ramMb)
}
