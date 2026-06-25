import { useState, useEffect, useMemo } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from 'src/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Switch } from 'src/components/ui/switch';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import {
  PlusIcon, Loader2Icon, Trash2Icon, SearchIcon,
  ChevronRightIcon, ChevronDownIcon,
} from 'lucide-react';

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
}

export default function AdminPermissionsPage() {
  const [tree, setTree] = useState<PermissionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
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
      if (res.data.code === 200) setTree(res.data.data || []);
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

  // Search filter
  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const filterNode = (nodes: PermissionNode[]): PermissionNode[] => {
      return nodes.filter(n => {
        const match = n.name.includes(search) || n.code.includes(search);
        const filteredChildren = n.children ? filterNode(n.children) : [];
        return match || filteredChildren.length > 0;
      });
    };
    return filterNode(tree);
  }, [tree, search]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

  const typeBadge = (t: number) => t === 1
    ? <Badge variant="default" className="text-[10px]">菜单</Badge>
    : <Badge variant="outline" className="text-[10px]">按钮</Badge>;

  const renderNode = (node: PermissionNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/10 transition-colors"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          <button type="button" onClick={() => hasChildren && toggleExpand(node.id)} className={`p-0.5 ${hasChildren ? 'cursor-pointer' : 'invisible'}`}>
            {isExpanded ? <ChevronDownIcon className="size-3.5 text-muted-foreground" /> : <ChevronRightIcon className="size-3.5 text-muted-foreground" />}
          </button>
          <span className={`font-medium ${node.type === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{node.name}</span>
          {typeBadge(node.type)}
          <code className="text-xs font-mono text-primary ml-2">{node.code}</code>
          {node.route && <span className="text-xs text-muted-foreground ml-2">{node.route}</span>}
          <span className={`ml-auto text-xs ${node.status === 1 ? 'text-green-600' : 'text-red-500'}`}>{node.status === 1 ? '有效' : '无效'}</span>
          <button type="button" onClick={() => handleDelete(node)} className="p-1 hover:bg-destructive/10 rounded cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
            <Trash2Icon className="size-3.5 text-destructive" />
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children!.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
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
      {filteredTree.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">暂无权限</div>
      ) : (
        <div className="rounded-lg border divide-y">{filteredTree.map(node => renderNode(node))}</div>
      )}

      {/* Create Dialog */}
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
                <Select value={formType} onValueChange={setFormType}>
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
              <Select value={formParentId} onValueChange={setFormParentId}>
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
