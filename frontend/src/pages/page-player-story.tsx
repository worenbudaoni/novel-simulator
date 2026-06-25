import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Badge } from 'src/components/ui/badge';
import { Card, CardContent } from 'src/components/ui/card';
import { useStory } from '@/hooks/useStory';
import api from '@/hooks/useApi';
import { Loader2Icon, ArrowLeftIcon, SaveIcon, RotateCcwIcon } from 'lucide-react';

export default function PlayerStoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, character, currentNode, currentOptions, loading, loadSession, saveSession, restartSession } = useStory();
  const [fullTree, setFullTree] = useState<any>(null);

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (session?.novelId) {
      api.get(`/player/novel/${session.novelId}/full`).then(res => {
        if (res.data.code === 200) setFullTree(res.data.data);
      });
    }
  }, [session?.novelId]);

  const handleSave = async () => {
    await saveSession();
  };

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/player')}>
          <ArrowLeftIcon className="size-4 mr-1" /> 返回
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <SaveIcon className="size-4 mr-1" /> 存档
          </Button>
          <Button variant="outline" size="sm" onClick={async () => { await restartSession(); }}>
            <RotateCcwIcon className="size-4 mr-1" /> 重新开始
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        {/* 主区域 */}
        <div className="space-y-4">
          {/* 当前节点 */}
          {currentNode && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{currentNode.title}</h3>
                  {currentNode.isEnd && <Badge variant="secondary">结局</Badge>}
                  {currentNode.isStart && <Badge variant="outline">起点</Badge>}
                </div>
                {currentNode.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{currentNode.description}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 故事阅读区（P3-B 实现流式渲染） */}
          <Card>
            <CardContent className="pt-4">
              {session.storyText ? (
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{session.storyText}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  故事即将开始...
                </p>
              )}
            </CardContent>
          </Card>

          {/* 选项面板（P3-B 实现） */}
          {currentOptions.length > 0 && (
            <div className="space-y-2">
              {currentOptions.map(opt => (
                <Button key={opt.id} variant="outline" className="w-full justify-start text-left h-auto py-3 px-4">
                  <span className="text-sm">{opt.label}</span>
                  {opt.riskHint && (
                    <Badge variant="destructive" className="ml-auto text-[10px]">{opt.riskHint}</Badge>
                  )}
                </Button>
              ))}
            </div>
          )}

          {/* 转盘抽奖按钮（P3-B 实现） */}
          <Button variant="secondary" className="w-full" disabled>
            🎰 转盘抽奖（P3-B 实现）
          </Button>
        </div>

        {/* 角色属性侧栏 */}
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <h4 className="text-sm font-semibold">角色属性</h4>
              {character ? (
                <>
                  <AttrRow label="❤️ HP" value={character.hp} />
                  <AttrRow label="⚔️ 攻击" value={character.attack} />
                  <AttrRow label="🛡 防御" value={character.defense} />
                  <AttrRow label="🧠 智力" value={character.intelligence} />
                  <AttrRow label="✨ 魅力" value={character.charm} />
                  <AttrRow label="🍀 运气" value={character.luck} />
                  <div className="text-xs text-muted-foreground pt-1">
                    选择: {character.choicesMade} 次 | 事件: {character.eventsTriggered} 次
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">加载中...</p>
              )}
            </CardContent>
          </Card>

          {/* 节点图入口 */}
          <Button variant="outline" size="sm" className="w-full" disabled>
            🗺️ 节点地图（P3-B 实现）
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'text-green-600' : value >= 40 ? 'text-foreground' : 'text-red-500';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}
