import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from 'src/components/ui/card';

interface CharacterData {
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  currentTitle?: string;
  choicesMade: number;
  eventsTriggered: number;
}

interface CharacterPanelProps {
  character: CharacterData | null;
  loading?: boolean;
  attrChanges?: Record<string, number>;
}

interface FloatAnim {
  key: string;
  value: number;
  id: number;
}

function AttrRow({ label, value, delta }: { label: string; value: number; delta?: number }) {
  const color = value >= 80 ? 'text-green-600' : value >= 40 ? 'text-foreground' : 'text-red-500';
  const [displayValue, setDisplayValue] = useState(value);
  const prevRef = useRef(value);
  const [floats, setFloats] = useState<FloatAnim[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev !== value) {
      const diff = value - prev;
      const steps = Math.abs(diff);
      const stepSize = diff / Math.max(steps, 1);
      let current = prev;
      const interval = setInterval(() => {
        current += stepSize;
        if (Math.abs(current - value) < Math.abs(stepSize)) {
          setDisplayValue(value);
          clearInterval(interval);
        } else {
          setDisplayValue(Math.round(current));
        }
      }, 30);

      if (delta != null && delta !== 0) {
        idRef.current++;
        const float: FloatAnim = { key: label, value: delta, id: idRef.current };
        setFloats(prev => [...prev, float]);
        setTimeout(() => {
          setFloats(prev => prev.filter(f => f.id !== float.id));
        }, 1500);
      }

      prevRef.current = value;
      return () => clearInterval(interval);
    }
  }, [value]);

  return (
    <div className="flex items-center justify-between text-sm relative">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{displayValue}</span>
      {floats.map(f => (
        <span
          key={f.id}
          className={`absolute right-0 -top-3 text-xs font-bold animate-fade-up pointer-events-none
            ${f.value > 0 ? 'text-green-500' : 'text-red-500'}`}
          style={{ animation: 'float-up 1.5s ease-out forwards' }}
        >
          {f.value >= 0 ? '+' : ''}{f.value}
        </span>
      ))}
    </div>
  );
}

export default function CharacterPanel({ character, loading, attrChanges }: CharacterPanelProps) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <h4 className="text-sm font-semibold">角色属性</h4>
        {loading ? (
          <p className="text-xs text-muted-foreground">加载中...</p>
        ) : character ? (
          <>
            {character.currentTitle && (
              <div className="text-xs text-amber-600 font-medium mb-1">🏆 {character.currentTitle}</div>
            )}
            <AttrRow label="❤️ HP" value={character.hp} delta={attrChanges?.hp} />
            {character.hp < 30 && (
              <div className="text-xs text-red-500 animate-pulse">⚠ 生命值危险！</div>
            )}
            <AttrRow label="⚔️ 攻击" value={character.attack} delta={attrChanges?.attack} />
            <AttrRow label="🛡 防御" value={character.defense} delta={attrChanges?.defense} />
            <AttrRow label="🧠 智力" value={character.intelligence} delta={attrChanges?.intelligence} />
            <AttrRow label="✨ 魅力" value={character.charm} delta={attrChanges?.charm} />
            <AttrRow label="🍀 运气" value={character.luck} delta={attrChanges?.luck} />
            <div className="text-xs text-muted-foreground pt-1 border-t">
              选择: {character.choicesMade} 次 | 事件: {character.eventsTriggered} 次
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">暂无数据</p>
        )}
      </CardContent>

      <style>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-16px); }
        }
      `}</style>
    </Card>
  );
}
