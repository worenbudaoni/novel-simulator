import { useAuth } from './useAuth';

/**
 * 检查当前用户是否拥有指定权限
 */
export function usePermission() {
  const { user } = useAuth();

  const hasPermission = (code: string): boolean => {
    if (!user?.permissions) return false;
    return user.permissions.includes(code);
  };

  const hasAnyPermission = (...codes: string[]): boolean => {
    if (!user?.permissions) return false;
    return codes.some(code => user.permissions.includes(code));
  };

  const hasAllPermissions = (...codes: string[]): boolean => {
    if (!user?.permissions) return false;
    return codes.every(code => user.permissions.includes(code));
  };

  return { hasPermission, hasAnyPermission, hasAllPermissions };
}
