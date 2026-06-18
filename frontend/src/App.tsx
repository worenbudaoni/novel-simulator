import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { BookOpen, LayoutDashboard } from 'lucide-react';

const PlayerHome = () => (
  <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] bg-background px-4">
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
  <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] bg-background px-4">
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
        <Navbar />
        <Toaster position="top-right" />
        <Routes>
        <Route path="/" element={<Navigate to="/player" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/player" element={<PlayerHome />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute permissions={['novel:read', 'user:read']}>
              <AdminHome />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
