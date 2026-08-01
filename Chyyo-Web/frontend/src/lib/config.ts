/**
 * Chyyo-Web Frontend 런타임 설정.
 *
 * - VITE_API_URL이 설정되면(프로덕션 도메인 배포) 해당 Origin의 API/WebSocket을 사용합니다.
 * - 설정되지 않으면(로컬 개발) 같은 Origin 상대경로를 사용하며, Vite 개발 프록시가
 *   /api, /socket.io를 백엔드(localhost:3000)로 전달합니다.
 */
const raw = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE: string = raw ? raw.replace(/\/+$/, '') : '';

/** Socket.IO 연결 주소(네임스페이스 포함) 생성 */
export function socketUrl(namespace: string): string {
  return API_BASE ? `${API_BASE}${namespace}` : namespace;
}
