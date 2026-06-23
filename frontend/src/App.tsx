import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider, SidebarInset } from 'src/components/ui/sidebar';
import { AppSidebar } from 'src/components/app-sidebar';
import { SiteHeader } from 'src/components/site-header';
import { Toaster } from 'src/components/ui/sonner';
import ProtectedRoute from 'src/components/ProtectedRoute';
import { LoginForm } from 'src/components/login-form';
import { SignupForm } from 'src/components/signup-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'src/components/ui/card';
import { BookOpen, LayoutDashboard } from 'lucide-react';

function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}

function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="text-6xl font-bold text-muted-foreground/30 mb-2">404</div>
          <CardTitle className="text-xl">页面不存在</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            你访问的页面不存在或已被移除
          </p>
          <a href="/">
            <button className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
              返回首页
            </button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

const PlayerHome = () => (
  <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-background px-4">
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-full bg-primary/10">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-xl">作品列表</CardTitle>
        <CardDescription>选择一部作品开始你的冒险</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">功能将在下一阶段实现</p>
      </CardContent>
    </Card>
  </div>
);

const AdminHome = () => (
  <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-background px-4">
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-full bg-primary/10">
            <LayoutDashboard className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-xl">管理后台</CardTitle>
        <CardDescription>管理作品、节点、事件和用户</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">功能将在下一阶段实现</p>
      </CardContent>
    </Card>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/player"
            element={
              <SidebarLayout>
                <PlayerHome />
              </SidebarLayout>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute permissions={['novel:read', 'user:read']}>
                <SidebarLayout>
                  <AdminHome />
                </SidebarLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
