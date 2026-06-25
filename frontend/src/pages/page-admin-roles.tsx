import { useState, useEffect } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Badge } from 'src/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from 'src/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import { PlusIcon, Loader2Icon, PencilIcon, Trash2Icon, ShieldCheckIcon, BookOpenIcon } from 'lucide-react';
import PermissionTree from 'src/components/PermissionTree';

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
  const [permTree, setPermTree] = useState<any[]>([]);
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
  // Novel visibility
  const [visRole, setVisRole] = useState<RoleItem | null>(null);
  const [visNovelIds, setVisNovelIds] = useState<number[]>([]);
  const [visSaving, setVisSaving] = useState(false);
  const [visNovels, setVisNovels] = useState<{id: number; title: string}[]>([]);
  const [visTotal, setVisTotal] = useState(0);
  const [visPage, setVisPage] = useState(1);
  const [visSearch, setVisSearch] = useState('');
  const [visFilter, setVisFilter] = useState<string>(''); // '' = all, 'true' = selected, 'false' = unselected
  const [visLoading, setVisLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/role/list'),
      api.get('/admin/role/permissions'),
      api.get('/admin/permissions/tree'),
    ]).then(([rRes, pRes, tRes]) => {
      if (rRes.data.code === 200) setRoles(rRes.data.data);
      if (pRes.data.code === 200) setPermissions(pRes.data.data || []);
      if (tRes.data.code === 200) setPermTree(tRes.data.data || []);
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

  const openNovelVis = async (role: RoleItem) => {
    setVisRole(role);
    setVisPage(1);
    setVisSearch('');
    setVisFilter('');
    await loadVisNovels(1, '', '', role.id);
  };

  const loadVisNovels = async (page: number, keyword: string, filter?: string, roleId?: number) => {
    const rid = roleId || visRole?.id;
    if (!rid) return;
    setVisLoading(true);
    try {
      const params: any = { page, size: 10, keyword };
      if (filter !== undefined && filter !== '') params.selected = filter;
      const res = await api.get(`/admin/role/${rid}/novels/selectable`, { params });
      if (res.data.code === 200) {
        const data = res.data.data;
        setVisNovels(data.items || []);
        setVisTotal(data.total || 0);
        setVisPage(page);
        setVisNovelIds((data.items || []).filter((n: any) => n.selected).map((n: any) => n.id));
      }
    } finally { setVisLoading(false); }
  };

  const saveNovelVis = async () => {
    if (!visRole) return;
    setVisSaving(true);
    try {
      const res = await api.put(`/admin/role/${visRole.id}/novels`, visNovelIds);
      if (res.data.code === 200) { toast.success('可见作品已更新'); setVisRole(null); }
    } finally { setVisSaving(false); }
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
                    <Button variant="ghost" size="icon-sm" onClick={() => openNovelVis(r)} title="可见作品">
                      <BookOpenIcon className="size-4" />
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
        <DialogContent className="sm:max-w-md flex flex-col max-h-[80vh] p-0 gap-0">
          <div className="px-6 pt-6">
            <DialogHeader className="px-0">
              <DialogTitle>权限配置</DialogTitle>
              <DialogDescription>为角色「{permRole?.name}」分配权限</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {permTree.length > 0 ? (
              <PermissionTree
                data={permTree}
                selectedIds={permIds}
                onSelectChange={setPermIds}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">加载中...</p>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setPermRole(null)}>取消</Button>
            <Button onClick={savePerm} disabled={permSaving}>{permSaving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novel Visibility Dialog */}
      <Dialog open={visRole !== null} onOpenChange={o => { if (!o) setVisRole(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>可见作品</DialogTitle>
            <DialogDescription>选择角色「{visRole?.name}」可以看见哪些作品</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-3">
            <Input
              placeholder="搜索作品名称..."
              value={visSearch}
              onChange={e => setVisSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadVisNovels(1, visSearch, visFilter); }}
              className="flex-1"
            />
            <Select value={visFilter} onValueChange={v => { setVisFilter(v); loadVisNovels(1, visSearch, v); }}>
              <SelectTrigger className="w-[100px] shrink-0">
                {visFilter === 'true' ? '已选择' : visFilter === 'false' ? '未选择' : '全部'}
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="true">已选择</SelectItem>
                <SelectItem value="false">未选择</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => loadVisNovels(1, visSearch, visFilter)}>搜索</Button>
            <Button variant="ghost" size="sm" onClick={() => { setVisSearch(''); setVisFilter(''); loadVisNovels(1, '', ''); }}>重置</Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 border rounded-md p-2">
            {visLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm"><Loader2Icon className="size-4 animate-spin mr-2" />加载中...</div>
            ) : visNovels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">暂无作品</p>
            ) : visNovels.map(n => {
              const selected = visNovelIds.includes(n.id);
              return (
                <label key={n.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${selected ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/30'}`}>
                  <input type="checkbox" checked={selected} onChange={() => setVisNovelIds(prev => selected ? prev.filter(id => id !== n.id) : [...prev, n.id])} className="size-4 rounded accent-primary" />
                  <span className={selected ? 'font-medium' : ''}>{n.title}</span>
                  {selected && <span className="ml-auto text-xs text-primary">已选</span>}
                </label>
              );
            })}
          </div>

          {visTotal > 10 && (
            <div className="flex items-center justify-between pt-3 text-sm">
              <span className="text-muted-foreground">共 {visTotal} 条，已选 {visNovelIds.length} 部</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={visPage <= 1} onClick={() => loadVisNovels(visPage - 1, visSearch, visFilter)}>上一页</Button>
                <span className="px-2 self-center text-muted-foreground">{visPage} / {Math.ceil(visTotal / 10)}</span>
                <Button variant="outline" size="sm" disabled={visPage * 10 >= visTotal} onClick={() => loadVisNovels(visPage + 1, visSearch)}>下一页</Button>
              </div>
            </div>
          )}
          {visTotal <= 10 && (
            <p className="text-xs text-muted-foreground pt-3">已选 {visNovelIds.length} 部</p>
          )}

          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setVisRole(null)}>取消</Button>
            <Button onClick={saveNovelVis} disabled={visSaving}>{visSaving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
