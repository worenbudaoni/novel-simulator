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
}

function AttrRow({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'text-green-600' : value >= 40 ? 'text-foreground' : 'text-red-500';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function CharacterPanel({ character, loading }: CharacterPanelProps) {
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
            <AttrRow label="❤️ HP" value={character.hp} />
            <AttrRow label="⚔️ 攻击" value={character.attack} />
            <AttrRow label="🛡 防御" value={character.defense} />
            <AttrRow label="🧠 智力" value={character.intelligence} />
            <AttrRow label="✨ 魅力" value={character.charm} />
            <AttrRow label="🍀 运气" value={character.luck} />
            <div className="text-xs text-muted-foreground pt-1 border-t">
              选择: {character.choicesMade} 次 | 事件: {character.eventsTriggered} 次
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">暂无数据</p>
        )}
      </CardContent>
    </Card>
  );
}
