import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider, SidebarInset } from 'src/components/ui/sidebar';
import { AppSidebar } from 'src/components/app-sidebar';
import { SiteHeader } from 'src/components/site-header';
import { SectionCards } from 'src/components/section-cards';
import { Button } from 'src/components/ui/button';
import { Toaster } from 'src/components/ui/sonner';
import { LoginForm } from 'src/components/login-form';
import { SignupForm } from 'src/components/signup-form';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, CommandIcon } from 'lucide-react';

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function GuestPlayerPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-primary/10">
            <BookOpen className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Novel Simulator</h1>
        <p className="text-muted-foreground mb-6">登录后开始你的故事之旅</p>
        <Link to="/login">
          <Button size="lg" className="w-full">登录</Button>
        </Link>
        <p className="text-sm text-muted-foreground mt-3">
          还没有账号？{' '}
          <Link to="/register" className="text-primary underline underline-offset-4">注册</Link>
        </p>
      </div>
    </div>
  );
}

function PlayerPage() {
  const { user } = useAuth();
  return user ? (
    <DashboardLayout>
      <SectionCards />
    </DashboardLayout>
  ) : (
    <GuestPlayerPage />
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
          <Route path="/admin" element={
            <DashboardLayout>
              <div className="flex items-center justify-center h-full text-muted-foreground">管理后台 — 功能待实现</div>
            </DashboardLayout>
          } />
          <Route path="/" element={<Navigate to="/player" replace />} />
          <Route path="*" element={<Navigate to="/player" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
