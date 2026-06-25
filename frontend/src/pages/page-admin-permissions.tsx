import { useState, useEffect, useMemo } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  // Group by resource, flatten for table
  const grouped = useMemo(() => {
    const filtered = permissions.filter(p =>
      !search || p.code.includes(search) || p.name.includes(search) || p.resource.includes(search)
    );
    const groups: { resource: string; items: Permission[] }[] = [];
    const map = new Map<string, Permission[]>();
    filtered.forEach(p => {
      if (!map.has(p.resource)) map.set(p.resource, []);
      map.get(p.resource)!.push(p);
    });
    map.forEach((items, resource) => groups.push({ resource, items }));
    groups.sort((a, b) => a.resource.localeCompare(b.resource));
    return groups;
  }, [permissions, search]);

  // Paginate groups
  const totalGroups = grouped.length;
  const totalPages = Math.ceil(totalGroups / pageSize);
  const pagedGroups = grouped.slice((page - 1) * pageSize, page * pageSize);

  const toggleGroup = (resource: string) => {
    setCollapsed(prev => {
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
        code: newCode.trim(),
        name: newName.trim(),
        resource: newResource.trim(),
        action: newAction.trim(),
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

      <div className="flex items-center gap-3 mb-6">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="搜索权限编码或名称..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
      </div>

      {pagedGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">暂无匹配权限</div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>资源 / 权限编码</TableHead>
                <TableHead>权限名称</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedGroups.map(({ resource, items }) => {
                const isCollapsed = collapsed.has(resource);
                return (
                  <TableRow key={resource} className="group">
                    <TableCell>
                      <button type="button" onClick={() => toggleGroup(resource)} className="p-1 hover:bg-muted rounded cursor-pointer">
                        {isCollapsed ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium capitalize" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{resource}</Badge>
                        <span className="text-xs text-muted-foreground">({items.length} 项)</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pagedGroups.map(({ resource, items }) => {
                if (collapsed.has(resource)) return null;
                const groupKey = `detail-${resource}`;
                return items.map((p, i) => (
                  <TableRow key={`${groupKey}-${p.id}`} className="bg-muted/10">
                    <TableCell></TableCell>
                    <TableCell className="font-mono text-sm pl-8">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(p)}>
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">共 {totalGroups} 个资源组</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="min-w-[32px]" onClick={() => setPage(p)}>{p}</Button>
            ))}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
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
