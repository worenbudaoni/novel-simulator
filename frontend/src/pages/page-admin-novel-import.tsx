import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Badge } from 'src/components/ui/badge';
import { Separator } from 'src/components/ui/separator';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import { ArrowLeftIcon, UploadIcon, SparklesIcon, Loader2Icon, CheckCircleIcon, BookOpenIcon } from 'lucide-react';

interface NovelInfo {
  id: number;
  title: string;
  author: string;
  contentType: number;
  status: number;
  parseStatus: number;
  worldView?: string;
}

export default function AdminNovelImportPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Name import state
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [contentType, setContentType] = useState('0');
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<any>(null);

  // TXT upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  useEffect(() => {
    if (novelId) {
      setLoading(true);
      api.get(`/admin/novel/${novelId}`).then(res => {
        if (res.data.code === 200) {
          setNovel(res.data.data.novel);
        }
      }).finally(() => setLoading(false));
    }
  }, [novelId]);

  const handleGenerate = async () => {
    if (!name.trim()) { toast.error('请输入作品名称'); return; }
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await api.post('/admin/novel/import/name', {
        name: name.trim(),
        author: author.trim() || undefined,
        contentType: Number(contentType),
      });
      if (res.data.code === 200) {
        setGenerateResult(res.data.data);
        setNovel(res.data.data.novel);
        toast.success('生成成功');
      }
    } catch { /* handled */ }
    setGenerating(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('请选择文件'); return; }
    if (!novelId) { toast.error('作品ID缺失'); return; }
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('novelId', novelId);
      const res = await api.post('/admin/novel/import/upload', formData);
      if (res.data.code === 200) {
        setUploadResult(res.data.data);
        setNovel(res.data.data.novel);
        toast.success('上传解析成功');
      }
    } catch { /* handled */ }
    setUploading(false);
  };

  const renderParsePreview = (parseResult: any) => {
    if (!parseResult) return null;
    return (
      <Card className="mt-6 border-green-200 bg-green-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="size-5 text-green-600" />
            <CardTitle className="text-base">解析结果预览</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {parseResult.worldView && (
            <div>
              <h4 className="text-sm font-medium mb-1 text-muted-foreground">世界观</h4>
              <p className="text-sm bg-white rounded-md border p-3 whitespace-pre-wrap">
                {String(parseResult.worldView).slice(0, 500)}
              </p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-md border p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                {(parseResult.nodes as any[])?.length || 0}
              </div>
              <div className="text-muted-foreground text-xs mt-1">节点</div>
            </div>
            <div className="bg-white rounded-md border p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                {(parseResult.edges as any[])?.length || 0}
              </div>
              <div className="text-muted-foreground text-xs mt-1">连接</div>
            </div>
            <div className="bg-white rounded-md border p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                {(parseResult.events as any[])?.length || 0}
              </div>
              <div className="text-muted-foreground text-xs mt-1">事件</div>
            </div>
          </div>
          {parseResult.nodes && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">节点列表</h4>
              <div className="space-y-1.5">
                {(parseResult.nodes as any[]).map((n: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-white rounded border px-3 py-1.5">
                    <span className="text-muted-foreground w-6 text-right">#{idx + 1}</span>
                    <span className="font-medium">{n.title}</span>
                    {n.isStart && <Badge variant="default" className="text-[10px] h-4 px-1">起点</Badge>}
                    {n.isEnd && <Badge variant="secondary" className="text-[10px] h-4 px-1">结局</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">
            {novelId ? '导入作品内容' : '新建并导入作品'}
          </h2>
          {novel && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <BookOpenIcon className="size-3" />
              {novel.title}
              {novel.author ? ` / ${novel.author}` : ''}
              {novel.parseStatus === 2 && (
                <Badge variant="outline" className="text-green-600 ml-1">已解析</Badge>
              )}
            </p>
          )}
        </div>
      </div>

      {!novelId && (
        /* Import by Name — creates novel + generates framework */
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SparklesIcon className="size-4" /> 直接输入作品名称
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI 将根据其知识直接生成该作品的故事框架，无需上传文件。
            </p>
            <div className="flex gap-3">
              <div className="w-36">
                <Select value={contentType} onValueChange={setContentType}>
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
              <Input
                placeholder="输入作品名称（如：三体、鬼灭之刃）"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                className="flex-1"
              />
              <Input
                placeholder="原作者（可选，辅助精准搜索）"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                className="w-48"
              />
              <Button onClick={handleGenerate} disabled={generating || !name.trim()}>
                {generating ? (
                  <><Loader2Icon className="size-4 animate-spin mr-1" /> 生成中...</>
                ) : (
                  <><SparklesIcon className="size-4 mr-1" /> 生成框架</>
                )}
              </Button>
            </div>

            {generateResult && renderParsePreview(generateResult.parseResult)}
          </CardContent>
        </Card>
      )}

      {novelId && (
        /* TXT Upload — requires existing novel */
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UploadIcon className="size-4" /> TXT 文件上传
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              上传小说 TXT 文件，AI 将自动解析内容为故事框架。
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                {uploading ? (
                  <><Loader2Icon className="size-4 animate-spin mr-1" /> 上传解析中...</>
                ) : (
                  <><UploadIcon className="size-4 mr-1" /> 上传并解析</>
                )}
              </Button>
            </div>
            {selectedFile && !uploadResult && !uploading && (
              <p className="text-xs text-muted-foreground">
                已选择: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
            {uploadResult && renderParsePreview(uploadResult.parseResult)}
          </CardContent>
        </Card>
      )}

      {!novelId && generateResult?.novel && (
        <div className="mt-4 flex justify-center">
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => {
              setGenerateResult(null);
              setName('');
            }}>
              继续新建
            </Button>
            <Button onClick={() => navigate('/admin')}>
              返回作品列表
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
