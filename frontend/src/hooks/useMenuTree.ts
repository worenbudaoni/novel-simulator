import { useState, useEffect } from 'react';
import api from '@/hooks/useApi';

export interface MenuItem {
  id: number;
  parentId: number;
  name: string;
  code: string;
  route?: string;
  children?: MenuItem[];
}

export function useMenuTree() {
  const [menuTree, setMenuTree] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/menus').then(res => {
      if (res.data.code === 200) {
        setMenuTree(res.data.data || []);
      }
    }).finally(() => setLoading(false));
  }, []);

  return { menuTree, loading };
}
