package com.chyyo.agent.model

/**
 * Chyyo-Web Panel 과의 Socket.IO 통신 프로토콜 정의.
 * Agent -> Panel 은 emit, Panel -> Agent 는 RPC (ack 콜백) 형태로 처리한다.
 */
object Protocol {
    // Agent -> Panel (이벤트)
    const val HELLO = "hello"                       // { token, name, version, platform } -> ack { ok, agentId }
    const val SERVER_STATUS = "server:status"       // { serverId, status, pid, uptime, players }
    const val AGENT_STATS = "agent:stats"           // { cpu, ram, disk, network }
    const val SERVER_STATS = "server:stats"         // { serverId, players }
    const val CONSOLE_LOG = "console:log"           // { serverId, line, ts }
    const val BACKUP_DONE = "backup:done"           // { serverId, fileName, sizeBytes, status }

    // Panel -> Agent (RPC) — payload 필드에 type 사용
    const val RPC = "rpc"

    // RPC types
    const val RPC_APPLY_SERVERS = "servers:apply"
    const val RPC_SERVER_START = "server:start"
    const val RPC_SERVER_STOP = "server:stop"
    const val RPC_SERVER_RESTART = "server:restart"
    const val RPC_SERVER_STATUS = "server:status"
    const val RPC_CONSOLE_INPUT = "console:input"
    const val RPC_CONSOLE_HISTORY = "console:history"
    const val RPC_CONSOLE_CLEAR = "console:clear"
    const val RPC_FILE_LIST = "file:list"
    const val RPC_FILE_READ = "file:read"
    const val RPC_FILE_WRITE = "file:write"
    const val RPC_FILE_DELETE = "file:delete"
    const val RPC_FILE_RENAME = "file:rename"
    const val RPC_FILE_MKDIR = "file:mkdir"
    const val RPC_FILE_UPLOAD = "file:upload"
    const val RPC_FILE_DOWNLOAD = "file:download"
    const val RPC_BACKUP_CREATE = "backup:create"
    const val RPC_BACKUP_LIST = "backup:list"
    const val RPC_BACKUP_RESTORE = "backup:restore"
    const val RPC_BACKUP_DELETE = "backup:delete"
    const val RPC_BACKUP_DOWNLOAD = "backup:download"
}

/** RPC 응답의 공통 구조 */
object Responses {
    fun ok(data: Any? = null): Map<String, Any?> = mapOf("ok" to true, "data" to data)
    fun error(message: String): Map<String, Any?> = mapOf("ok" to false, "error" to message)
}
