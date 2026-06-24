import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from 'src/components/ui/dialog';
import { toast } from 'sonner';
import {
  PlusIcon, SearchIcon, Trash2Icon, UploadIcon, GitBranchIcon, ZapIcon,
  SparklesIcon, Loader2Icon, CheckCircleIcon, FileUpIcon, XCircleIcon,
  FileTextIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const [createType, setCreateType] = useState('0');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const fetchNovels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/novel/list', { params: { page, size: 20, keyword } });
      if (res.data.code === 200) {
        setNovels(res.data.data.items);
        setTotal(res.data.data.total);
      }
    } catch { /* handled by interceptor */ }
    setLoading(false);
  }, [page, keyword]);

  useEffect(() => { fetchNovels(); }, [fetchNovels]);

  const resetCreate = () => {
    setShowCreate(false);
    setCreateTitle('');
    setCreateAuthor('');
    setCreateType('0');
    setActionLoading(false);
    setActionError('');
    setSelectedFile(null);
  };

  const handleLlmCreate = async () => {
    if (!createTitle.trim()) { toast.error('请输入作品名称'); return; }
    setActionLoading(true);
    setActionError('');
    try {
      const res = await api.post('/admin/novel/import/name', {
        name: createTitle.trim(),
        contentType: Number(createType),
      });
      if (res.data.code === 200) {
        const data = res.data.data;
        const nodeCount = (data.parseResult?.nodes as any[])?.length || 0;
        toast.success(`「${data.novel.title}」创建成功，${nodeCount} 个节点`);
        resetCreate();
        fetchNovels();
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleTxtCreate = async () => {
    if (!createTitle.trim()) { toast.error('请输入作品名称'); return; }
    if (!selectedFile) { toast.error('请选择TXT文件'); return; }
    setActionLoading(true);
    setActionError('');
    try {
      // Step 1: create novel
      const createRes = await api.post('/admin/novel', {
        title: createTitle.trim(),
        author: createAuthor.trim() || null,
        contentType: Number(createType),
      });
      if (createRes.data.code === 200) {
        const newId = createRes.data.data.id;
        // Step 2: upload + parse
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('novelId', newId);
        const uploadRes = await api.post('/admin/novel/import/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes.data.code === 200) {
          toast.success(`「${createTitle.trim()}」创建成功，TXT 解析完成`);
          resetCreate();
          fetchNovels();
        }
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该作品？')) return;
    try {
      const res = await api.delete(`/admin/novel/${id}`);
      if (res.data.code === 200) {
        toast.success('已删除');
        fetchNovels();
      }
    } catch { /* handled */ }
  };

  const typeLabel = (t: number) => ['小说', '动漫', '漫画'][t] || '未知';
  const statusLabel = (s: number) => s === 1 ? '已发布' : '草稿';
  const parseLabel = (s: number) => ['未解析', '解析中', '已完成'][s] || '未知';
  const isNovel = createType === '0';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">作品管理</h2>
        <Button onClick={() => { resetCreate(); setShowCreate(true); }}>
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
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/import`)} title="导入">
                      <UploadIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/nodes`)} title="节点编辑">
                      <GitBranchIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/events`)} title="事件管理">
                      <ZapIcon className="size-4" />
                    </Button>
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

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetCreate(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建作品</DialogTitle>
            <DialogDescription>输入作品信息，选择导入方式</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">作品名称 *</label>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="输入作品名称"
                disabled={actionLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">作者</label>
              <Input
                value={createAuthor}
                onChange={(e) => setCreateAuthor(e.target.value)}
                placeholder="原作者（可选）"
                disabled={actionLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">类型</label>
              <select
                value={createType}
                onChange={(e) => { setCreateType(e.target.value); setSelectedFile(null); }}
                disabled={actionLoading}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs disabled:opacity-50"
              >
                <option value="0">小说</option>
                <option value="1">动漫</option>
                <option value="2">漫画</option>
              </select>
            </div>

            <div className="pt-3 border-t space-y-3">
              <p className="text-xs text-muted-foreground">
                {isNovel ? '小说可选择 AI 生成或上传 TXT 文件两种方式：' : '动漫/漫画将通过 AI 直接生成故事框架。'}
              </p>

              {/* AI Generate — all types */}
              <button
                type="button"
                onClick={handleLlmCreate}
                disabled={actionLoading || !createTitle.trim()}
                className="w-full flex items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {actionLoading ? (
                  <Loader2Icon className="size-5 animate-spin shrink-0" />
                ) : (
                  <SparklesIcon className="size-5 shrink-0 text-primary" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">AI 智能生成</div>
                  <div className="text-xs text-muted-foreground">
                    {isNovel ? '输入名称，AI 生成故事框架并创建' : 'AI 根据知识生成故事框架，查不到则提示未找到'}
                  </div>
                </div>
              </button>

              {/* TXT Upload — 小说 only */}
              {isNovel && (
                <div
                  onClick={() => !actionLoading && fileInputRef.current?.click()}
                  className={`w-full flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-4 text-left text-sm transition-colors cursor-pointer
                    ${selectedFile
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                    } disabled:opacity-50`}
                >
                  <FileUpIcon className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    {selectedFile ? (
                      <div>
                        <div className="font-medium text-primary">{selectedFile.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(0)} KB — 点击确认上传并解析
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">上传 TXT 文件</div>
                        <div className="text-xs text-muted-foreground">选择小说 TXT 文件，AI 自动解析创建</div>
                      </div>
                    )}
                  </div>
                  {selectedFile ? (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleTxtCreate(); }} disabled={actionLoading}>
                      {actionLoading ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircleIcon className="size-4" />}
                    </Button>
                  ) : (
                    <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}
            </div>

            {actionError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <XCircleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{actionError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetCreate} disabled={actionLoading}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
