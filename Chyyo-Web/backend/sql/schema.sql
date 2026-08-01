-- Chyyo-Web PostgreSQL 스키마
-- psql -U postgres -d chyyo -f sql/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'user', -- admin | user
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    connected BOOLEAN NOT NULL DEFAULT false,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    jar_file TEXT NOT NULL DEFAULT 'server.jar',
    java_args TEXT NOT NULL DEFAULT '-Xms1G -Xmx2G',
    status TEXT NOT NULL DEFAULT 'OFFLINE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS server_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(32) NOT NULL DEFAULT 'view', -- view | console | files | manage
    UNIQUE (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 초기 관리자 계정은 백엔드 기동 시 ADMIN_PASSWORD로 자동 생성됨 (database/init.ts 참조)
