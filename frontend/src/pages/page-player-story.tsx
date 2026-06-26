import { useEffect, useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { useStory } from '@/hooks/useStory';
import { useSSE } from '@/hooks/useSSE';
import ChoicePanel from 'src/components/ChoicePanel';
import StoryViewer from 'src/components/StoryViewer';
import ResolutionDisplay from 'src/components/ResolutionDisplay';
import CharacterPanel from 'src/components/CharacterPanel';
import api from '@/hooks/useApi';
import type { ChoiceOption, ResolutionResult } from '@/types';
import { ArrowLeftIcon, SaveIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import EndingModal from 'src/components/EndingModal';
import SaveLoadModal from 'src/components/SaveLoadModal';

export default function PlayerStoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, character, currentNode, currentOptions, loading, loadSession,
          saveSession, restartSession, resolveAction, generateOptions } = useStory();
  const { streaming, connect } = useSSE();
  const [storyText, setStoryText] = useState('');
  const [actionDisabled, setActionDisabled] = useState(false);
  const [resolution, setResolution] = useState<ResolutionResult | null>(null);
  const [showResolution, setShowResolution] = useState(false);
  const [showEnding, setShowEnding] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const pendingDeathRef = useRef(false);
  const [showMobileChar, setShowMobileChar] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

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

  // 到达节点后自动生成选项
  useEffect(() => {
    if (currentNode && session?.sessionId && !loading) {
      generateOptions(currentNode.id).catch(() => {
        toast.error('选项生成失败，请检查 LLM 配置后重试');
      });
    }
  }, [currentNode?.id, session?.sessionId, loading]);

  // 触发 SSE 故事流
  const triggerStory = useCallback((sid: string, res?: ResolutionResult) => {
    if (res?.isDead) {
      pendingDeathRef.current = true;
    }

    const displayDesc = res?.eventTitle
      ? res.eventTitle + '！' + (res.eventContent || '')
      : '';

    if (displayDesc) {
      setStoryText(prev => prev + '\n\n---\n\n' + displayDesc + '\n\n');
    }

    setPendingSessionId(sid);
    connect(sid, {
      onStory: (text) => {
        flushSync(() => {
          setStoryText(prev => prev + text + '\n\n');
        });
      },
      onDone: () => {
        setPendingSessionId(null);
        if (pendingDeathRef.current) {
          pendingDeathRef.current = false;
          setIsDead(true);
          setShowEnding(true);
          setActionDisabled(true);
          return;
        }
        setActionDisabled(false);
      },
      onError: (msg) => {
        toast.error(msg);
        setActionDisabled(false);
        setPendingSessionId(null);
      },
    });
  }, [connect]);

  // resolve 处理
  const handleResolve = async (option: ChoiceOption) => {
    setActionDisabled(true);
    try {
      const result = await resolveAction(option);
      if (!result) { setActionDisabled(false); return; }

      setResolution(result);
      setShowResolution(true);

      // 根据风险等级设定自动推进延迟
      const delay = option.riskLevel === 'safe' ? 1500
                  : option.riskLevel === 'risky' ? 2500
                  : 3000;

      setTimeout(() => {
        setShowResolution(false);
        if (sessionId) triggerStory(sessionId, result);
      }, delay);
    } catch {
      setActionDisabled(false);
    }
  };

  // 从 resolution 过渡到 story 后的继续
  const handleContinue = () => {
    setShowResolution(false);
    if (resolution && sessionId) {
      triggerStory(sessionId, resolution);
    }
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
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_220px]">
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
    <div className="max-w-3xl mx-auto px-2 sm:px-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/player')}>
          <ArrowLeftIcon className="size-4 mr-1" />
          <span className="hidden sm:inline">返回</span>
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

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          {currentNode && (
            <div>
              <h3 className="text-lg font-semibold">{currentNode.title}</h3>
              {currentNode.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentNode.description}</p>
              )}
            </div>
          )}

          {/* 检定结果展示 */}
          {showResolution && resolution && (
            <ResolutionDisplay result={resolution} onContinue={handleContinue} />
          )}

          {/* 故事阅读 */}
          {!showResolution && (
            <StoryViewer
              text={storyText}
              streaming={streaming}
              placeholder={session.storyText ? '继续你的冒险...' : '故事即将开始...'}
            />
          )}

          {/* 选项面板 */}
          {!streaming && !showResolution && currentOptions.length > 0 && (
            <ChoicePanel
              options={currentOptions}
              disabled={actionDisabled}
              onChoose={handleResolve}
            />
          )}
        </div>

        <div className="hidden lg:block space-y-3">
          <CharacterPanel
            character={character}
            loading={loading}
            attrChanges={resolution?.attrChanges}
          />
        </div>
      </div>

      {/* 移动端角色面板触发按钮 */}
      <button
        type="button"
        onClick={() => setShowMobileChar(true)}
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center lg:hidden"
      >
        <span className="text-lg">📊</span>
      </button>

      {/* 移动端角色面板 Drawer */}
      {showMobileChar && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden" onClick={() => setShowMobileChar(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-background rounded-t-xl p-4 animate-in slide-in-from-bottom duration-200 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
            <CharacterPanel character={character} loading={loading} attrChanges={resolution?.attrChanges} />
            <button
              type="button"
              onClick={() => setShowMobileChar(false)}
              className="w-full mt-3 text-sm text-muted-foreground py-2 hover:text-foreground transition-colors"
            >关闭</button>
          </div>
        </div>
      )}

      {/* 结局弹窗 */}
      {showEnding && (
        <EndingModal
          isDeath={isDead}
          nodeTitle={isDead ? '你的冒险在这里结束了' : (currentNode?.title || '结局')}
          nodeDescription={isDead ? '角色已经死亡，冒险到此为止。' : currentNode?.description}
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
          onRestart={async () => { setShowEnding(false); setIsDead(false); await restartSession(); setStoryText(''); }}
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
