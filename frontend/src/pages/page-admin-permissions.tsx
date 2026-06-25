import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from 'src/components/ui/form';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import {
  PlusIcon, Loader2Icon, Trash2Icon, PencilIcon, SearchIcon,
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

const formSchema = z.object({
  name: z.string().min(1, '请输入权限名称'),
  code: z.string().min(1, '请输入权限标识'),
  type: z.string().min(1),
  parentId: z.string().min(1),
  route: z.string().optional(),
  sortOrder: z.string().optional(),
  status: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface PermissionNode {
  id: number;
  parentId: number;
  name: string;
  code: string;
  type: number;
  route: string | null;
  status: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  children?: PermissionNode[];
  subRows?: PermissionNode[];
}

function formatTime(s: string) {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

const columnHelper = createColumnHelper<PermissionNode>();

export default function AdminPermissionsPage() {
  const [tree, setTree] = useState<PermissionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editNode, setEditNode] = useState<PermissionNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionNode | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', code: '', type: '2', parentId: '0', route: '', sortOrder: '0', status: true },
  });

  const watchType = form.watch('type');

  useEffect(() => { loadTree(); }, []);

  const loadTree = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/permissions/tree');
      if (res.data.code === 200) {
        const data: PermissionNode[] = res.data.data || [];
        const addSubRows = (nodes: PermissionNode[]): PermissionNode[] =>
          nodes.map(n => ({ ...n, subRows: n.children ? addSubRows(n.children) : undefined }));
        setTree(addSubRows(data));
      }
    } finally { setLoading(false); }
  };

  const allNodes = useMemo(() => {
    const flatten = (nodes: PermissionNode[]): PermissionNode[] => {
      const result: PermissionNode[] = [];
      for (const n of nodes) { result.push(n); if (n.children) result.push(...flatten(n.children)); }
      return result;
    };
    return flatten(tree);
  }, [tree]);

  // --- 新建 / 编辑 ---

  const openCreate = useCallback(() => {
    setEditNode(null);
    form.reset({ name: '', code: '', type: '2', parentId: '0', route: '', sortOrder: '0', status: true });
    setShowDialog(true);
  }, [form]);

  const openEdit = useCallback((node: PermissionNode) => {
    setEditNode(node);
    form.reset({
      name: node.name,
      code: node.code,
      type: String(node.type),
      parentId: String(node.parentId),
      route: node.route || '',
      sortOrder: String(node.sortOrder),
      status: node.status === 1,
    });
    setShowDialog(true);
  }, [form]);

  const handleSave = useCallback(async (data: FormData) => {
    setSaving(true);
    try {
      const body: any = { name: data.name, code: data.code, type: Number(data.type), parentId: Number(data.parentId), sortOrder: Number(data.sortOrder), status: data.status ? 1 : 0 };
      if (data.type === '1' && data.route) body.route = data.route;

      if (editNode) {
        await api.put(`/admin/permissions/${editNode.id}`, body);
        toast.success('权限已更新');
      } else {
        await api.post('/admin/permissions', body);
        toast.success('权限已创建');
      }
      setShowDialog(false);
      await loadTree();
    } finally { setSaving(false); }
  }, [editNode]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/permissions/${deleteTarget.id}`);
      toast.success('已删除');
      setDeleteTarget(null);
      await loadTree();
    } catch { /* handled */ }
  }, [deleteTarget]);

  const confirmDelete = useCallback((node: PermissionNode) => {
    setDeleteTarget(node);
  }, []);

  // --- 列定义 ---

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'expander',
      size: 28,
      cell: ({ row }) => {
        if (!row.getCanExpand()) return <span className="inline-block w-4" />;
        return (
          <button type="button" onClick={(e) => { e.stopPropagation(); row.getToggleExpandedHandler()(); }} className="p-0.5 cursor-pointer">
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
      size: 56,
      cell: ({ getValue }) => getValue() === 1
        ? <Badge variant="default" className="text-[10px]">菜单</Badge>
        : <Badge variant="outline" className="text-[10px]">按钮</Badge>,
    }),
    columnHelper.accessor('code', {
      header: '标识',
      minSize: 120,
      cell: ({ getValue }) => <code className="text-xs font-mono text-primary">{getValue()}</code>,
    }),
    columnHelper.accessor('route', {
      header: '路由',
      minSize: 100,
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? <span className="text-xs text-muted-foreground">{v}</span> : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    }),
    columnHelper.accessor('status', {
      header: '状态',
      size: 48,
      cell: ({ getValue }) => (
        <span className={`text-xs ${getValue() === 1 ? 'text-green-600' : 'text-red-500'}`}>
          {getValue() === 1 ? '有效' : '无效'}
        </span>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: '创建时间',
      size: 120,
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(v)}</span> : null;
      },
    }),
    columnHelper.accessor('updatedAt', {
      header: '修改时间',
      size: 120,
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(v)}</span> : null;
      },
    }),
    columnHelper.display({
      id: 'actions',
      size: 52,
      cell: ({ row }) => (
        <div className="flex gap-0.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }} className="p-1 hover:bg-muted rounded cursor-pointer" title="编辑">
            <PencilIcon className="size-3.5 text-muted-foreground" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); confirmDelete(row.original); }} className="p-1 hover:bg-destructive/10 rounded cursor-pointer" title="删除">
            <Trash2Icon className="size-3.5 text-destructive" />
          </button>
        </div>
      ),
    }),
  ], [openEdit, confirmDelete]);

  const globalFilter = useMemo(() => search || undefined, [search]);

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
    state: { globalFilter },
    filterFromLeafRows: true,
    defaultColumn: { minSize: 60, size: 100 },
  });

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

      <div className="rounded-lg border overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id} style={{ width: h.getSize() }} className="text-xs">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">暂无权限</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.map(row => {
              const depth = row.depth;
              return (
                <TableRow
                  key={row.id}
                  className={`hover:bg-muted/10 ${row.getCanExpand() ? 'cursor-pointer' : ''}`}
                  onClick={() => row.getCanExpand() && row.getToggleExpandedHandler()()}
                >
                  {row.getVisibleCells().map((cell, ci) => (
                    <TableCell key={cell.id} className="py-1.5 text-xs" style={{ paddingLeft: ci === 0 ? `${8 + depth * 20}px` : undefined }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 新建 / 编辑 Dialog */}
      <Dialog open={showDialog} onOpenChange={o => { if (!o) { setShowDialog(false); setEditNode(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)}>
              <DialogHeader>
                <DialogTitle>{editNode ? '编辑权限' : '新建权限'}</DialogTitle>
                <DialogDescription>{editNode ? '修改权限信息' : '创建新的菜单或按钮权限'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <FormField name="type" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>类型</FormLabel>
                      <Select value={field.value} onValueChange={(v) => v !== null && field.onChange(v)}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(v: any) => v === '1' ? '菜单' : '按钮'}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">菜单</SelectItem>
                          <SelectItem value="2">按钮</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField name="status" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>状态</FormLabel>
                      <div className="flex items-center h-9">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                        <span className="ml-2 text-sm text-muted-foreground">{field.value ? '有效' : '无效'}</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField name="parentId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>父节点</FormLabel>
                    <Select value={field.value} onValueChange={(v) => v !== null && field.onChange(v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: any) => v === '0' ? '根节点' : allNodes.find(n => String(n.id) === v)?.name || v}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">根节点</SelectItem>
                        {allNodes.filter(n => n.type === 1 && n.id !== editNode?.id).map(n => (
                          <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="name" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl><Input {...field} placeholder="如：导出作品" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="code" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>权限标识</FormLabel>
                    <FormControl><Input {...field} placeholder="如：novel:export" className="font-mono" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {watchType === '1' && (
                  <FormField name="route" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>路由路径</FormLabel>
                      <FormControl><Input {...field} placeholder="如：/admin/settings" className="font-mono" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField name="sortOrder" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => { setShowDialog(false); setEditNode(null); }}>取消</Button>
                <Button type="submit" disabled={saving}>{saving ? '保存中...' : editNode ? '保存修改' : '创建'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.name}」？
              {deleteTarget?.children?.length ? ' 其子节点也将被删除。' : ''}
              此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
