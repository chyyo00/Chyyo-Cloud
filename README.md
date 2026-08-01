# Chyyo — Minecraft Server Management Platform

Pterodactyl 수준의 기능을 가진 자체 Minecraft 서버 관리 플랫폼.
**Apple macOS/iOS 스타일**의 프리미엄 웹 UI를 제공하며, **RCON 없이** Java 프로세스의
stdin/stdout/stderr를 직접 제어하는 Agent 방식으로 동작합니다.

두 개의 독립 프로젝트로 구성됩니다.

```
Chyyo/
├── Chyyo-Agent/   # Windows Server용 데몬 (Kotlin + Gradle)
└── Chyyo-Web/     # 웹 관리 패널 (React + Node.js)
```

## 아키텍처

```
[사용자 브라우저]
      │  HTTPS / WebSocket(Socket.IO /panel)
      ▼
[Chyyo-Web Backend]  ── Express + Socket.IO + PostgreSQL + JWT
      │  WebSocket(Socket.IO /agent) + REST
      ▼
[Chyyo-Agent]        ── Kotlin 데몬 (Windows Server)
      │  ProcessBuilder (stdin / stdout / stderr)
      ▼
[Minecraft Java Process]  (Paper / Purpur / Spigot / Fabric / Forge)
```

- **Agent**는 Panel에 **아웃바운드**로 연결합니다 (방화벽/NAT 친화적).
- 콘솔은 `stdout/stderr` 스트리밍 → WebSocket → 브라우저로 실시간 전달.
- 명령은 브라우저 → Panel → Agent → 프로세스 `stdin`으로 전달.
- **RCON을 전혀 사용하지 않습니다.**

---

# 1. Chyyo-Agent (Windows Server 데몬)

Minecraft 서버 프로세스·파일·백업·리소스를 직접 관리하는 에이전트.

## 요구사항

- Windows Server 2016+ / 2019 / 2022
- JDK 17+ (Minecraft 서버용 Java와 동일 또는 별도)
- Gradle 8.x (빌드 전용, 실행은 fat jar)

## 프로젝트 구조

```
Chyyo-Agent/
├── build.gradle.kts          # Kotlin DSL 빌드 설정
├── run.bat                   # Windows 시작 스크립트
├── src/main/kotlin/com/chyyo/agent/
│   ├── Main.kt               # 엔트리 포인트
│   ├── config/AppConfig.kt   # config.json 설정 로드
│   ├── model/Protocol.kt     # WebSocket 프로토콜 정의
│   ├── security/TokenManager.kt  # 인증 토큰 + 위험 명령어 차단
│   ├── server/
│   │   ├── ServerManager.kt      # 다중 서버 인스턴스 관리
│   │   ├── ProcessManager.kt     # Java 프로세스 제어 (stdin/out/err)
│   │   ├── ConsoleManager.kt     # 콘솔 버퍼/로그 파일/플레이어 추적
│   │   └── ServerInstance.kt     # 서버 단위 구성
│   ├── file/FileManager.kt       # 파일 CRUD + 경로 트래버셜 방지
│   ├── backup/BackupManager.kt   # ZIP 백업/복원
│   ├── monitor/ResourceMonitor.kt# CPU/RAM/Disk/Network (OSHI)
│   └── network/
│       ├── WebSocketClient.kt    # Panel Socket.IO 연결
│       ├── ApiClient.kt          # Panel REST API 호출
│       └── RpcRouter.kt          # Panel 명령 라우팅
└── src/main/resources/config.json  # 기본 설정
```

## 설치 및 실행

1. **빌드** (Java 17 + Gradle 8.x 필요):

   ```bat
   gradle fatJar
   ```

   → `build/libs/Chyyo-Agent-1.0.0-all.jar` 생성

