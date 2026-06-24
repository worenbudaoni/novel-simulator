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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from 'src/components/ui/sheet';
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
  const [nodeCount, setNodeCount] = useState(5);
  const [eventCount, setEventCount] = useState(8);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<'llm' | 'txt'>('llm');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('nodes');
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null);
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
    setConfirmOpen(false);
    setPreviewResult(null);
    setNodeCount(5);
    setEventCount(8);
  };

  const handlePreviewLlm = async () => {
    if (!createTitle.trim()) { toast.error('请输入作品名称'); return; }
    setPreviewLoading(true);
    setActionError('');
    try {
      const res = await api.post('/admin/novel/import/preview', {
        name: createTitle.trim(),
        contentType: Number(createType),
        nodeCount,
        eventCount,
      });
      if (res.data.code === 200) {
        const data = res.data.data;
        if (!data.found) {
          setActionError(data.message || '未找到作品信息');
          setPreviewLoading(false);
          return;
        }
        setPreviewResult(data.result);
        setConfirmType('llm');
        setConfirmOpen(true);
      }
      setPreviewLoading(false);
    } catch { /* handled */
      setPreviewLoading(false);
    }
  };

  const handleConfirmLlm = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/admin/novel/import/name', {
        name: createTitle.trim(),
        contentType: Number(createType),
        nodeCount,
        eventCount,
      });
      if (res.data.code === 200) {
        const data = res.data.data;
        const count = (data.parseResult?.nodes as any[])?.length || 0;
        toast.success(`「${data.novel.title}」创建成功，${count} 个节点`);
        resetCreate();
        fetchNovels();
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleSelectFile = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setPreviewResult(null);
      setConfirmType('txt');
      setConfirmOpen(true);
    }
  };

  const handleConfirmTxt = async () => {
    if (!selectedFile) return;
    setActionLoading(true);
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
          toast.success(`「${createTitle.trim()}」创建成功，TXT 解析完成`);
          resetCreate();
          fetchNovels();
        }
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/admin/novel/${deleteTarget.id}`);
      if (res.data.code === 200) {
        toast.success('已删除');
        setDeleteTarget(null);
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
                    {n.parseStatus !== 2 && (
                      <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/import`)} title="导入">
                        <UploadIcon className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/nodes`)} title="节点编辑">
                      <GitBranchIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/events`)} title="事件管理">
                      <ZapIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(n)}>
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

      {/* Create Sheet — slides in from right */}
      <Sheet open={showCreate} onOpenChange={(open) => { if (!open) resetCreate(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-6 pt-6 pb-0 shrink-0">
              <SheetTitle>新建作品</SheetTitle>
              <SheetDescription>输入作品信息，选择导入方式</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">作品名称 *</label>
                  <Input
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="输入作品名称"
                    disabled={actionLoading}
                  />
                </div>
                <div className="space-y-1.5">
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
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">作者</label>
                <Input
                  value={createAuthor}
                  onChange={(e) => setCreateAuthor(e.target.value)}
                  placeholder="原作者（可选）"
                  disabled={actionLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">生成节点数</label>
                  <span className="text-sm font-mono text-primary font-bold tabular-nums">{nodeCount}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={nodeCount}
                  onChange={e => setNodeCount(Number(e.target.value))}
                  disabled={actionLoading}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>最少 3</span>
                  <span>默认 5</span>
                  <span>最多 20</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">生成事件数</label>
                  <span className="text-sm font-mono text-primary font-bold tabular-nums">{eventCount}</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={15}
                  value={eventCount}
                  onChange={e => setEventCount(Number(e.target.value))}
                  disabled={actionLoading}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>最少 5</span>
                  <span>默认 {eventCount}</span>
                  <span>最多 15</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {isNovel ? '选择导入方式：' : '动漫/漫画将通过 AI 直接生成故事框架。'}
                </p>

                <button
                  type="button"
                  onClick={handlePreviewLlm}
                  disabled={previewLoading || !createTitle.trim()}
                  className="w-full flex items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  {previewLoading ? (
                    <Loader2Icon className="size-5 animate-spin shrink-0" />
                  ) : (
                    <SparklesIcon className="size-5 shrink-0 text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{previewLoading ? 'AI 查询中...' : 'AI 智能生成'}</div>
                    <div className="text-xs text-muted-foreground">
                      {isNovel ? '输入名称，AI 生成故事框架' : 'AI 根据知识生成故事框架，查不到则提示未找到'}
                    </div>
                  </div>
                </button>

                {isNovel && (
                  <div
                    onClick={() => { if (!actionLoading) fileInputRef.current?.click(); }}
                    className="w-full flex items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 px-4 py-4 text-left text-sm transition-colors cursor-pointer"
                  >
                    <FileUpIcon className="size-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">上传 TXT 文件</div>
                      <div className="text-xs text-muted-foreground">选择小说 TXT 文件，确认后 AI 自动解析创建</div>
                    </div>
                    <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
                    <input ref={fileInputRef} type="file" accept=".txt" className="hidden"
                      onChange={(e) => handleSelectFile(e.target.files?.[0] || null)} />
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

            <SheetFooter className="px-6 pb-6 pt-2 shrink-0">
              <Button variant="outline" onClick={resetCreate} disabled={actionLoading} className="w-full">取消</Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm Dialog — preview before create */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open && !actionLoading) setConfirmOpen(false); }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {confirmType === 'llm' ? 'AI 解析预览' : '上传确认'}
            </DialogTitle>
            <DialogDescription>
              {confirmType === 'llm'
                ? '确认以下 AI 解析结果，点击确认创建作品'
                : `确认上传「${selectedFile?.name}」并让 AI 解析创建`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {confirmType === 'llm' && previewResult && (
              <>
                {previewResult.worldView && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">世界观</h4>
                    <div className="text-xs bg-muted/50 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {String(previewResult.worldView)}
                    </div>
                  </div>
                )}
                {/* Stat cards — clickable, horizontal grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'nodes', label: '节点', data: previewResult.nodes as any[] },
                    { key: 'edges', label: '连接', data: previewResult.edges as any[] },
                    { key: 'events', label: '事件', data: previewResult.events as any[] },
                  ].map(section => {
                    const count = section.data?.length || 0;
                    const isOpen = expandedSection === section.key;
                    return (
                      <div key={section.key} className="text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedSection(isOpen ? null : section.key)}
                          className={`w-full rounded-lg p-3 text-center transition-colors cursor-pointer hover:bg-accent ${
                            isOpen ? 'bg-accent ring-1 ring-ring' : 'bg-muted/30'
                          }`}
                        >
                          <div className="font-bold text-lg text-primary">{count}</div>
                          <div className="text-xs text-muted-foreground">{section.label}</div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded detail panels */}
                {expandedSection === 'nodes' && previewResult.nodes && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                    {(previewResult.nodes as any[]).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">无节点数据</p>
                    ) : (previewResult.nodes as any[]).map((n: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
                        <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">#{i + 1}</span>
                        <span className="font-medium truncate">{n.title}</span>
                        {n.isStart && <Badge className="text-[9px] h-3.5 px-1 shrink-0">起点</Badge>}
                        {n.isEnd && <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">结局</Badge>}
                      </div>
                    ))}
                  </div>
                )}
                {expandedSection === 'edges' && previewResult.edges && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                    {(previewResult.edges as any[]).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">无连接数据</p>
                    ) : (previewResult.edges as any[]).map((e: any, i: number) => {
                      const nodes = previewResult.nodes as any[] || [];
                      const src = nodes[e.sourceNodeIndex]?.title || `#${e.sourceNodeIndex}`;
                      const tgt = nodes[e.targetNodeIndex]?.title || `#${e.targetNodeIndex}`;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
                          <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">#{i + 1}</span>
                          <span className="text-muted-foreground">{src} → {tgt}</span>
                          {e.conditionDesc && <span className="text-[10px] text-muted-foreground ml-auto">({e.conditionDesc})</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {expandedSection === 'events' && previewResult.events && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                    {(previewResult.events as any[]).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">无事件数据</p>
                    ) : (previewResult.events as any[]).map((ev: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
                        <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">#{i + 1}</span>
                        <span className="truncate">{ev.title}</span>
                        <span className={`text-[10px] shrink-0 ${
                          ev.eventType === 0 ? 'text-green-600' : ev.eventType === 1 ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          [{['正面','负面','中立'][ev.eventType] || '中立'}]
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {confirmType === 'txt' && selectedFile && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
                <FileTextIcon className="size-8 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{selectedFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={actionLoading}>
              取消
            </Button>
            <Button
              onClick={confirmType === 'llm' ? handleConfirmLlm : handleConfirmTxt}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <><Loader2Icon className="size-4 animate-spin mr-1" /> 创建中...</>
              ) : (
                <><CheckCircleIcon className="size-4 mr-1" /> 确认创建</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.title}」？此操作不可撤销，作品下的所有节点、事件数据将一并删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2Icon className="size-4 mr-1" /> 删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
