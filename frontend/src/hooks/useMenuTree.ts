import { useState, useEffect } from 'react';
import api from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';

export interface MenuItem {
  id: number;
  parentId: number;
  name: string;
  code: string;
  route?: string;
  type?: number;
  children?: MenuItem[];
}

// 模块级缓存，按用户 sessionId 缓存，用户变化时自动失效
const menuCache: Map<string, MenuItem[]> = new Map();

export function useMenuTree() {
  const { user } = useAuth();
  const userKey = user?.sessionId || 'guest';
  const [menuTree, setMenuTree] = useState<MenuItem[]>(menuCache.get(userKey) ?? []);
  const [loading, setLoading] = useState(!menuCache.has(userKey));

  useEffect(() => {
    if (menuCache.has(userKey)) {
      setLoading(false);
      return;
    }
    api.get('/auth/menus').then(res => {
      if (res.data.code === 200) {
        const data: MenuItem[] = res.data.data || [];
        menuCache.set(userKey, data);
        setMenuTree(data);
      }
    }).finally(() => {
      setLoading(false);
    });
  }, [userKey]);

  return { menuTree, loading };
}