2. **설정**: jar와 같은 폴더에 `config.json` 생성

   ```json
   {
     "panel": {
       "baseUrl": "https://panel-api.choverse.com",
       "agentToken": "Web에서 발급받은 에이전트 토큰"
     },
     "agent": {
       "name": "Main-Node-01",
       "serverRoot": "C:/Minecraft"
     }
   }
   ```

   > `baseUrl`은 패널 API 주소입니다. 도메인 배포 시 `https://panel-api.choverse.com`,
   > 로컬 테스트 시 `http://패널_서버_IP:3000`을 사용합니다. 에이전트는 아웃바운드 연결이라
   > 방화벽/NAT 뒤에서도 동작합니다.

3. **실행**:

   ```bat
   run.bat
   # 또는
   java -jar Chyyo-Agent-1.0.0-all.jar
   ```

> 토큰은 Chyyo-Web 관리자 페이지 `에이전트` → `에이전트 등록`에서 발급받습니다 (1회만 표시).

## 서버 디렉토리 예시

```
C:/Minecraft/
├─ Survival/
│   ├─ paper.jar
│   ├─ server.properties
│   ├─ plugins/
│   ├─ world/
│   └─ logs/
├─ Lobby/
│   ├─ paper.jar
│   └─ world/
└─ Backup/                # (자동 생성) 서버별 ZIP 백업
```

서버별 `plugins/`·`mods/` 폴더에 jar를 업로드하면 플러그인/모드 설치가 완료됩니다.
(재시작 필요 안내는 Web 콘솔 로그에서 확인)

---

# 2. Chyyo-Web (관리 패널)

## 요구사항

- Node.js 18+
- PostgreSQL 14+

## 프로젝트 구조

```
Chyyo-Web/
├── backend/                     # Node.js + Express + Socket.IO
│   ├── sql/schema.sql           # PostgreSQL 스키마
│   └── src/
│       ├── index.ts             # 서버 엔트리 (REST + Socket.IO)
│       ├── config/env.ts
│       ├── database/            # pool, 초기화(admin 계정)
│       ├── auth/                # bcrypt, JWT
│       ├── middleware/auth.ts   # JWT 인증 + 권한 미들웨어
│       ├── api/                 # auth / agents / servers / users 라우트
│       ├── services/
│       └── websocket/
│           ├── agentGateway.ts  # Agent(데몬) 게이트웨이 + RPC
│           └── panelGateway.ts  # 브라우저 게이트웨이
│
└── frontend/                    # React + TypeScript + Tailwind + Radix + Framer Motion
    └── src/
        ├── pages/               # Login, Dashboard, Servers, ServerDetail, Agents, Settings
        ├── components/          # Sidebar, Console, FileManager, Backups, Charts, ui/*
        ├── hooks/               # usePanelSocket, useServers, useServerConsole, useAgentStats
        ├── context/             # AuthContext
        └── lib/                 # API 클라이언트, 유틸
```

## 설치 및 실행

### 1) PostgreSQL 준비

```sql
CREATE DATABASE chyyo;
```

### 2) Backend

```bat
cd Chyyo-Web\backend
npm install

copy .env.example .env
:: .env에서 DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD 수정

npm run db:init        :: 스키마 적용 (psql 필요)
npm run dev            :: 개발 서버 (:3000)
```

### 3) Frontend

```bat
cd Chyyo-Web\frontend
npm install
npm run dev            :: 개발 서버 (:5173, /api·/socket.io 프록시)
```

브라우저에서 `http://localhost:5173` 접속.

> 기본 관리자 계정: `admin` / `.env`의 `ADMIN_PASSWORD` (기본 `admin1234`)

## 프로덕션 배포 (Windows Server / Linux)

프론트와 백엔드는 **별도 도메인**으로 분리 배포합니다.

| 구성 | 도메인 | 내용 |
|---|---|---|
| Frontend | `https://panel.choverse.com` | `frontend/dist` 정적 파일 (nginx) |
| Backend  | `https://panel-api.choverse.com` | Node 서버 `:3000` 리버스 프록시 (REST + WebSocket) |

### 1) Backend

```bat
cd Chyyo-Web\backend
npm install
copy .env.example .env
:: DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, CORS_ORIGINS 수정
npm run db:init
npm run build
set NODE_ENV=production
node dist/index.js
:: (선택) NSSM / systemd로 서비스 등록
```

