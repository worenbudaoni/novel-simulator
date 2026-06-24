import { useState, useEffect, useCallback } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Card, CardContent } from 'src/components/ui/card';
import { Badge } from 'src/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from 'src/components/ui/select';
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
  const [creating, setCreating] = useState(false);

  // LLM preview state
  const [previewStep, setPreviewStep] = useState<'form' | 'llm' | 'upload' | 'preview'>('form');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    setPreviewStep('form');
    setPreviewResult(null);
    setPreviewLoading(false);
    setPreviewError('');
    setSelectedFile(null);
  };

  const handlePreviewLlm = async () => {
    if (!createTitle.trim()) { toast.error('请输入作品名称'); return; }
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewResult(null);
    try {
      const res = await api.post('/admin/novel/import/preview', {
        name: createTitle.trim(),
        contentType: Number(createType),
      });
      if (res.data.code === 200) {
        const data = res.data.data;
        if (!data.found) {
          setPreviewError(data.message || '未找到作品信息');
        } else {
          setPreviewResult(data.result);
          setPreviewStep('preview');
        }
      }
    } catch { /* handled */ }
    setPreviewLoading(false);
  };

  const handleUploadAndParse = async () => {
    if (!selectedFile) { toast.error('请选择TXT文件'); return; }
    setPreviewLoading(true);
    setPreviewError('');
    // First create the novel, then upload
    try {
      const createRes = await api.post('/admin/novel', {
        title: createTitle.trim(),
        author: createAuthor.trim() || null,
        contentType: Number(createType),
      });
      if (createRes.data.code === 200) {
        const newId = createRes.data.data.id;
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('novelId', newId);
        const uploadRes = await api.post('/admin/novel/import/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes.data.code === 200) {
          setPreviewResult(uploadRes.data.data.parseResult);
          setPreviewStep('preview');
          toast.success('解析成功');
        }
      }
    } catch { /* handled */ }
    setPreviewLoading(false);
  };

  const handleConfirmCreate = async () => {
    if (!previewResult) return;
    setCreating(true);
    try {
      // Create novel with full data
      const res = await api.post('/admin/novel/import/name', {
        name: createTitle.trim(),
        contentType: Number(createType),
      });
      if (res.data.code === 200) {
        toast.success('创建成功');
        resetCreate();
        fetchNovels();
      }
    } catch { /* handled */ }
    setCreating(false);
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

  const renderParsePreview = (result: any) => {
    if (!result) return null;
    const nodeCount = (result.nodes as any[])?.length || 0;
    const edgeCount = (result.edges as any[])?.length || 0;
    const eventCount = (result.events as any[])?.length || 0;
    return (
      <div className="space-y-3">
        {result.worldView && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">世界观</h4>
            <p className="text-xs bg-muted/50 rounded p-2 line-clamp-3">
              {String(result.worldView).slice(0, 200)}
            </p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-muted/30 rounded p-2">
            <div className="font-bold text-primary">{nodeCount}</div>
            <div className="text-xs text-muted-foreground">节点</div>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <div className="font-bold text-primary">{edgeCount}</div>
            <div className="text-xs text-muted-foreground">连接</div>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <div className="font-bold text-primary">{eventCount}</div>
            <div className="text-xs text-muted-foreground">事件</div>
          </div>
        </div>
        {result.nodes && (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {(result.nodes as any[]).slice(0, 8).map((n: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1">
                <span className="text-muted-foreground w-4 text-right">#{i + 1}</span>
                <span>{n.title}</span>
                {n.isStart && <Badge variant="default" className="text-[9px] h-3.5 px-1">起点</Badge>}
                {n.isEnd && <Badge variant="secondary" className="text-[9px] h-3.5 px-1">结局</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isAnimeOrManga = createType === '1' || createType === '2';

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

      {/* Create Dialog — multi-step with integrated LLM import */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetCreate(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>新建作品</DialogTitle>
            <DialogDescription>
              {previewStep === 'form' && '输入基本信息，选择导入方式'}
              {previewStep === 'preview' && '预览 LLM 解析结果，确认创建'}
            </DialogDescription>
          </DialogHeader>

          {previewStep === 'form' && (
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
                <Select value={createType} onValueChange={setCreateType}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">小说</SelectItem>
                    <SelectItem value="1">动漫</SelectItem>
                    <SelectItem value="2">漫画</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  {isAnimeOrManga
                    ? '动漫/漫画将通过 AI 直接解析生成故事框架'
                    : '小说可通过 AI 智能生成或上传 TXT 文件解析'}
                </p>

                <div className="grid gap-3">
                  {/* LLM Generate Button — for all types */}
                  <Button
                    variant="default"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={handlePreviewLlm}
                    disabled={previewLoading || !createTitle.trim()}
                  >
                    {previewLoading ? (
                      <Loader2Icon className="size-5 animate-spin mr-3 shrink-0" />
                    ) : (
                      <SparklesIcon className="size-5 mr-3 shrink-0" />
                    )}
                    <div className="text-left">
                      <div className="text-sm font-medium">
                        {previewLoading ? 'AI 解析中...' : 'AI 智能生成'}
                      </div>
                      <div className="text-xs opacity-70">
                        {isAnimeOrManga ? 'AI 根据知识直接生成故事框架' : '输入作品名称，AI 生成故事框架'}
                      </div>
                    </div>
                  </Button>

                  {/* TXT Upload — only for 小说 */}
                  {!isAnimeOrManga && (
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <FileUpIcon className="size-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">上传 TXT 文件</p>
                          <p className="text-xs text-muted-foreground">上传小说 TXT，AI 自动解析</p>
                        </div>
                        <label className="cursor-pointer">
                          <span className="text-sm text-primary hover:underline">
                            {selectedFile ? '已选择' : '选择文件'}
                          </span>
                          <input
                            type="file"
                            accept=".txt"
                            className="hidden"
                            onChange={(e) => {
                              setSelectedFile(e.target.files?.[0] || null);
                              if (e.target.files?.[0]) {
                                setPreviewStep('upload');
                              }
                            }}
                          />
                        </label>
                      </div>
                      {selectedFile && (
                        <p className="text-xs text-muted-foreground mt-2">
                          已选: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {previewError && (
                  <div className="flex items-start gap-2 mt-3 p-3 rounded-md bg-amber-50 border border-amber-200">
                    <XCircleIcon className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">{previewError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {previewStep === 'upload' && selectedFile && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                <FileUpIcon className="size-4 text-blue-500" />
                <div className="text-sm text-blue-700">
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-blue-500 ml-2">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">将先创建作品，再上传文件并让 AI 解析内容。</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreviewStep('form')}>返回</Button>
                <Button onClick={handleUploadAndParse} disabled={previewLoading}>
                  {previewLoading ? (
                    <><Loader2Icon className="size-4 animate-spin mr-1" /> 上传解析中...</>
                  ) : (
                    <><UploadIcon className="size-4 mr-1" /> 上传并解析</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {previewStep === 'preview' && previewResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="size-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">AI 解析完成</span>
              </div>
              {renderParsePreview(previewResult)}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { resetCreate(); setShowCreate(true); }}>
                  重新输入
                </Button>
                <Button onClick={handleConfirmCreate} disabled={creating} className="flex-1">
                  {creating ? (
                    <><Loader2Icon className="size-4 animate-spin mr-1" /> 创建中...</>
                  ) : (
                    '确认创建'
                  )}
                </Button>
              </div>
            </div>
          )}

          {previewStep === 'form' && (
            <DialogFooter>
              <Button variant="outline" onClick={resetCreate}>取消</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
