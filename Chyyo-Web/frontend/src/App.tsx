import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ServersPage } from './pages/ServersPage';
import { ServerDetailPage } from './pages/ServerDetailPage';
import { AgentsPage } from './pages/AgentsPage';
import { SettingsPage } from './pages/SettingsPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent-soft" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Shell() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-[220px] min-h-screen p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <Protected>
                    <Shell />
                  </Protected>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/servers" element={<ServersPage />} />
                <Route path="/servers/:serverId" element={<ServerDetailPage />} />
                <Route
                  path="/agents"
                  element={
                    <AdminOnly>
                      <AgentsPage />
                    </AdminOnly>
                  }
                />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
