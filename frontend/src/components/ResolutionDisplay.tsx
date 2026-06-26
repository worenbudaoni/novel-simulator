import { useEffect, useState } from 'react';
import { Card, CardContent } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { ChevronRightIcon } from 'lucide-react';
import type { ResolutionResult } from '@/types';

interface ResolutionDisplayProps {
  result: ResolutionResult;
  onContinue: () => void;
}

export default function ResolutionDisplay({ result, onContinue }: ResolutionDisplayProps) {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const step = result.riskLevel === 'safe' ? 150 : 300;
    const t1 = setTimeout(() => setReveal(1), step);
    const t2 = setTimeout(() => setReveal(2), step * 2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [result.riskLevel]);

  const showContinue = (result.riskLevel === 'safe' && reveal >= 1) || reveal >= 2;

  return (
    <Card className="border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          {result.riskLevel === 'safe' && <span className="text-lg">🟢</span>}
          {result.riskLevel === 'risky' && <span className="text-lg">{result.success ? '🎲' : '💥'}</span>}
          {result.riskLevel === 'daring' && (
            <span className="text-lg animate-pulse">⚡</span>
          )}
          <h3 className="text-base font-semibold">
            {result.riskLevel === 'safe' && '稳定推进'}
            {result.riskLevel === 'risky' && (result.success ? '检定成功！' : '检定失败')}
            {result.riskLevel === 'daring' && '高风险行动'}
          </h3>
        </div>

        {/* daring: 红色脉冲边框 */}
        {result.riskLevel === 'daring' && reveal === 0 && (
          <div className="border-2 border-red-400 rounded-lg p-4 animate-pulse">
            <p className="text-sm text-red-600 text-center">你做出了一个大胆的选择...</p>
            <p className="text-xs text-muted-foreground text-center mt-1">命运正在为你编织结果</p>
          </div>
        )}

        {/* risky: 检定表 */}
        {result.riskLevel === 'risky' && reveal >= 1 && result.checkAttr && (
          <div className="bg-muted rounded-lg p-4 text-sm space-y-2 animate-in fade-in duration-300">
            <div className="grid grid-cols-4 gap-2 text-center pt-2">
              <div>
                <div className="text-xl font-bold tabular-nums">{result.diceRoll}</div>
                <div className="text-[10px] text-muted-foreground">🎲 骰子</div>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{result.modifier != null && result.modifier >= 0 ? '+' : ''}{result.modifier}</div>
                <div className="text-[10px] text-muted-foreground">修正</div>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{result.total}</div>
                <div className="text-[10px] text-muted-foreground">合计</div>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">DC{result.dc}</div>
                <div className="text-[10px] text-muted-foreground">难度</div>
              </div>
            </div>
            <div className="text-center pt-1">
              <span className={`text-lg font-bold ${result.success ? 'text-green-600' : 'text-red-500'}`}>
                {result.success ? '✅ 成功！' : '❌ 失败'}
              </span>
            </div>
          </div>
        )}

        {/* safe: 文本 */}
        {result.riskLevel === 'safe' && reveal >= 1 && (
          <p className="text-sm text-muted-foreground animate-in fade-in duration-300">你稳步前进，一切顺利。</p>
        )}

        {/* 事件卡片 + 属性变化 */}
        {reveal >= 2 && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {result.eventTitle && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">⚡ {result.eventTitle}</h5>
                {result.eventContent && (
                  <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed whitespace-pre-wrap">{result.eventContent}</p>
                )}
              </div>
            )}

            {result.attrChanges && Object.keys(result.attrChanges).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">📊 属性变化</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.attrChanges).map(([key, value]) => {
                    const icons: Record<string, string> = {
                      hp: '❤️', attack: '⚔️', defense: '🛡️',
                      intelligence: '🧠', charm: '✨', luck: '🍀',
                    };
                    const names: Record<string, string> = {
                      hp: '气血', attack: '攻击', defense: '防御',
                      intelligence: '智力', charm: '魅力', luck: '运气',
                    };
                    return (
                      <div key={key}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums
                          ${value > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                           : value < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                           : 'bg-muted text-muted-foreground'}`}
                      >
                        {icons[key]} {names[key]} {value >= 0 ? '+' : ''}{value}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 继续按钮 */}
        {showContinue && (
          <Button onClick={onContinue} className="w-full mt-2 animate-in fade-in duration-200" size="sm">
            继续冒险 <ChevronRightIcon className="size-4 ml-1" />
          </Button>
        )}

        {!showContinue && (
          <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
            {/* 移除 spinner，用倒计时暗示 */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
