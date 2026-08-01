package com.chyyo.agent.network

import com.chyyo.agent.server.ServerDefinition
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Chyyo-Web Panel REST API 클라이언트.
 * WebSocket 연결 전 인증/서버 목록 조회 등에 사용한다.
 */
class ApiClient(
    private val baseUrl: String,
    private val agentToken: String
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(json)
        }
    }

    /** 이 Agent에 할당된 Minecraft 서버 목록 조회 */
    suspend fun getAssignedServers(): Result<List<ServerDefinition>> {
        return request("/api/agent/servers").mapCatching { body ->
            val arr = body["servers"]?.jsonArray ?: return@mapCatching emptyList()
            arr.map { it.jsonObject.let { o ->
                ServerDefinition(
                    id = o["id"]!!.jsonPrimitive.content,
                    name = o["name"]!!.jsonPrimitive.content,
                    path = o["path"]!!.jsonPrimitive.content,
                    jarFile = o["jarFile"]?.jsonPrimitive?.content ?: "server.jar",
                    javaArgs = o["javaArgs"]?.jsonPrimitive?.content ?: ""
                )
            } }
        }
    }

    private suspend fun request(path: String): Result<JsonObject> {
        return try {
            val response = client.get("$baseUrl$path") {
                header("X-Agent-Token", agentToken)
            }
            if (response.status.value == 200) {
                Result.success(json.parseToJsonElement(response.bodyAsText()).jsonObject)
            } else {
                Result.failure(IllegalStateException("API 오류 ${response.status.value}: ${response.bodyAsText()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun close() {
        client.close()
    }
}
