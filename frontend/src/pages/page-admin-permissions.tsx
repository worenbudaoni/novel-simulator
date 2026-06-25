import { useState, useEffect, useMemo } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from 'src/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import {
  PlusIcon, Loader2Icon, Trash2Icon, SearchIcon,
  ChevronRightIcon, ChevronDownIcon,
} from 'lucide-react';

interface Permission {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['novel', 'node', 'event', 'user', 'role', 'player']));
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newResource, setNewResource] = useState('');
  const [newAction, setNewAction] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/role/permissions').then(res => {
      if (res.data.code === 200) setPermissions(res.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return permissions;
    return permissions.filter(p =>
      p.code.includes(search) || p.name.includes(search) || p.resource.includes(search)
    );
  }, [permissions, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    filtered.forEach(p => {
      if (!map.has(p.resource)) map.set(p.resource, []);
      map.get(p.resource)!.push(p);
    });
    return Array.from(map.entries())
      .map(([resource, items]) => ({ resource, items }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  }, [filtered]);

  const toggleGroup = (resource: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource); else next.add(resource);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newCode.trim() || !newName.trim() || !newResource.trim() || !newAction.trim()) {
      toast.error('请填写所有字段');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/role/permissions', {
        code: newCode.trim(), name: newName.trim(),
        resource: newResource.trim(), action: newAction.trim(),
      });
      toast.success('权限已创建');
      setShowCreate(false);
      setNewCode(''); setNewName(''); setNewResource(''); setNewAction('');
      const res = await api.get('/admin/role/permissions');
      if (res.data.code === 200) setPermissions(res.data.data);
    } finally { setSaving(false); }
  };

  const handleDelete = async (p: Permission) => {
    if (!confirm(`确定删除权限「${p.name}」？`)) return;
    try {
      await api.delete(`/admin/role/permissions/${p.id}`);
      toast.success('已删除');
      setPermissions(prev => prev.filter(x => x.id !== p.id));
    } catch { /* handled */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">权限管理</h2>
        <Button onClick={() => setShowCreate(true)}><PlusIcon className="size-4 mr-1" /> 新建权限</Button>
      </div>

      <div className="relative max-w-sm mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="搜索权限编码或名称..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">暂无匹配权限</div>
      ) : (
        <div className="rounded-lg border divide-y">
          {grouped.map(({ resource, items }) => {
            const isExpanded = expanded.has(resource);
            return (
              <div key={resource}>
                {/* Group Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(resource)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors cursor-pointer text-left"
                >
                  {isExpanded ? <ChevronDownIcon className="size-4 shrink-0" /> : <ChevronRightIcon className="size-4 shrink-0" />}
                  <Badge variant="outline" className="text-xs font-mono">{resource}</Badge>
                  <span className="font-medium capitalize ml-1">{resource === 'novel' ? '作品' : resource === 'node' ? '节点' : resource === 'event' ? '事件' : resource === 'user' ? '用户' : resource === 'role' ? '角色' : resource === 'player' ? '玩家' : resource}</span>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </button>

                {/* Children */}
                {isExpanded && (
                  <div className="divide-y border-t bg-muted/5">
                    {items.map(p => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2 pl-14 text-sm hover:bg-muted/10 transition-colors">
                        <code className="text-xs font-mono text-primary min-w-[180px]">{p.code}</code>
                        <span className="flex-1 text-muted-foreground">{p.name}</span>
                        <button type="button" onClick={() => handleDelete(p)} className="p-1 hover:bg-destructive/10 rounded cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                          <Trash2Icon className="size-3.5 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={o => { if (!o) setShowCreate(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建权限</DialogTitle>
            <DialogDescription>创建新的权限项</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">权限编码</label>
              <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="如：novel:export" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">权限名称</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="如：导出作品" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">资源</label>
                <Input value={newResource} onChange={e => setNewResource(e.target.value)} placeholder="如：novel" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">操作</label>
                <Input value={newAction} onChange={e => setNewAction(e.target.value)} placeholder="如：export" className="font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? '创建中...' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
