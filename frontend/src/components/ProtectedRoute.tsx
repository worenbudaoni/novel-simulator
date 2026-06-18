import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
  permissions?: string[];
}

export default function ProtectedRoute({ children, permissions }: Props) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">403</h1>
            <p className="text-gray-600">没有权限访问此页面</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
