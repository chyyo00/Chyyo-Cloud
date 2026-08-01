import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Boxes,
  Settings,
  LogOut,
  ServerCog,
  Blocks,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const items = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/servers', label: '서버', icon: Boxes },
  { to: '/agents', label: '에이전트', icon: ServerCog, adminOnly: true },
  { to: '/settings', label: '설정', icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = items.filter((i) => !i.adminOnly || user?.role === 'admin');

  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-white/[0.06] bg-base-900/80 p-4 backdrop-blur-2xl"
    >
      {/* 로고 */}
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-b from-accent-soft to-accent shadow-[0_4px_16px_-2px_rgba(10,132,255,0.6)]">
          <Blocks className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-base font-semibold tracking-tight text-white">Chyyo</div>
          <div className="text-[11px] font-medium text-zinc-500">Minecraft Panel</div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex flex-1 flex-col gap-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn('nav-item', isActive && 'active')}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* 사용자 */}
      <div className="mt-4 flex flex-col gap-1 border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-accent-soft to-accent text-sm font-semibold text-white">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{user?.username}</div>
            <div className="text-[11px] capitalize text-zinc-500">
              {user?.role === 'admin' ? '관리자' : '사용자'}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="nav-item w-full text-left"
        >
          <LogOut className="h-[18px] w-[18px]" />
          로그아웃
        </button>
      </div>
    </motion.aside>
  );
}
