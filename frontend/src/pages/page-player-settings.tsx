import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'src/components/ui/card';
import { Label } from 'src/components/ui/label';
import { Input } from 'src/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useStory } from '@/hooks/useStory';
import api from '@/hooks/useApi';
import { Loader2Icon, ArrowLeftIcon } from 'lucide-react';

export default function PlayerSettingsPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createSession } = useStory();

  const [novel, setNovel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const [randomRate, setRandomRate] = useState(50);
  const [deathRate, setDeathRate] = useState(30);
  const [llmUrl, setLlmUrl] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [llmModel, setLlmModel] = useState('');

  useEffect(() => {
    if (!novelId) return;
    api.get(`/player/novel/${novelId}/full`).then(res => {
      if (res.data.code === 200) setNovel(res.data.data.novel);
    }).finally(() => setLoading(false));
  }, [novelId]);

  const handleStart = async () => {
    if (!novelId) return;
    setStarting(true);
    try {
      const sessionData = await createSession(Number(novelId));
      if (sessionData?.session?.sessionId) {
        await api.post('/player/session/settings', {
          sessionId: sessionData.session.sessionId,
          settings: { randomRate, deathRate, llmUrl, llmKey, llmModel },
        });
        navigate(`/player/story/${sessionData.session.sessionId}`);
      }
    } catch (e: any) {
      // handled by interceptor
    } finally { setStarting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/player')} className="mb-4">
        <ArrowLeftIcon className="size-4 mr-1" /> 返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{novel?.title || '开始冒险'}</CardTitle>
          <CardDescription>配置冒险参数后开始</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>随机事件概率 ({randomRate}%)</Label>
            <input type="range" min={0} max={100} value={randomRate}
              onChange={e => setRandomRate(Number(e.target.value))}
              className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground">做选择时触发随机事件的概率</p>
          </div>

          <div className="space-y-2">
            <Label>死亡率 ({deathRate}%)</Label>
            <input type="range" min={0} max={100} value={deathRate}
              onChange={e => setDeathRate(Number(e.target.value))}
              className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground">负面事件中角色死亡的概率</p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">LLM 配置（可选）</Label>
            <Input placeholder="API 地址" value={llmUrl} onChange={e => setLlmUrl(e.target.value)} />
            <Input placeholder="API Key" type="password" value={llmKey} onChange={e => setLlmKey(e.target.value)} />
            <Input placeholder="模型名称" value={llmModel} onChange={e => setLlmModel(e.target.value)} />
          </div>

          {!user && (
            <p className="text-xs text-amber-600 text-center">
              当前为游客模式，退出后存档不可恢复
            </p>
          )}

          <Button onClick={handleStart} disabled={starting} className="w-full" size="lg">
            {starting ? <><Loader2Icon className="size-4 animate-spin mr-2" /> 准备中...</> : '开始冒险'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
