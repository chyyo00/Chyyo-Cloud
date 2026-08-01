package com.chyyo.agent.security

import com.chyyo.agent.config.AppConfig
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Agent 인증 토큰 및 요청 검증 관리.
 * - Panel과의 WebSocket 핸드셰이크 시 사용하는 정적 토큰
 * - 위험 명령어 검증
 */
class TokenManager(private val config: AppConfig) {

    private val activeSessions = ConcurrentHashMap<String, Long>()

    /** config에 저장된 panel 인증 토큰 */
    fun panelToken(): String = config.panel.agentToken

    /** 수신된 RPC 요청의 서명 검증 (옵션). 임시 구현으로 길이/형식 검사. */
    fun validateRequestToken(token: String?): Boolean {
        if (token.isNullOrBlank()) return false
        return token == config.panel.agentToken
    }

    /** 세션 등록 (핸드셰이크 완료 시) */
    fun registerSession(sessionId: String) {
        activeSessions[sessionId] = System.currentTimeMillis()
    }

    fun unregisterSession(sessionId: String) {
        activeSessions.remove(sessionId)
    }

    fun hasActiveSession(): Boolean = activeSessions.isNotEmpty()

    /**
     * 위험 명령어 차단 목록.
     * 웹 사용자가 일반 권한으로 실행하면 안 되는 명령어를 걸러낸다.
     */
    fun isDangerousCommand(command: String): Boolean {
        val first = command.trim().lowercase().split(" ").firstOrNull() ?: return false
        return first in DANGEROUS_COMMANDS
    }

    companion object {
        val DANGEROUS_COMMANDS = setOf(
            "op", "deop",
            "ban-ip", "pardon-ip",
            "whitelist"
        )

        /** 간단한 HMAC 서명 (옵션 기능) */
        fun sign(payload: String, secret: String): String {
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
            return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(payload.toByteArray()))
        }

        fun sha256(value: String): String =
            MessageDigest.getInstance("SHA-256")
                .digest(value.toByteArray())
                .joinToString("") { "%02x".format(it) }
    }
}
