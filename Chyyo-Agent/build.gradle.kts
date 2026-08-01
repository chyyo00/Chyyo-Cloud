plugins {
    kotlin("jvm") version "2.2.0"
    application
}

group = "com.chyyo"
version = "1.0.0"

repositories {
    mavenCentral()
}

val ktorVersion = "2.3.12"

dependencies {
    // WebSocket (Socket.IO) client
    implementation("io.socket:socket.io-client:2.1.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")

    // HTTP REST client
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")

    // Coroutines + serialization
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Resource monitoring (Windows 지원)
    implementation("com.github.oshi:oshi-core:6.6.3")

    // Logging
    implementation("org.slf4j:slf4j-nop:2.0.16")

    testImplementation(kotlin("test"))
}

kotlin {
    jvmToolchain(17)
}

application {
    mainClass.set("com.chyyo.agent.MainKt")
}

tasks.jar {
    manifest {
        attributes["Main-Class"] = "com.chyyo.agent.MainKt"
    }
}

// 실행 가능한 fat jar 생성 (java -jar Chyyo-Agent.jar)
tasks.register<Jar>("fatJar") {
    archiveClassifier.set("all")
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    manifest { attributes["Main-Class"] = "com.chyyo.agent.MainKt" }
    from(sourceSets.main.get().output)
    dependsOn(configurations.runtimeClasspath)
    from({
        configurations.runtimeClasspath.get().filter { it.name.endsWith("jar") }.map { zipTree(it) }
    })
    exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA")
}
