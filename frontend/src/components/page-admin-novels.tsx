import { useState, useEffect, useCallback } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from 'src/components/ui/dialog';
import { toast } from 'sonner';
import { PlusIcon, SearchIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import api from '@/hooks/useApi';

interface Novel {
  id: number;
  title: string;
  author: string;
  contentType: number;
  status: number;
  parseStatus: number;
  createdAt: string;
}

export default function AdminNovelsPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createAuthor, setCreateAuthor] = useState('');
  const [createType, setCreateType] = useState(0);
  const [creating, setCreating] = useState(false);

  const fetchNovels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/novel/list', { params: { page, size: 20, keyword } });
      if (res.data.code === 200) {
        setNovels(res.data.data.items);
        setTotal(res.data.data.total);
      }
    } catch { /* handled by interceptor */ }
    setLoading(false);
  }, [page, keyword]);

  useEffect(() => { fetchNovels(); }, [fetchNovels]);

  const handleCreate = async () => {
    if (!createTitle.trim()) { toast.error('请输入作品名称'); return; }
    setCreating(true);
    try {
      const res = await api.post('/api/admin/novel', {
        title: createTitle.trim(),
        author: createAuthor.trim() || null,
        contentType: createType,
      });
      if (res.data.code === 200) {
        toast.success('创建成功');
        setShowCreate(false);
        setCreateTitle('');
        setCreateAuthor('');
        setCreateType(0);
        fetchNovels();
      }
    } catch { /* handled */ }
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该作品？')) return;
    try {
      const res = await api.delete(`/api/admin/novel/${id}`);
      if (res.data.code === 200) {
        toast.success('已删除');
        fetchNovels();
      }
    } catch { /* handled */ }
  };

  const typeLabel = (t: number) => ['小说', '动漫', '漫画'][t] || '未知';
  const statusLabel = (s: number) => s === 1 ? '已发布' : '草稿';
  const parseLabel = (s: number) => ['未解析', '解析中', '已完成'][s] || '未知';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">作品管理</h2>
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="size-4 mr-1" /> 新建作品
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="搜索作品..."
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>作者</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>解析</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">加载中...</TableCell></TableRow>
            ) : novels.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">暂无作品</TableCell></TableRow>
            ) : novels.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="text-muted-foreground">{n.id}</TableCell>
                <TableCell className="font-medium">{n.title}</TableCell>
                <TableCell>{n.author || '-'}</TableCell>
                <TableCell>{typeLabel(n.contentType)}</TableCell>
                <TableCell>{statusLabel(n.status)}</TableCell>
                <TableCell>{parseLabel(n.parseStatus)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{n.createdAt?.slice(0, 10)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm"><PencilIcon className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(n.id)}>
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>下一页</Button>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建作品</DialogTitle>
            <DialogDescription>输入作品信息后创建</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">作品名称 *</label>
              <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="输入作品名称" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">作者</label>
              <Input value={createAuthor} onChange={(e) => setCreateAuthor(e.target.value)} placeholder="原作者（可选）" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">类型</label>
              <select
                value={createType}
                onChange={(e) => setCreateType(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value={0}>小说</option>
                <option value={1}>动漫</option>
                <option value={2}>漫画</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
