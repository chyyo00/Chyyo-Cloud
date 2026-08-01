import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { pool } from './database/pool';
import { bootstrapAdmin } from './database/init';
import { AgentGateway } from './websocket/agentGateway';
import { PanelGateway } from './websocket/panelGateway';
import { authRouter } from './api/auth.routes';
import { agentRouter } from './api/agent.routes';
import { userRouter } from './api/user.routes';
import { keyRouter } from './api/key.routes';
import { createServerRouter } from './api/server.routes';

async function main() {
  // 관리자 계정 보장 (DB가 준비되어 있어야 함)
  try {
    await bootstrapAdmin();
  } catch (e) {
    console.error(
      '[db] 초기화 실패 — SQL 스키마를 먼저 실행하세요:  npm run db:init  (' +
        (e as Error).message +
        ')'
    );
  }

  const app = express();
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '50mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, name: 'Chyyo-Web', ts: Date.now() }));

  const httpServer = http.createServer(app);

  // Socket.IO
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  });

  // Agent(데몬) 네임스페이스
  const agents = new AgentGateway(io, io.of('/agent'), io.of('/panel'));
  agents.init();

  // 패널(브라우저) 네임스페이스
  const panel = new PanelGateway(io.of('/panel'), agents);
  panel.init();

  // REST API (AgentGateway 주입)
  app.use('/api/auth', authRouter);
  app.use('/api/agents', agentRouter);
  app.use('/api/agent', agentRouter); // Agent 데몬 호환 별칭
  app.use('/api/users', userRouter);
  app.use('/api/keys', keyRouter);
  app.use('/api/servers', createServerRouter(agents));

  httpServer.listen(env.port, () => {
    console.log('');
    console.log('  ┌───────────────────────────────────────────┐');
    console.log('  │  Chyyo-Web Backend  v1.0.0                │');
    console.log(`  │  REST   http://localhost:${env.port}          │`);
    console.log(`  │  Agent  ws://localhost:${env.port}/agent   │`);
    console.log(`  │  Panel  ws://localhost:${env.port}/panel   │`);
    console.log('  └───────────────────────────────────────────┘');
  });
}

main().catch((e) => {
  console.error('치명적 오류:', e);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
