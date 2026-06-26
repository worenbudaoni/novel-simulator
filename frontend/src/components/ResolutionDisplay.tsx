import { useEffect, useState } from 'react';
import { Card, CardContent } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { ChevronRightIcon } from 'lucide-react';
import WheelOfFortune from 'src/components/WheelOfFortune';
import type { ResolutionResult } from '@/types';

interface ResolutionDisplayProps {
  result: ResolutionResult;
  onContinue: () => void;
}

export default function ResolutionDisplay({ result, onContinue }: ResolutionDisplayProps) {
  const [phase, setPhase] = useState<'enter' | 'check' | 'changes' | 'event' | 'done'>('enter');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (result.riskLevel === 'safe') {
      const t1 = setTimeout(() => setPhase('changes'), 200);
      const t2 = setTimeout(() => setPhase('done'), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (result.riskLevel === 'risky') {
      const t1 = setTimeout(() => setPhase('check'), 300);
      const t2 = setTimeout(() => setPhase('changes'), 1500);
      const t3 = setTimeout(() => setPhase('done'), result.eventTitle ? 3000 : 2200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    // daring
    const t1 = setTimeout(() => setPhase('event'), 300);
    const t2 = setTimeout(() => setPhase('changes'), 2000);
    const t3 = setTimeout(() => setPhase('done'), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== 'done') return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4 space-y-3">
        {phase === 'check' && result.riskLevel === 'risky' && (
          <div>
            <h4 className="text-sm font-semibold mb-2">🎲 属性检定</h4>
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">关联属性</span>
                <span className="font-medium">{result.checkAttr} ({result.attrValue})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">检定公式</span>
                <span className="font-mono text-xs">d20 + ({result.attrValue} - 50)/10</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-muted-foreground text-sm font-normal">结果</span>
                <span className={result.success ? 'text-green-600' : 'text-red-500'}>
                  {result.success ? '✅ 成功！' : '❌ 失败'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mt-2 pt-2 border-t border-border">
                <div>
                  <div className="text-lg font-bold tabular-nums">{result.diceRoll}</div>
                  <div className="text-[10px] text-muted-foreground">骰子</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">{result.modifier >= 0 ? '+' : ''}{result.modifier}</div>
                  <div className="text-[10px] text-muted-foreground">修正</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">{result.total}</div>
                  <div className="text-[10px] text-muted-foreground">合计</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">DC{result.dc}</div>
                  <div className="text-[10px] text-muted-foreground">难度</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'event' && result.riskLevel === 'daring' && (
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">🌀 命运轮盘</h4>
            <WheelOfFortune
              riskLevel="daring"
              rollResult={result.attrValue}
              success={result.success}
              autoPlay
              onComplete={() => {}}
            />
          </div>
        )}

        {(phase === 'event' || phase === 'changes') && result.eventTitle && (
          <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-3">
            <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300">⚡ {result.eventTitle}</h5>
            {result.eventContent && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 line-clamp-3">{result.eventContent}</p>
            )}
          </div>
        )}

        {(phase === 'changes' || phase === 'done') && result.attrChanges && (
          <div>
            <h4 className="text-sm font-semibold mb-2">📊 属性变化</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.attrChanges).map(([key, value]) => (
                <div
                  key={key}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums
                    ${value > 0 ? 'bg-green-100 text-green-700' : value < 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}
                >
                  {key === 'hp' ? '❤️' : key === 'attack' ? '⚔️' : key === 'defense' ? '🛡️' : key === 'intelligence' ? '🧠' : key === 'charm' ? '✨' : '🍀'}{' '}
                  {key} {value >= 0 ? '+' : ''}{value}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'done' && (
          <Button onClick={onContinue} className="w-full" size="sm">
            {countdown > 0 ? `继续 (${countdown}s)` : '继续'}
            <ChevronRightIcon className="size-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
