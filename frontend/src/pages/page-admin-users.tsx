import { useState, useEffect, useCallback } from 'react';
import { Button } from 'src/components/ui/button';
import { Badge } from 'src/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from 'src/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import { Input } from 'src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from 'src/components/ui/popover';
import { Command, CommandGroup, CommandItem } from 'src/components/ui/command';
import { SearchIcon, Loader2Icon, ShieldIcon, ChevronDownIcon, CheckIcon } from 'lucide-react';

interface UserItem {
  id: number;
  username: string;
  nickname: string;
  enabled: boolean;
  roleIds: number[];
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tempStatus, setTempStatus] = useState('');
  const [roleFilter, setRoleFilter] = useState<number[]>([]);
  const [roles, setRoles] = useState<{id: number; code: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, size: 10 };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.enabled = statusFilter;
      if (roleFilter.length > 0) params.roleIds = roleFilter.join(',');
      const uRes = await api.get('/admin/user/list', { params });
      if (uRes.data.code === 200) { setUsers(uRes.data.data.items); setTotal(uRes.data.data.total); }
    } finally { setLoading(false); }
  }, [page, keyword, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
    api.get('/admin/role/list').then(r => { if (r.data.code === 200) setRoles(r.data.data); });
  }, [fetchUsers]);

  const openRoles = (user: UserItem) => {
    setEditUser(user);
    setEditRoleIds([...user.roleIds]);
  };

  const saveRoles = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await api.put(`/admin/user/${editUser.id}/roles`, editRoleIds);
      if (res.data.code === 200) {
        toast.success('角色已更新');
        setEditUser(null);
        fetchUsers();
      }
    } finally { setSaving(false); }
  };

  const toggleStatus = async (user: UserItem) => {
    try {
      const res = await api.put(`/admin/user/${user.id}/status`, { enabled: !user.enabled });
      if (res.data.code === 200) {
        toast.success(user.enabled ? '已禁用' : '已启用');
        fetchUsers();
      }
    } catch { /* handled */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">用户管理</h2>
      </div>

      <div className="flex items-end gap-3 mb-6 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground font-medium">用户名</label>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setKeyword(searchInput); setPage(1); } }}
              className="pl-9 w-52"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">状态</label>
          <Select value={tempStatus} onValueChange={setTempStatus}>
            <SelectTrigger className="w-24">
              {tempStatus === 'true' ? '正常' : tempStatus === 'false' ? '禁用' : '全部'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="true">正常</SelectItem>
              <SelectItem value="false">禁用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">角色</label>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center justify-between w-44 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-left text-muted-foreground hover:bg-accent">
                <span className="truncate">{roleFilter.length > 0 ? `已选 ${roleFilter.length} 个角色` : '全部角色'}</span>
                <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandGroup>
                  {roles.filter(r => r.code !== 'ADMIN').map(r => {
                    const selected = roleFilter.includes(r.id);
                    return (
                      <CommandItem key={r.id} onSelect={() => setRoleFilter(prev => selected ? prev.filter(id => id !== r.id) : [...prev, r.id])}>
                        <div className={`size-4 mr-2 rounded border flex items-center justify-center transition-colors ${selected ? 'bg-primary border-primary' : 'border-input'}`}>
                          {selected && <CheckIcon className="size-3 text-primary-foreground" />}
                        </div>
                        {r.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={() => { setKeyword(searchInput); setStatusFilter(tempStatus); setPage(1); }}>
            <SearchIcon className="size-4 mr-1" /> 搜索
          </Button>
          <Button variant="ghost" onClick={() => { setSearchInput(''); setKeyword(''); setTempStatus(''); setStatusFilter(''); setRoleFilter([]); setPage(1); }}>
            重置
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>用户名</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="text-muted-foreground">{u.id}</TableCell>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>{u.nickname || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {u.roleIds.map(rid => {
                      const role = roles.find(r => r.id === rid);
                      return role ? <Badge key={rid} variant="outline" className="text-xs">{role.name}</Badge> : null;
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 text-xs ${u.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                    <span className={`size-1.5 rounded-full ${u.enabled ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    {u.enabled ? '正常' : '禁用'}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.createdAt?.slice(0, 10)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openRoles(u)} title="分配角色">
                      <ShieldIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => toggleStatus(u)} title={u.enabled ? '禁用' : '启用'}>
                      {u.enabled ? <span className="text-xs text-destructive">禁用</span> : <span className="text-xs text-green-600">启用</span>}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-muted-foreground">共 {total} 条</span>
        {total > 10 ? (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            {(() => {
              const totalPages = Math.ceil(total / 10);
              const pages: (number | string)[] = [];
              const start = Math.max(1, page - 2);
              const end = Math.min(totalPages, page + 2);
              if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
              for (let i = start; i <= end; i++) pages.push(i);
              if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }
              return pages.map((p, i) =>
                typeof p === 'string' ? (
                  <span key={`e${i}`} className="px-1 text-muted-foreground">{p}</span>
                ) : (
                  <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="min-w-[32px]" onClick={() => setPage(p)}>{p}</Button>
                )
              );
            })()}
            <Button variant="outline" size="sm" disabled={page * 10 >= total} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        ) : total > 0 ? (
          <span className="text-muted-foreground text-xs">第 1 页</span>
        ) : null}
      </div>

      <Dialog open={editUser !== null} onOpenChange={o => { if (!o) setEditUser(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>分配角色</DialogTitle>
            <DialogDescription>为用户「{editUser?.username}」选择角色</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 py-4">
            {roles.filter(r => r.code !== 'ADMIN').map(r => {
              const selected = editRoleIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setEditRoleIds(prev => selected ? prev.filter(id => id !== r.id) : [...prev, r.id])}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                    selected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-input text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {selected ? '✓ ' : ''}{r.name}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>取消</Button>
            <Button onClick={saveRoles} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
