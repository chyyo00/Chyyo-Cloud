package com.chyyo.agent.config

import org.json.JSONObject
import java.io.File

data class PanelConfig(
    val baseUrl: String,
    val agentToken: String,
    val reconnectDelayMs: Long
)

data class AgentConfig(
    val name: String,
    val serverRoot: String,
    val maxServers: Int,
    val autoStartServers: Boolean
)

data class BackupConfig(
    val autoBackupIntervalHours: Int,
    val keepLast: Int,
    val compressionLevel: Int
)

data class ConsoleConfig(
    val bufferSize: Int,
    val logToFile: Boolean
)

data class AppConfig(
    val panel: PanelConfig,
    val agent: AgentConfig,
    val backup: BackupConfig,
    val console: ConsoleConfig,
    val configDir: File,
    val logDir: File
) {
    companion object {
        private val INSTANCE = AppConfig(
            panel = PanelConfig("http://localhost:3000", "CHANGE_ME_AGENT_TOKEN", 5000),
            agent = AgentConfig("Primary-Node", "C:/Minecraft", 8, false),
            backup = BackupConfig(6, 10, 6),
            console = ConsoleConfig(1000, true),
            configDir = File("."),
            logDir = File(".")
        )

        /** config.json 파일 또는 환경변수에서 설정을 로드한다. */
        fun load(): AppConfig {
            val cfgFile = File("config.json")
            if (!cfgFile.exists()) {
                val resource = INSTANCE::class.java.getResourceAsStream("/config.json")
                if (resource != null) {
                    resource.use { input ->
                        cfgFile.parentFile?.mkdirs()
                        input.copyTo(cfgFile.outputStream())
                    }
                }
            }
            if (!cfgFile.exists()) {
                throw IllegalStateException("Missing config.json. Copy the agent configuration file and set its panel URL and token.")
            }

            val root = JSONObject(cfgFile.readText(Charsets.UTF_8))

            val panelJson = root.optJSONObject("panel") ?: JSONObject()
            val agentJson = root.optJSONObject("agent") ?: JSONObject()
            val backupJson = root.optJSONObject("backup") ?: JSONObject()
            val consoleJson = root.optJSONObject("console") ?: JSONObject()

            // 환경변수 우선 (CHYYO_PANEL_URL, CHYYO_AGENT_TOKEN)
            val panel = PanelConfig(
                baseUrl = System.getenv("CHYYO_PANEL_URL") ?: panelJson.optString("baseUrl", "http://localhost:3000"),
                agentToken = System.getenv("CHYYO_AGENT_TOKEN") ?: panelJson.optString("agentToken", "CHANGE_ME_AGENT_TOKEN"),
                reconnectDelayMs = panelJson.optLong("reconnectDelayMs", 5000)
            )
            val panelUri = java.net.URI(panel.baseUrl)
            val panelHost = panelUri.host?.lowercase()
            val isLoopback = panelHost in setOf("localhost", "127.0.0.1", "::1")
            require(panelUri.scheme == "https" || (panelUri.scheme == "http" && isLoopback)) {
                "Panel URL must use HTTPS unless it points to localhost"
            }
            require(panel.agentToken.length >= 32 && !panel.agentToken.startsWith("CHANGE_ME")) {
                "Configure a valid agent token before starting"
            }
            val agent = AgentConfig(
                name = agentJson.optString("name", "Primary-Node"),
                serverRoot = agentJson.optString("serverRoot", "C:/Minecraft"),
                maxServers = agentJson.optInt("maxServers", 8),
                autoStartServers = agentJson.optBoolean("autoStartServers", false)
            )
            val backup = BackupConfig(
                autoBackupIntervalHours = backupJson.optInt("autoBackupIntervalHours", 6),
                keepLast = backupJson.optInt("keepLast", 10),
                compressionLevel = backupJson.optInt("compressionLevel", 6)
            )
            val console = ConsoleConfig(
                bufferSize = consoleJson.optInt("bufferSize", 1000),
                logToFile = consoleJson.optBoolean("logToFile", true)
            )

            val configDir = File(cfgFile.absoluteFile.parent ?: ".")
            val logDir = File(configDir, "logs").apply { mkdirs() }
            return AppConfig(panel, agent, backup, console, configDir, logDir)
        }
    }
}