`.env`의 `CORS_ORIGINS`에 프론트 오리진을 등록합니다 (콤마 구분):

```
CORS_ORIGINS=https://panel.choverse.com
```

### 2) Frontend

```bat
cd Chyyo-Web\frontend
npm install
:: .env.production 에 VITE_API_URL=https://panel-api.choverse.com 설정 (기본값)
npm run build
:: dist/ 폴더를 panel.choverse.com의 웹루트로 서빙
```

> **로컬 개발**은 `.env.development`(VITE_API_URL 미설정)로 실행합니다.
> Vite 프록시가 `/api`, `/socket.io`를 `localhost:3000`으로 전달하므로
> `npm run dev` 후 `http://localhost:5173`만 접속하면 됩니다.

### 3) nginx 설정 예시

`panel.choverse.com` (정적 프론트):

```nginx
server {
    listen 443 ssl http2;
    server_name panel.choverse.com;

    ssl_certificate     /etc/letsencrypt/live/panel.choverse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.choverse.com/privkey.pem;

    root /srv/chyyo/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`panel-api.choverse.com` (백엔드 프록시 + WebSocket):

```nginx
server {
    listen 443 ssl http2;
    server_name panel-api.choverse.com;

    ssl_certificate     /etc/letsencrypt/live/panel-api.choverse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel-api.choverse.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
```

> 아직 SSL 인증서가 없다면 certbot으로 발급받으세요:
> `certbot --nginx -d panel.choverse.com -d panel-api.choverse.com`

---

## 사용 흐름

1. 관리자 로그인 → `에이전트` 탭에서 에이전트 등록 → 토큰 복사
2. Windows Server에 Chyyo-Agent 설치/실행 (토큰 입력)
3. `서버` 탭 → `서버 등록` → 서버 경로·Jar·Java 옵션 지정
4. 서버 카드에서 시작/종료/재시작
5. 서버 상세 → `콘솔` 탭에서 실시간 로그 + 명령어 입력
6. `파일` 탭에서 플러그인 업로드 / 설정 편집 (Drag & Drop 지원)
7. `백업` 탭에서 월드 ZIP 백업 생성·복원·다운로드
8. 대시보드에서 CPU/RAM/디스크/네트워크 실시간 차트 확인

## 권한 시스템

| 역할 | 기능 |
|---|---|
| **admin** | 모든 서버 관리, 에이전트 등록, 서버 등록/삭제, 사용자·권한 관리 |
| **user** | 자신에게 부여된 서버만 관리 |

서버별 권한: `view` → `console` → `files` → `manage` (REST API `PUT /api/servers/:id/permissions`)

## 보안

- JWT 인증 (브라우저 ↔ Panel)
- Agent 인증 토큰 (SHA-256 해시 저장, 1회 노출)
- 위험 명령어(`op`, `deop`, `ban-ip`, `pardon-ip`, `whitelist`) 차단 — 서버측(Backend)·에이전트측 이중 검증
- 파일 경로 트래버셜 방지 (canonical path 검증)
- 백업 복원은 서버 종료 상태에서만 허용

## REST API 요약

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/auth/register` `/api/auth/login` | 회원가입/로그인 |
| GET | `/api/servers` | 서버 목록 (권한별) |
| POST/PATCH/DELETE | `/api/servers[/:id]` | 서버 CRUD (admin) |
| POST | `/api/servers/:id/start·stop·restart·command` | 서버 제어 |
| GET/PUT/DELETE | `/api/servers/:id/files*` | 파일 관리 |
| GET/POST/DELETE | `/api/servers/:id/backups*` | 백업 관리 |
| POST | `/api/agents` | 에이전트 등록 → 토큰 발급 (admin) |
| GET | `/api/agent/servers` | Agent가 조회하는 할당 서버 목록 |

## 실시간 이벤트 (Socket.IO)

- `server:status` — 서버 상태 (2초 주기)
- `console:log` — 실시간 콘솔 출력
- `agent:stats` — CPU/RAM/디스크/네트워크 (3초 주기)
- `backup:done` — 백업 완료 알림
