import { useState, useEffect } from 'react';
import api from '@/hooks/useApi';

export interface MenuItem {
  id: number;
  parentId: number;
  name: string;
  code: string;
  route?: string;
  type?: number;
  children?: MenuItem[];
}

// 模块级缓存，所有组件共享，只请求一次
let cachedTree: MenuItem[] | null = null;
let cachedLoading = true;

export function useMenuTree() {
  const [menuTree, setMenuTree] = useState<MenuItem[]>(cachedTree ?? []);
  const [loading, setLoading] = useState(cachedLoading);

  useEffect(() => {
    if (cachedTree !== null) {
      setLoading(false);
      return;
    }
    api.get('/auth/menus').then(res => {
      if (res.data.code === 200) {
        const data: MenuItem[] = res.data.data || [];
        cachedTree = data;
        setMenuTree(data);
      }
    }).finally(() => {
      cachedLoading = false;
      setLoading(false);
    });
  }, []);

  return { menuTree, loading };
}
