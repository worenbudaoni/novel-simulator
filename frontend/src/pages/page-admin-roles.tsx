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
import { PlusIcon, Loader2Icon, PencilIcon, Trash2Icon, ShieldCheckIcon } from 'lucide-react';

interface RoleItem {
  id: number;
  code: string;
  name: string;
  description: string;
  system: boolean;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<{id: number; code: string; name: string; resource: string}[]>([]);
  const [loading, setLoading] = useState(true);
  // Create/Edit
  const [showEditor, setShowEditor] = useState(false);
  const [editRole, setEditRole] = useState<RoleItem | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [saving, setSaving] = useState(false);
  // Permission
  const [permRole, setPermRole] = useState<RoleItem | null>(null);
  const [permIds, setPermIds] = useState<number[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/role/list'),
      api.get('/admin/role/permissions'),
    ]).then(([rRes, pRes]) => {
      if (rRes.data.code === 200) setRoles(rRes.data.data);
      if (pRes.data.code === 200) setPermissions(pRes.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const openPerm = async (role: RoleItem) => {
    setPermRole(role);
    const res = await api.get(`/admin/role/${role.id}/permissions`);
    if (res.data.code === 200) setPermIds(res.data.data);
  };

  const savePerm = async () => {
    if (!permRole) return;
    setPermSaving(true);
    try {
      const res = await api.put(`/admin/role/${permRole.id}/permissions`, permIds);
      if (res.data.code === 200) {
        toast.success('权限已更新');
        setPermRole(null);
      }
    } finally { setPermSaving(false); }
  };

  const openCreate = () => {
    setEditRole(null);
    setRoleName(''); setRoleCode(''); setRoleDesc('');
    setShowEditor(true);
  };

  const openEdit = (role: RoleItem) => {
    setEditRole(role);
    setRoleName(role.name);
    setRoleCode(role.code);
    setRoleDesc(role.description || '');
    setShowEditor(true);
  };

  const saveRole = async () => {
    if (!roleName.trim() || !roleCode.trim()) { toast.error('名称和编码不能为空'); return; }
    setSaving(true);
    try {
      if (editRole) {
        await api.put(`/admin/role/${editRole.id}`, { name: roleName.trim(), code: roleCode.trim(), description: roleDesc.trim() });
        toast.success('已更新');
      } else {
        await api.post('/admin/role', { name: roleName.trim(), code: roleCode.trim(), description: roleDesc.trim() });
        toast.success('已创建');
      }
      setShowEditor(false);
      const res = await api.get('/admin/role/list');
      if (res.data.code === 200) setRoles(res.data.data);
    } finally { setSaving(false); }
  };

  const deleteRole = async (role: RoleItem) => {
    if (!confirm(`确定删除角色「${role.name}」？`)) return;
    try {
      const res = await api.delete(`/admin/role/${role.id}`);
      if (res.data.code === 200) {
        toast.success('已删除');
        const rRes = await api.get('/admin/role/list');
        if (rRes.data.code === 200) setRoles(rRes.data.data);
      }
    } catch { /* handled */ }
  };

  const groupedPerms = permissions.reduce((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {} as Record<string, typeof permissions>);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">角色管理</h2>
        <Button onClick={openCreate}><PlusIcon className="size-4 mr-1" /> 新建角色</Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编码</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.description || '-'}</TableCell>
                <TableCell>{r.system ? <Badge variant="secondary" className="text-xs">系统预设</Badge> : <Badge variant="outline" className="text-xs">自定义</Badge>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openPerm(r)} title="权限配置">
                      <ShieldCheckIcon className="size-4" />
                    </Button>
                    {!r.system && (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)} title="编辑">
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteRole(r)} title="删除">
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Role Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={o => { if (!o) setShowEditor(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editRole ? '编辑角色' : '新建角色'}</DialogTitle>
            <DialogDescription>{editRole ? '修改角色信息' : '创建新角色并分配权限'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">角色名称</label>
              <Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="如：VIP用户" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">角色编码</label>
              <Input value={roleCode} onChange={e => setRoleCode(e.target.value)} placeholder="如：VIP" disabled={!!editRole} className="font-mono" />
              <p className="text-xs text-muted-foreground">唯一标识，创建后不可修改</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">描述</label>
              <Input value={roleDesc} onChange={e => setRoleDesc(e.target.value)} placeholder="角色描述（可选）" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>取消</Button>
            <Button onClick={saveRole} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Dialog */}
      <Dialog open={permRole !== null} onOpenChange={o => { if (!o) setPermRole(null); }}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>权限配置</DialogTitle>
            <DialogDescription>为角色「{permRole?.name}」分配权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {Object.entries(groupedPerms).map(([resource, perms]) => (
              <div key={resource}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">{resource}</h4>
                <div className="flex flex-wrap gap-2">
                  {perms.map(p => {
                    const selected = permIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPermIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                          selected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-input text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermRole(null)}>取消</Button>
            <Button onClick={savePerm} disabled={permSaving}>{permSaving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
