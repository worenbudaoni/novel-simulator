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
  PlusIcon, SearchIcon, Trash2Icon, UploadIcon, GitBranchIcon, ZapIcon, PencilIcon,
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
  nodeCount: number;
  eventCount: number;
  createdAt: string;
}

export default function AdminNovelsPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
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
  const [txtPreviewResult, setTxtPreviewResult] = useState<any>(null);
  const [txtParsedNovelId, setTxtParsedNovelId] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>('nodes');
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null);
  const [editTarget, setEditTarget] = useState<Novel | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editType, setEditType] = useState(0);
  const [editStatus, setEditStatus] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const navigate = useNavigate();

  const fetchNovels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/novel/list', { params: { page, size: 10, keyword } });
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
    setTxtPreviewResult(null);
    setTxtParsedNovelId(null);
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
    if (!createTitle.trim()) { toast.error('请输入作品名称'); setActionLoading(false); return; }
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
      // Default title from filename if empty
      if (!createTitle.trim()) {
        const name = file.name.replace(/\.[^.]+$/, '');
        setCreateTitle(name);
      }
      setPreviewResult(null);
      setConfirmType('txt');
      setConfirmOpen(true);
    }
  };

  const handlePreviewTxt = async () => {
    if (!selectedFile) return;
    if (!createTitle.trim()) { toast.error('请输入作品名称'); return; }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('nodeCount', String(nodeCount));
      formData.append('eventCount', String(eventCount));
      const res = await api.post('/admin/novel/import/preview-upload', formData);
      if (res.data.code === 200) {
        setTxtPreviewResult(res.data.data.parseResult);
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleConfirmTxt = async () => {
    if (!selectedFile) return;
    if (!createTitle.trim()) { toast.error('请输入作品名称'); return; }
    setActionLoading(true);
    try {
      // Create novel
      const createRes = await api.post('/admin/novel', {
        title: createTitle.trim(),
        author: createAuthor.trim() || null,
        contentType: Number(createType),
      });
      if (createRes.data.code === 200) {
        const newId = createRes.data.data.id;
        // Upload + parse + save
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('novelId', newId);
        formData.append('nodeCount', String(nodeCount));
        formData.append('eventCount', String(eventCount));
        const uploadRes = await api.post('/admin/novel/import/upload', formData);
        if (uploadRes.data.code === 200) {
          const count = (uploadRes.data.data.parseResult?.nodes as any[])?.length || 0;
          toast.success(`「${createTitle.trim()}」创建成功，${count} 个节点`);
          resetCreate();
          fetchNovels();
        }
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleCancelTxt = () => {
    setConfirmOpen(false);
    resetCreate();
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

  const handleEditConfirm = async () => {
    if (!editTarget) return;
    if (!editTitle.trim()) { toast.error('作品名称不能为空'); return; }
    setEditSaving(true);
    try {
      const res = await api.put(`/admin/novel/${editTarget.id}`, {
        title: editTitle.trim(),
        author: editAuthor.trim() || null,
        contentType: editType,
        status: editStatus,
      });
      if (res.data.code === 200) {
        toast.success('已更新');
        setEditTarget(null);
        fetchNovels();
      }
    } catch { /* handled */ }
    setEditSaving(false);
  };

  const typeLabel = (t: number) => ['小说', '动漫', '漫画'][t] || '未知';
  const parseLabel = (s: number) => ['未解析', '解析中', '已完成'][s] || '未知';
  const isNovel = createType === '0';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">作品管理</h2>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索作品名称..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setKeyword(searchInput); setPage(1); } }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => { setKeyword(searchInput); setPage(1); }}>
          <SearchIcon className="size-4 mr-1" /> 搜索
        </Button>
        <Button variant="ghost" onClick={() => { setSearchInput(''); setKeyword(''); setPage(1); }}>
          重置
        </Button>
        <div className="ml-auto">
          <Button onClick={() => { resetCreate(); setShowCreate(true); }}>
            <PlusIcon className="size-4 mr-1" /> 新建作品
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>作者</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="text-center w-20">状态</TableHead>
              <TableHead className="text-center">节点</TableHead>
              <TableHead className="text-center">事件</TableHead>
              <TableHead>解析</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">加载中...</TableCell></TableRow>
            ) : novels.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">暂无作品</TableCell></TableRow>
            ) : novels.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="text-muted-foreground">{n.id}</TableCell>
                <TableCell className="font-medium">{n.title}</TableCell>
                <TableCell>{n.author || '-'}</TableCell>
                <TableCell>{typeLabel(n.contentType)}</TableCell>
                <TableCell className="text-center">
                  <button
                    onClick={async () => {
                      const res = await api.put(`/admin/novel/${n.id}`, { status: n.status === 1 ? 0 : 1 });
                      if (res.data.code === 200) fetchNovels();
                    }}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                      n.status === 1
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:bg-muted/50'
                    }`}
                    title={n.status === 1 ? '点击设为失效' : '点击设为生效'}
                  >
                    <span className={`size-1.5 rounded-full ${n.status === 1 ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    {n.status === 1 ? '生效' : '失效'}
                  </button>
                </TableCell>
                <TableCell className="text-center text-sm font-mono">{n.nodeCount ?? '-'}</TableCell>
                <TableCell className="text-center text-sm font-mono">{n.eventCount ?? '-'}</TableCell>
                <TableCell>{parseLabel(n.parseStatus)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{n.createdAt?.slice(0, 10)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditTarget(n); setEditTitle(n.title); setEditAuthor(n.author || ''); setEditType(n.contentType); setEditStatus(n.status); }} title="编辑">
                      <PencilIcon className="size-4" />
                    </Button>
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

      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-muted-foreground">共 {total} 条</span>
        {total > 10 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              上一页
            </Button>
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
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-[32px]"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              );
            })()}
            <Button variant="outline" size="sm" disabled={page * 10 >= total} onClick={() => setPage(p => p + 1)}>
              下一页
            </Button>
          </div>
        )}
        {total <= 10 && total > 0 && (
          <span className="text-muted-foreground text-xs">第 1 页</span>
        )}
      </div>

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
                    disabled={actionLoading || previewLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">类型</label>
                  <select
                    value={createType}
                    onChange={(e) => { setCreateType(e.target.value); setSelectedFile(null); }}
                    disabled={actionLoading || previewLoading}
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
                  disabled={actionLoading || previewLoading}
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
                  disabled={actionLoading || previewLoading}
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
                  disabled={actionLoading || previewLoading}
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
                    onClick={() => { if (!actionLoading && !previewLoading) fileInputRef.current?.click(); }}
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
              <Button variant="outline" onClick={resetCreate} disabled={actionLoading || previewLoading} className="w-full">取消</Button>
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

            {confirmType === 'txt' && selectedFile && !txtPreviewResult && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">作品名称 *</label>
                  <Input
                    value={createTitle}
                    onChange={e => setCreateTitle(e.target.value)}
                    placeholder="输入作品名称"
                    disabled={actionLoading}
                  />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
                  <FileTextIcon className="size-8 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{selectedFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">生成节点数</label>
                      <span className="text-sm font-mono text-primary font-bold tabular-nums">{nodeCount}</span>
                    </div>
                    <input
                      type="range" min={3} max={20} value={nodeCount}
                      onChange={e => setNodeCount(Number(e.target.value))}
                      disabled={actionLoading}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>最少 3</span><span>默认 5</span><span>最多 20</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">生成事件数</label>
                      <span className="text-sm font-mono text-primary font-bold tabular-nums">{eventCount}</span>
                    </div>
                    <input
                      type="range" min={5} max={15} value={eventCount}
                      onChange={e => setEventCount(Number(e.target.value))}
                      disabled={actionLoading}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>最少 5</span><span>默认 8</span><span>最多 15</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {confirmType === 'txt' && txtPreviewResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircleIcon className="size-4" />
                  <span className="text-sm font-medium">解析完成</span>
                </div>

                {txtPreviewResult.worldView && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">世界观</h4>
                    <div className="text-xs bg-muted/50 rounded p-2 max-h-28 overflow-y-auto whitespace-pre-wrap">
                      {String(txtPreviewResult.worldView)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'nodes', label: '节点', data: (txtPreviewResult.nodes || []) as any[] },
                    { key: 'edges', label: '连接', data: (txtPreviewResult.edges || []) as any[] },
                    { key: 'events', label: '事件', data: (txtPreviewResult.events || []) as any[] },
                  ].map(section => {
                    const count = section.data.length;
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

                {expandedSection === 'nodes' && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                    {(txtPreviewResult.nodes as any[]).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">无节点数据</p>
                    ) : (txtPreviewResult.nodes as any[]).map((n: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
                        <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">#{i + 1}</span>
                        <span className="font-medium truncate">{n.title}</span>
                        {n.isStart && <Badge className="text-[9px] h-3.5 px-1 shrink-0">起点</Badge>}
                        {n.isEnd && <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">结局</Badge>}
                      </div>
                    ))}
                  </div>
                )}
                {expandedSection === 'edges' && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                    {(txtPreviewResult.edges as any[]).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">无连接数据</p>
                    ) : (txtPreviewResult.edges as any[]).map((e: any, i: number) => {
                      const nodes = txtPreviewResult.nodes as any[] || [];
                      const src = nodes[e.sourceNodeIndex]?.title || `#${e.sourceNodeIndex}`;
                      const tgt = nodes[e.targetNodeIndex]?.title || `#${e.targetNodeIndex}`;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
                          <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">#{i + 1}</span>
                          <span className="text-muted-foreground">{src} → {tgt}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {expandedSection === 'events' && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                    {(txtPreviewResult.events as any[]).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">无事件数据</p>
                    ) : (txtPreviewResult.events as any[]).map((ev: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1.5">
                        <span className="text-muted-foreground w-5 text-right shrink-0 font-mono">#{i + 1}</span>
                        <span className="truncate">{ev.title}</span>
                        <span className={`text-[10px] shrink-0 ${ev.eventType === 0 ? 'text-green-600' : ev.eventType === 1 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          [{['正面','负面','中立'][ev.eventType] || '中立'}]
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {confirmType === 'llm' && (
              <>
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={actionLoading}>取消</Button>
                <Button onClick={handleConfirmLlm} disabled={actionLoading || !createTitle.trim()}>
                  {actionLoading ? (
                    <><Loader2Icon className="size-4 animate-spin mr-1" /> 创建中...</>
                  ) : (
                    <><CheckCircleIcon className="size-4 mr-1" /> 确认创建</>
                  )}
                </Button>
              </>
            )}
            {confirmType === 'txt' && !txtPreviewResult && (
              <>
                <Button variant="outline" onClick={() => { setConfirmOpen(false); resetCreate(); }} disabled={actionLoading}>取消</Button>
                <Button onClick={handlePreviewTxt} disabled={actionLoading || !createTitle.trim() || !selectedFile}>
                  {actionLoading ? (
                    <><Loader2Icon className="size-4 animate-spin mr-1" /> 解析中...</>
                  ) : (
                    <><SparklesIcon className="size-4 mr-1" /> 解析预览</>
                  )}
                </Button>
              </>
            )}
            {confirmType === 'txt' && txtPreviewResult && (
              <>
                <Button variant="outline" onClick={handleCancelTxt} disabled={actionLoading}>取消删除</Button>
                <Button onClick={handleConfirmTxt} disabled={actionLoading}>
                  <CheckCircleIcon className="size-4 mr-1" /> 确认保存
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑作品</DialogTitle>
            <DialogDescription>修改作品信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">标题 *</label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} disabled={editSaving} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">作者</label>
              <Input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} disabled={editSaving} placeholder="原作者（可选）" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">类型</label>
              <select
                value={editType}
                onChange={e => setEditType(Number(e.target.value))}
                disabled={editSaving}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs disabled:opacity-50"
              >
                <option value={0}>小说</option>
                <option value={1}>动漫</option>
                <option value={2}>漫画</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">状态</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditStatus(1)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${
                    editStatus === 1
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-background border-input text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <span className="size-2 rounded-full bg-green-500" />
                  生效
                </button>
                <button
                  type="button"
                  onClick={() => setEditStatus(0)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${
                    editStatus === 0
                      ? 'bg-muted/50 border-muted-foreground/20 text-muted-foreground'
                      : 'bg-background border-input text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <span className="size-2 rounded-full bg-muted-foreground" />
                  失效
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>取消</Button>
            <Button onClick={handleEditConfirm} disabled={editSaving || !editTitle.trim()}>
              {editSaving ? <><Loader2Icon className="size-4 animate-spin mr-1" /> 保存中...</> : <><CheckCircleIcon className="size-4 mr-1" /> 保存</>}
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
