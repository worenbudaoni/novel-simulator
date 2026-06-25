import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from 'src/components/ui/button';
import { Card, CardContent } from 'src/components/ui/card';
import { RotateCcwIcon, HomeIcon, SparklesIcon } from 'lucide-react';

interface CharacterFinalData {
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  choicesMade: number;
  eventsTriggered: number;
  currentTitle?: string;
}

interface EndingModalProps {
  nodeTitle: string;
  nodeDescription?: string;
  storyText?: string;
  character: CharacterFinalData | null;
  onRestart: () => void;
  onBackToHome: () => void;
  onClose?: () => void;
}

export default function EndingModal({
  nodeTitle, nodeDescription, storyText, character, onRestart, onBackToHome, onClose,
}: EndingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => onClose?.()}>
      <Card className="max-w-md w-full animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <CardContent className="pt-6 pb-6 space-y-5">
          {/* 结局标题 */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-primary/10">
                <SparklesIcon className="size-8 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-bold">🎉 故事结局</h2>
            <p className="text-lg font-semibold text-primary">{nodeTitle}</p>
            {nodeDescription && (
              <p className="text-sm text-muted-foreground">{nodeDescription}</p>
            )}
          </div>

          {/* 角色属性 */}
          {character && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-center">最终属性</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span>❤️ HP: {character.hp}</span>
                <span>⚔️ 攻击: {character.attack}</span>
                <span>🛡 防御: {character.defense}</span>
                <span>🧠 智力: {character.intelligence}</span>
                <span>✨ 魅力: {character.charm}</span>
                <span>🍀 运气: {character.luck}</span>
              </div>
              <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                选择 {character.choicesMade} 次 · 触发 {character.eventsTriggered} 次事件
              </div>
              {character.currentTitle && (
                <div className="text-xs text-amber-600 text-center font-medium">
                  🏆 称号: {character.currentTitle}
                </div>
              )}
            </div>
          )}

          {/* 完整故事回顾 */}
          {storyText && (
            <div className="bg-muted/20 rounded-lg p-3 max-h-40 overflow-y-auto">
              <h3 className="text-sm font-semibold mb-2">📖 完整故事</h3>
              <div className="prose prose-xs max-w-none dark:prose-invert text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {storyText}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col gap-2">
            <Button onClick={onRestart} className="w-full">
              <RotateCcwIcon className="size-4 mr-2" /> 再来一次
            </Button>
            <Button variant="outline" onClick={onBackToHome} className="w-full">
              <HomeIcon className="size-4 mr-2" /> 返回作品列表
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
