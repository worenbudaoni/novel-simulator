import { useEffect, useState } from 'react';
import { Card, CardContent } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { ChevronRightIcon, Loader2Icon } from 'lucide-react';
import WheelOfFortune from 'src/components/WheelOfFortune';
import type { ResolutionResult } from '@/types';

interface ResolutionDisplayProps {
  result: ResolutionResult;
  onContinue: () => void;
}

export default function ResolutionDisplay({ result, onContinue }: ResolutionDisplayProps) {
  // 用数字控制动画渐进展示：0=入场动画 1=核心结果 2=完全展示
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    // 逐步展示：入场→核心→完整，每步 400ms，不自动消失
    const t1 = setTimeout(() => setReveal(1), 400);
    const t2 = setTimeout(() => setReveal(2), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <Card className="border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardContent className="pt-4 space-y-4">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          {result.riskLevel === 'safe' && <span className="text-lg">🟢</span>}
          {result.riskLevel === 'risky' && <span className="text-lg">{result.success ? '🎲' : '💥'}</span>}
          {result.riskLevel === 'daring' && <span className="text-lg">🌀</span>}
          <h3 className="text-base font-semibold">
            {result.riskLevel === 'safe' && '稳定推进'}
            {result.riskLevel === 'risky' && (result.success ? '检定成功！' : '检定失败')}
            {result.riskLevel === 'daring' && '高风险行动'}
          </h3>
        </div>

        {/* 阶段1: 核心结果 - 检定表或轮盘 */}
        {reveal >= 1 && (
          <>
            {/* risky: 属性检定表 */}
            {result.riskLevel === 'risky' && result.checkAttr && (
              <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div className="text-muted-foreground">关联属性</div>
                  <div className="font-medium text-right">{result.checkAttr} ({result.attrValue})</div>
                  <div className="text-muted-foreground">检定公式</div>
                  <div className="font-mono text-xs text-right">d20 + ({result.attrValue} - 50)/10</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-border">
                  <div>
                    <div className="text-xl font-bold tabular-nums">{result.diceRoll}</div>
                    <div className="text-[10px] text-muted-foreground">🎲 骰子</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold tabular-nums">{result.modifier >= 0 ? '+' : ''}{result.modifier}</div>
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

            {/* daring: 轮盘 */}
            {result.riskLevel === 'daring' && (
              <WheelOfFortune
                landSector={result.sector}
                success={result.success}
                autoPlay
                onComplete={() => {}}
              />
            )}

            {/* safe: 简洁文本 */}
            {result.riskLevel === 'safe' && (
              <p className="text-sm text-muted-foreground">你稳步前进，一切顺利。</p>
            )}
          </>
        )}

        {/* 阶段2: 完整展示 - 事件 + 属性变化 */}
        {reveal >= 2 && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {/* 事件卡片（如有） */}
            {result.eventTitle && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">⚡ {result.eventTitle}</h5>
                {result.eventContent && (
                  <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed whitespace-pre-wrap">{result.eventContent}</p>
                )}
              </div>
            )}

            {/* 属性变化 */}
            {result.attrChanges && Object.keys(result.attrChanges).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">📊 属性变化</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.attrChanges).map(([key, value]) => (
                    <div
                      key={key}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums animate-in fade-in slide-in-from-bottom-1 duration-200
                        ${value > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                         : value < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                         : 'bg-muted text-muted-foreground'}`}
                    >
                      {key === 'hp' ? '❤️' : key === 'attack' ? '⚔️' : key === 'defense' ? '🛡️'
                       : key === 'intelligence' ? '🧠' : key === 'charm' ? '✨' : '🍀'}{' '}
                      {key === 'hp' ? '气血' : key === 'attack' ? '攻击' : key === 'defense' ? '防御'
                       : key === 'intelligence' ? '智力' : key === 'charm' ? '魅力' : '运气'}
                      {' '}<span className={value >= 0 ? 'text-inherit' : ''}>{value >= 0 ? '+' : ''}{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 固定继续按钮 */}
        {reveal >= 2 && (
          <Button onClick={onContinue} className="w-full mt-2" size="sm">
            继续冒险 <ChevronRightIcon className="size-4 ml-1" />
          </Button>
        )}

        {reveal < 2 && (
          <div className="flex items-center justify-center py-2 text-xs text-muted-foreground gap-1">
            <Loader2Icon className="size-3 animate-spin" /> 加载中...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
