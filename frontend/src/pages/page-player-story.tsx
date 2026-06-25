import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { useStory } from '@/hooks/useStory';
import { useSSE } from '@/hooks/useSSE';
import ChoicePanel from 'src/components/ChoicePanel';
import StoryViewer from 'src/components/StoryViewer';
import WheelOfFortune from 'src/components/WheelOfFortune';
import CharacterPanel from 'src/components/CharacterPanel';
import { Loader2Icon, ArrowLeftIcon, SaveIcon, RotateCcwIcon, MapIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function PlayerStoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, character, currentNode, currentOptions, loading, loadSession, saveSession, restartSession, chooseAction, spinAction } = useStory();
  const { streaming, connect } = useSSE();
  const [storyText, setStoryText] = useState('');
  const [actionDisabled, setActionDisabled] = useState(false);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (session?.storyText) setStoryText(session.storyText);
  }, [session?.storyText]);

  const handleChoose = async (optionId: number) => {
    setActionDisabled(true);
    try {
      await chooseAction(optionId);
      if (sessionId) {
        setStoryText('');
        connect(sessionId, {
          onStory: (text) => setStoryText(prev => prev + text + '\n\n'),
          onDone: () => { setActionDisabled(false); setSpinning(false); },
          onError: (msg) => { toast.error(msg); setActionDisabled(false); setSpinning(false); },
        });
      }
    } catch { setActionDisabled(false); }
  };

  const handleSpin = async () => {
    setActionDisabled(true);
    setSpinning(true);
    try {
      const result = await spinAction();
      if (result?.triggeredEvent) {
        toast.info(`触发事件：${result.triggeredEvent.title}`);
      }
      if (sessionId) {
        setStoryText('');
        connect(sessionId, {
          onStory: (text) => setStoryText(prev => prev + text + '\n\n'),
          onDone: () => { setActionDisabled(false); setSpinning(false); },
          onError: (msg) => { toast.error(msg); setActionDisabled(false); setSpinning(false); },
        });
      }
    } catch { setActionDisabled(false); setSpinning(false); }
  };

  const handleSave = async () => {
    await saveSession();
    toast.success('存档成功');
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
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/player')}>
          <ArrowLeftIcon className="size-4 mr-1" /> 返回
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={actionDisabled}>
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

          {!streaming && currentOptions.length > 0 && (
            <ChoicePanel
              options={currentOptions.map(o => ({ id: o.id, label: o.label, riskHint: o.riskHint }))}
              disabled={actionDisabled}
              onChoose={handleChoose}
            />
          )}

          {!streaming && (
            <WheelOfFortune onSpin={handleSpin} disabled={actionDisabled} spinning={spinning} />
          )}
        </div>

        <div className="space-y-3">
          <CharacterPanel character={character} loading={loading} />
        </div>
      </div>
    </div>
  );
}
