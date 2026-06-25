import { type ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface AuthorizedProps {
  code: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function Authorized({ code, children, fallback }: AuthorizedProps) {
  const { hasPermission, hasAnyPermission } = usePermission();

  const hasAccess = Array.isArray(code)
    ? hasAnyPermission(...code)
    : hasPermission(code);

  if (!hasAccess) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
