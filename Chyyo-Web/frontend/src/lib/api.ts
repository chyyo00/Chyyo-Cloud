const TOKEN_KEY = 'chyyo_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  connected: boolean;
  lastSeen?: string;
  serverCount?: number;
  createdAt?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface Server {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_connected?: boolean;
  name: string;
  path: string;
  jar_file: string;
  java_args: string;
  status: string;
  state?: string;
  uptimeSec?: number;
  players?: number;
  pid?: number | null;
  createdAt?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

export interface BackupEntry {
  name: string;
  sizeBytes: number;
  modified: number;
}

interface RpcResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

class Api {
  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const token = tokenStore.get();
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
    return data as T;
  }

  // ---- Auth ----
  login = (username: string, password: string) =>
    this.request<{ token: string; user: User }>('POST', '/api/auth/login', { username, password });
  register = (username: string, password: string) =>
    this.request<{ token: string; user: User }>('POST', '/api/auth/register', { username, password });
  me = () => this.request<{ user: User }>('GET', '/api/auth/me');
  changePassword = (currentPassword: string, newPassword: string) =>
    this.request<{ ok: boolean }>('PATCH', '/api/auth/profile', { currentPassword, newPassword });

  // ---- Servers ----
  listServers = () => this.request<{ servers: Server[] }>('GET', '/api/servers');
  getServer = (id: string) => this.request<{ server: Server }>('GET', `/api/servers/${id}`);
  createServer = (body: any) => this.request<{ server: Server }>('POST', '/api/servers', body);
  updateServer = (id: string, body: any) =>
    this.request<{ server: Server }>('PATCH', `/api/servers/${id}`, body);
  deleteServer = (id: string) => this.request<{ ok: boolean }>('DELETE', `/api/servers/${id}`);

  startServer = (id: string) => this.rpc(`/api/servers/${id}/start`);
  stopServer = (id: string) => this.rpc(`/api/servers/${id}/stop`);
  restartServer = (id: string) => this.rpc(`/api/servers/${id}/restart`);
  sendCommand = (id: string, command: string) =>
    this.rpc(`/api/servers/${id}/command`, { command });
  consoleHistory = (id: string, count = 200) => this.rpc(`/api/servers/${id}/console?count=${count}`);

  // ---- Files ----
  listFiles = (id: string, path: string) =>
    this.rpc(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`);
  readFile = (id: string, path: string) =>
    this.rpc(`/api/servers/${id}/files/read?path=${encodeURIComponent(path)}`);
  writeFile = (id: string, path: string, content: string) =>
    this.rpc(`/api/servers/${id}/files/write`, { path, content });
  deleteFile = (id: string, path: string) =>
    this.rpc(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`, undefined, 'DELETE');
  renameFile = (id: string, path: string, newName: string) =>
    this.rpc(`/api/servers/${id}/files/rename`, { path, newName });
  mkdir = (id: string, path: string) =>
    this.rpc(`/api/servers/${id}/files/mkdir`, { path });
  uploadFile = (id: string, path: string, fileName: string, data: string) =>
    this.rpc(`/api/servers/${id}/files/upload`, { path, fileName, data });
  downloadFile = (id: string, path: string) =>
    this.rpc(`/api/servers/${id}/files/download?path=${encodeURIComponent(path)}`);

  // ---- Backups ----
  listBackups = (id: string) => this.rpc(`/api/servers/${id}/backups`);
  createBackup = (id: string, name: string) =>
    this.rpc(`/api/servers/${id}/backups`, { name });
  restoreBackup = (id: string, name: string) =>
    this.rpc(`/api/servers/${id}/backups/restore`, { name });
  deleteBackup = (id: string, name: string) =>
    this.rpc(`/api/servers/${id}/backups/${encodeURIComponent(name)}`, undefined, 'DELETE');
  downloadBackup = (id: string, name: string) =>
    this.rpc(`/api/servers/${id}/backups/${encodeURIComponent(name)}/download`);

  // ---- Agents (admin) ----
  listAgents = () => this.request<{ agents: Agent[] }>('GET', '/api/agents');
  createAgent = (name: string) => this.request<{ agent: Agent; token: string }>('POST', '/api/agents', { name });
  deleteAgent = (id: string) => this.request<{ ok: boolean }>('DELETE', `/api/agents/${id}`);

  // ---- Users (admin) ----
  listUsers = () => this.request<{ users: User[] }>('GET', '/api/users');
  setRole = (id: string, role: string) =>
    this.request<{ ok: boolean }>('PATCH', `/api/users/${id}/role`, { role });
  deleteUser = (id: string) => this.request<{ ok: boolean }>('DELETE', `/api/users/${id}`);

  // ---- API Keys ----
  listApiKeys = () => this.request<{ keys: ApiKey[] }>('GET', '/api/keys');
  createApiKey = (name: string) =>
    this.request<{ key: string; apiKey: string; name: string }>('POST', '/api/keys', { name });
  deleteApiKey = (id: string) => this.request<{ ok: boolean }>('DELETE', `/api/keys/${id}`);

  private async rpc(url: string, body?: unknown, method = 'POST'): Promise<RpcResponse> {
    return this.request<RpcResponse>(method, url, body);
  }
}

export const api = new Api();
