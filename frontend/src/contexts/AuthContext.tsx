import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../hooks/useApi';
import type { ApiResult, AuthResponse, LoginRequest, RegisterRequest } from '../types';

export interface AuthContextType {
  user: AuthResponse | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    const savedUser = localStorage.getItem('userInfo');
    if (sessionId && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await api.post<ApiResult<AuthResponse>>('/auth/login', data);
    if (res.data.code === 200) {
      const userData = res.data.data;
      localStorage.setItem('sessionId', userData.sessionId);
      localStorage.setItem('userInfo', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(res.data.message);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await api.post<ApiResult<null>>('/auth/register', data);
    if (res.data.code !== 200) {
      throw new Error(res.data.message);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    localStorage.removeItem('sessionId');
    localStorage.removeItem('userInfo');
    setUser(null);
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    return user?.permissions?.includes(permission) ?? false;
  }, [user]);

  const hasRole = useCallback((role: string): boolean => {
    return user?.roles?.includes(role) ?? false;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
