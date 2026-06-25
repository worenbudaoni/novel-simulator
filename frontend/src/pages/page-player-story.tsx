import { useEffect, useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { useStory } from '@/hooks/useStory';
import { useSSE } from '@/hooks/useSSE';
import ChoicePanel from 'src/components/ChoicePanel';
import StoryViewer from 'src/components/StoryViewer';
import WheelOfFortune from 'src/components/WheelOfFortune';
import CharacterPanel from 'src/components/CharacterPanel';
import { ArrowLeftIcon, SaveIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import EndingModal from 'src/components/EndingModal';
import SaveLoadModal from 'src/components/SaveLoadModal';

export default function PlayerStoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, character, currentNode, currentOptions, loading, loadSession, saveSession, restartSession, chooseAction, spinAction } = useStory();
  const { streaming, connect } = useSSE();
  const [storyText, setStoryText] = useState('');
  const [actionDisabled, setActionDisabled] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [pendingSpin, setPendingSpin] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [showEnding, setShowEnding] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [lastEventDesc, setLastEventDesc] = useState('');
  const pendingWheelRef = useRef(false);

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (session?.storyText) setStoryText(session.storyText);
  }, [session?.storyText]);

  // 到达结局节点时弹出结局
  useEffect(() => {
    if (currentNode?.isEnd && !streaming && storyText) {
      setShowEnding(true);
      setActionDisabled(true);
    }
  }, [currentNode?.isEnd, streaming]);

  // 触发 SSE 故事流
  // displayDesc: 展示在故事区的文字（选择/事件的完整内容）
  // sseDesc: 传给后端的简短标记（为空时后端从 Redis 读取事件内容）
  const triggerStory = useCallback((sid: string, displayDesc?: string, sseDesc?: string) => {
    // 追加选择/事件描述到故事区，不覆盖已有内容
    if (displayDesc) {
      setStoryText(prev => prev + '\n\n---\n\n' + displayDesc + '\n\n');
    }
    setPendingSessionId(sid);
    setLastEventDesc(displayDesc || '');
    connect(sid, {
      onStory: (text) => {
        // flushSync 强制立即渲染，避免 React 18 批处理合并 SSE 段落
        flushSync(() => {
          setStoryText(prev => prev + text + '\n\n');
        });
      },
      onDone: () => {
        setPendingSessionId(null);
        setPendingSpin(false);
        setShowWheel(false);
        // 如果等待转盘，故事完成后显示转盘
        if (pendingWheelRef.current) {
          pendingWheelRef.current = false;
          setShowWheel(true);
        } else {
          setActionDisabled(false);
        }
      },
      onError: (msg) => { toast.error(msg); setActionDisabled(false); setPendingSpin(false); setShowWheel(false); setPendingSessionId(null); },
    }, sseDesc);  // 传短的标记给 SSE URL
  }, [connect]);

  // 选择选项
  const handleChoose = async (optionId: number) => {
    setActionDisabled(true);
    try {
      const result = await chooseAction(optionId);
      if (!sessionId) return;

      // 用户可见的选择描述
      const choiceLabel = result?.chosenOption?.label || '做出了选择';

      // 解析设置，判断转盘是否在本轮选择后触发
      if (session?.settingsJson) {
        try {
          const settings = JSON.parse(session.settingsJson);
          const rate = settings.randomRate || 0;
          pendingWheelRef.current = Math.random() * 100 < rate;
        } catch { /* ignore */ }
      }

      // 先生成选择后的故事（选择描述同时用于展示和 SSE）
      triggerStory(sessionId, choiceLabel, choiceLabel);
    } catch { setActionDisabled(false); }
  };

  // 转盘抽奖
  const handleSpin = async () => {
    setPendingSpin(true);
    try {
      const result = await spinAction();
      // 等转盘动画播完（CSS transition 1s + 留白），再关闭转盘、触发故事
      await new Promise(r => setTimeout(r, 1500));
      // displayDesc: 展示在故事区；sseDesc: 只传标题给 SSE，完整事件内容从 Redis 读取
      const displayDesc = result?.eventTitle
        ? result.eventTitle + '！' + (result.eventDescription || '')
        : (result?.eventDescription || '');
      const sseDesc = result?.eventTitle || '';
      setShowWheel(false);
      if (sessionId) {
        triggerStory(sessionId, displayDesc, sseDesc);
      }
    } catch { setPendingSpin(false); setActionDisabled(false); }
  };


  const handleSave = async () => {
    await saveSession();
    toast.success('存档成功');
  };

  if (loading || !session) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-20 bg-muted rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-lg" />
            <div className="space-y-2">
              <div className="h-12 bg-muted rounded-lg" />
              <div className="h-12 bg-muted rounded-lg" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/player')}>
          <ArrowLeftIcon className="size-4 mr-1" /> 返回
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSaveLoad(true)} disabled={actionDisabled}>
            <SaveIcon className="size-4 mr-1" /> 存档
          </Button>
          <Button variant="outline" size="sm" onClick={async () => { await restartSession(); setStoryText(''); }} disabled={actionDisabled}>
            <RotateCcwIcon className="size-4 mr-1" /> 重新开始
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          {currentNode && (
            <div>
              <h3 className="text-lg font-semibold">{currentNode.title}</h3>
              {currentNode.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentNode.description}</p>
              )}
            </div>
          )}

          <StoryViewer
            text={storyText}
            streaming={streaming}
            placeholder={session.storyText ? '继续你的冒险...' : '故事即将开始...'}
          />

          {!streaming && currentOptions.length > 0 && !showWheel && (
            <ChoicePanel
              options={currentOptions.map(o => ({
                id: o.id,
                label: o.label,
                minIntelligence: o.minIntelligence,
                minCharm: o.minCharm,
              }))}
              disabled={actionDisabled}
              onChoose={handleChoose}
              character={character}
            />
          )}
        </div>

        <div className="space-y-3">
          <CharacterPanel character={character} loading={loading} />
        </div>
      </div>

      {/* 转盘弹窗 */}
      {showWheel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-w-sm w-full mx-4">
            <WheelOfFortune onSpin={handleSpin} disabled={pendingSpin} spinning={pendingSpin} />
            <div className="flex justify-center mt-3">
            </div>
          </div>
        </div>
      )}

      {/* 结局弹窗 */}
      {showEnding && (
        <EndingModal
          nodeTitle={currentNode?.title || '结局'}
          nodeDescription={currentNode?.description}
          storyText={storyText}
          onClose={() => setShowEnding(false)}
          character={character ? {
            hp: character.hp,
            attack: character.attack,
            defense: character.defense,
            intelligence: character.intelligence,
            charm: character.charm,
            luck: character.luck,
            choicesMade: character.choicesMade,
            eventsTriggered: character.eventsTriggered,
            currentTitle: character.currentTitle,
          } : null}
          onRestart={async () => { setShowEnding(false); await restartSession(); setStoryText(''); }}
          onBackToHome={() => navigate('/player')}
        />
      )}

      {/* 存档管理弹窗 */}
      <SaveLoadModal
        open={showSaveLoad}
        onClose={() => setShowSaveLoad(false)}
      />
    </div>
  );
}
