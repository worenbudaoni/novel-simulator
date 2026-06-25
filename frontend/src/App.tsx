import { BrowserRouter, Routes, Route, Navigate, Link, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider, SidebarInset } from 'src/components/ui/sidebar';
import { AppSidebar } from 'src/components/app-sidebar';
import { SiteHeader } from 'src/components/site-header';
import { Button } from 'src/components/ui/button';
import { Toaster } from 'src/components/ui/sonner';
import { LoginForm } from 'src/components/login-form';
import { SignupForm } from 'src/components/signup-form';
import AdminNovelsPage from 'src/pages/page-admin-novels';
import AdminNovelImportPage from 'src/pages/page-admin-novel-import';
import AdminNodeEditorPage from 'src/pages/page-admin-node-editor';
import AdminEventPoolPage from 'src/pages/page-admin-event-pool';
import AdminUsersPage from 'src/pages/page-admin-users';
import AdminRolesPage from 'src/pages/page-admin-roles';
import AdminPermissionsPage from 'src/pages/page-admin-permissions';
import PlayerNovelsPage from 'src/pages/page-player-novels';
import PlayerSettingsPage from 'src/pages/page-player-settings';
import PlayerStoryPage from 'src/pages/page-player-story';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, CommandIcon } from 'lucide-react';

function DashboardLayout({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="flex-1 p-6">{children ?? <Outlet />}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function PlayerPage() {
  return (
    <DashboardLayout>
      <PlayerNovelsPage />
    </DashboardLayout>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex items-center h-14 px-4 lg:px-6 border-b border-border bg-background">
        <Link to="/player" className="flex items-center gap-2 font-semibold text-foreground">
          <CommandIcon className="size-5" />
          <span>Novel Simulator</span>
        </Link>
      </div>
      <div className="flex items-center justify-center px-4 pt-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<AuthLayout><LoginForm /></AuthLayout>} />
          <Route path="/register" element={<AuthLayout><SignupForm /></AuthLayout>} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/player/settings/:novelId" element={
            <DashboardLayout><PlayerSettingsPage /></DashboardLayout>
          } />
          <Route path="/player/story/:sessionId" element={
            <DashboardLayout><PlayerStoryPage /></DashboardLayout>
          } />
          {/* 有侧边栏路由组 — 防止导航时重新挂载 */}
          <Route element={<DashboardLayout><Outlet /></DashboardLayout>}>
            <Route path="/admin" element={<ProtectedRoute code="menu:novels"><AdminNovelsPage /></ProtectedRoute>} />
            <Route path="/admin/novel/:novelId/import" element={<ProtectedRoute code="menu:novels"><AdminNovelImportPage /></ProtectedRoute>} />
            <Route path="/admin/novel/:novelId/nodes" element={<ProtectedRoute code="menu:novels"><AdminNodeEditorPage /></ProtectedRoute>} />
            <Route path="/admin/novel/:novelId/events" element={<ProtectedRoute code="menu:novels"><AdminEventPoolPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute code="menu:users"><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute code="menu:roles"><AdminRolesPage /></ProtectedRoute>} />
            <Route path="/admin/permissions" element={<ProtectedRoute code="menu:permissions"><AdminPermissionsPage /></ProtectedRoute>} />
          </Route>
          <Route path="/" element={<Navigate to="/player" replace />} />
          <Route path="*" element={<Navigate to="/player" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
