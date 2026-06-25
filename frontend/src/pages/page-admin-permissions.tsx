import { useState, useEffect } from 'react';
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
import { PlusIcon, Loader2Icon, Trash2Icon } from 'lucide-react';

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

  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">权限管理</h2>
        <Button onClick={() => setShowCreate(true)}><PlusIcon className="size-4 mr-1" /> 新建权限</Button>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([resource, perms]) => (
          <div key={resource}>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 capitalize">{resource}</h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编码</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perms.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(p)}>
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={o => { if (!o) setShowCreate(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建权限</DialogTitle>
            <DialogDescription>创建新的系统权限</DialogDescription>
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
                <label className="text-sm font-medium">所属资源</label>
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
