import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface Props {
  children: React.ReactNode;
  permissions?: string[];
}

export default function ProtectedRoute({ children, permissions }: Props) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permissions && permissions.length > 0) {
    const hasAccess = permissions.some(p => hasPermission(p));
    if (!hasAccess) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <Card className="w-full max-w-sm text-center">
            <CardHeader>
              <CardTitle className="text-5xl font-bold text-destructive">403</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">抱歉，你没有权限访问此页面</p>
              <a href="/">
                <Button variant="outline">返回首页</Button>
              </a>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
}
