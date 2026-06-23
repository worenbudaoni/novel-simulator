import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SidebarProvider, SidebarInset } from 'src/components/ui/sidebar';
import { AppSidebar } from 'src/components/app-sidebar';
import { SiteHeader } from 'src/components/site-header';
import { Toaster } from 'src/components/ui/sonner';
import { LoginForm } from 'src/components/login-form';
import { SignupForm } from 'src/components/signup-form';

function SidebarLayout({ children }: { children: React.ReactNode }) {
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={
            <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
              <div className="w-full max-w-sm"><LoginForm /></div>
            </div>
          } />
          <Route path="/register" element={
            <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
              <div className="w-full max-w-sm"><SignupForm /></div>
            </div>
          } />
          <Route path="/player" element={
            <SidebarLayout>
              <div className="flex items-center justify-center h-full text-muted-foreground">Player home — coming soon</div>
            </SidebarLayout>
          } />
          <Route path="/admin" element={
            <SidebarLayout>
              <div className="flex items-center justify-center h-full text-muted-foreground">Admin — coming soon</div>
            </SidebarLayout>
          } />
          <Route path="/" element={<Navigate to="/player" replace />} />
          <Route path="*" element={<Navigate to="/player" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
