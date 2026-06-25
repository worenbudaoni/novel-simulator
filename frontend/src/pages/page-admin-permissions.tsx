import { useState, useEffect, useMemo } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from 'src/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Switch } from 'src/components/ui/switch';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import {
  PlusIcon, Loader2Icon, Trash2Icon, SearchIcon,
  ChevronRightIcon, ChevronDownIcon,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';

interface PermissionNode {
  id: number;
  parentId: number;
  name: string;
  code: string;
  type: number;
  route: string | null;
  status: number;
  sortOrder: number;
  children?: PermissionNode[];
  subRows?: PermissionNode[];
}

const columnHelper = createColumnHelper<PermissionNode>();

export default function AdminPermissionsPage() {
  const [tree, setTree] = useState<PermissionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState('2');
  const [formParentId, setFormParentId] = useState('0');
  const [formRoute, setFormRoute] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formStatus, setFormStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTree(); }, []);

  const loadTree = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/permissions/tree');
      if (res.data.code === 200) {
        const data: PermissionNode[] = res.data.data || [];
        // 给树形数据加上 subRows 别名（TanStack Table 用 subRows）
        const addSubRows = (nodes: PermissionNode[]): PermissionNode[] =>
          nodes.map(n => ({ ...n, subRows: n.children ? addSubRows(n.children) : undefined }));
        setTree(addSubRows(data));
      }
    } finally { setLoading(false); }
  };

  // Flatten tree for parent selector
  const allNodes = useMemo(() => {
    const flatten = (nodes: PermissionNode[]): PermissionNode[] => {
      const result: PermissionNode[] = [];
      for (const n of nodes) {
        result.push(n);
        if (n.children) result.push(...flatten(n.children));
      }
      return result;
    };
    return flatten(tree);
  }, [tree]);

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'expander',
      size: 32,
      cell: ({ row }) => {
        if (!row.getCanExpand()) return <span className="inline-block w-4" />;
        return (
          <button
            type="button"
            onClick={row.getToggleExpandedHandler()}
            className="p-0.5 cursor-pointer"
          >
            {row.getIsExpanded()
              ? <ChevronDownIcon className="size-3.5 text-muted-foreground" />
              : <ChevronRightIcon className="size-3.5 text-muted-foreground" />
            }
          </button>
        );
      },
    }),
    columnHelper.accessor('name', {
      header: '名称',
      cell: ({ row, getValue }) => (
        <span className={`font-medium ${row.original.type === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
          {getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('type', {
      header: '类型',
      size: 64,
      cell: ({ getValue }) => getValue() === 1
        ? <Badge variant="default" className="text-[10px]">菜单</Badge>
        : <Badge variant="outline" className="text-[10px]">按钮</Badge>,
    }),
    columnHelper.accessor('code', {
      header: '标识',
      cell: ({ getValue }) => <code className="text-xs font-mono text-primary">{getValue()}</code>,
    }),
    columnHelper.accessor('route', {
      header: '路由',
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? <span className="text-xs text-muted-foreground">{v}</span> : null;
      },
    }),
    columnHelper.accessor('status', {
      header: '状态',
      size: 56,
      cell: ({ getValue }) => (
        <span className={`text-xs ${getValue() === 1 ? 'text-green-600' : 'text-red-500'}`}>
          {getValue() === 1 ? '有效' : '无效'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      size: 40,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => handleDelete(row.original)}
          className="p-1 hover:bg-destructive/10 rounded cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
        >
          <Trash2Icon className="size-3.5 text-destructive" />
        </button>
      ),
    }),
  ], []);

  const globalFilter = useMemo(() => {
    if (!search) return undefined;
    return search;
  }, [search]);

  const table = useReactTable({
    data: tree,
    columns,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _, filterValue) => {
      const name = row.original.name?.toLowerCase() ?? '';
      const code = row.original.code?.toLowerCase() ?? '';
      const q = String(filterValue).toLowerCase();
      return name.includes(q) || code.includes(q);
    },
    state: {
      globalFilter,
    },
    filterFromLeafRows: true,
  });

  const openCreate = () => {
    setFormName(''); setFormCode(''); setFormType('2');
    setFormParentId('0'); setFormRoute(''); setFormSortOrder('0');
    setFormStatus(true);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('请输入权限名称'); return; }
    if (!formCode.trim()) { toast.error('请输入权限标识'); return; }
    setSaving(true);
    try {
      const body: any = { name: formName.trim(), code: formCode.trim(), type: Number(formType), parentId: Number(formParentId), sortOrder: Number(formSortOrder), status: formStatus ? 1 : 0 };
      if (formType === '1' && formRoute.trim()) body.route = formRoute.trim();
      await api.post('/admin/permissions', body);
      toast.success('权限已创建');
      setShowCreate(false);
      await loadTree();
    } finally { setSaving(false); }
  };

  const handleDelete = async (node: PermissionNode) => {
    if (!confirm(`确定删除「${node.name}」？${node.children?.length ? ' 其子节点也将被删除。' : ''}`)) return;
    try {
      await api.delete(`/admin/permissions/${node.id}`);
      toast.success('已删除');
      await loadTree();
    } catch { /* handled */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">权限管理</h2>
        <Button onClick={openCreate}><PlusIcon className="size-4 mr-1" /> 新建权限</Button>
      </div>
      <div className="relative max-w-sm mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="搜索名称或标识..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id} style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">暂无权限</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.map(row => {
              const depth = row.depth;
              return (
                <TableRow key={row.id} className="hover:bg-muted/10">
                  {row.getVisibleCells().map((cell, ci) => (
                    <TableCell key={cell.id} className="py-2" style={{ paddingLeft: ci === 0 ? `${8 + depth * 20}px` : undefined }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showCreate} onOpenChange={o => { if (!o) setShowCreate(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建权限</DialogTitle>
            <DialogDescription>创建新的菜单或按钮权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">类型</label>
                <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">菜单</SelectItem>
                    <SelectItem value="2">按钮</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">状态</label>
                <div className="flex items-center h-9">
                  <Switch checked={formStatus} onCheckedChange={setFormStatus} />
                  <span className="ml-2 text-sm text-muted-foreground">{formStatus ? '有效' : '无效'}</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">父节点</label>
              <Select value={formParentId} onValueChange={(v: any) => setFormParentId(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">根节点</SelectItem>
                  {allNodes.filter(n => n.type === 1).map(n => (
                    <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">名称</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="如：导出作品" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">权限标识</label>
              <Input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="如：novel:export" className="font-mono" />
            </div>
            {formType === '1' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">路由路径</label>
                <Input value={formRoute} onChange={e => setFormRoute(e.target.value)} placeholder="如：/admin/settings" className="font-mono" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">排序</label>
              <Input type="number" value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)} />
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
