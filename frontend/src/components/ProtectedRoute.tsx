import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermission } from '@/hooks/usePermission';

interface ProtectedRouteProps {
  children: React.ReactNode;
  code?: string | string[];
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  code,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermission();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (code) {
    const hasAccess = Array.isArray(code)
      ? hasAnyPermission(...code)
      : hasPermission(code);

    if (!hasAccess) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-1">403</h2>
            <p className="text-sm text-muted-foreground">没有权限访问此页面</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
