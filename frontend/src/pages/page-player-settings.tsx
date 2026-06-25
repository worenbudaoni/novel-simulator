import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useStory } from '@/hooks/useStory';
import api from '@/hooks/useApi';
import { Loader2Icon, ArrowLeftIcon, RefreshCwIcon, CheckIcon } from 'lucide-react';

const TEMPLATES = [
  { label: '⚔️ 战士',  hp: 100, attack: 20, defense: 20, intelligence: 30, charm: 30, luck: 40, desc: '高攻高防' },
  { label: '🧙 智者',  hp: 80,  attack: 8,  defense: 8,  intelligence: 70, charm: 40, luck: 40, desc: '高智力' },
  { label: '❤️ 魅力型', hp: 90,  attack: 10, defense: 10, intelligence: 40, charm: 70, luck: 40, desc: '高魅力' },
  { label: '🍀 幸运型', hp: 80,  attack: 10, defense: 10, intelligence: 40, charm: 40, luck: 70, desc: '高运气' },
  { label: '⚖️ 均衡型', hp: 100, attack: 12, defense: 12, intelligence: 45, charm: 45, luck: 45, desc: '属性平均' },
  { label: '💀 挑战型', hp: 70,  attack: 8,  defense: 8,  intelligence: 50, charm: 50, luck: 50, desc: '低起点高成长' },
];

interface RolledAttrs {
  label: string;
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  desc: string;
}

function AttrBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function PlayerSettingsPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createSession } = useStory();

  const [novel, setNovel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [name, setName] = useState('');
  const [rolled, setRolled] = useState<RolledAttrs | null>(null);
  const [phase, setPhase] = useState<'name' | 'spin' | 'ready'>('name'); // 阶段

  // 设置
  const [randomRate, setRandomRate] = useState(50);
  const [deathRate, setDeathRate] = useState(30);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!novelId) return;
    api.get(`/player/novel/${novelId}/full`).then(res => {
      if (res.data.code === 200) setNovel(res.data.data.novel);
    }).finally(() => setLoading(false));
  }, [novelId]);

  // 属性抽奖
  const handleSpin = () => {
    const idx = Math.floor(Math.random() * TEMPLATES.length);
    setRolled(TEMPLATES[idx]);
    setRotation(prev => prev + 1440 + Math.random() * 720);
    if (phase === 'name') setPhase('spin');
  };

  // 确认角色，创建会话
  const handleConfirm = async () => {
    if (!novelId || !rolled || !name.trim()) return;
    setStarting(true);
    try {
      const sessionData = await createSession(Number(novelId), name.trim(), rolled);
      if (sessionData?.session?.sessionId) {
        await api.post('/player/session/settings', {
          sessionId: sessionData.session.sessionId,
          settings: { randomRate, deathRate },
        });
        navigate(`/player/story/${sessionData.session.sessionId}`);
      }
    } catch { /* handled */ }
    setStarting(false);
  };

  // 进入第二阶段的按钮
  const handleToSpin = () => {
    if (!name.trim()) return;
    handleSpin();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/player')} className="mb-4">
        <ArrowLeftIcon className="size-4 mr-1" /> 返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{novel?.title || '开始冒险'}</CardTitle>
          <CardDescription>
            {phase === 'name' ? '创建你的角色' : phase === 'spin' ? '抽取你的初始属性' : '确认角色'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 阶段一：输入名称 */}
          {phase === 'name' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>角色名称</Label>
                <Input
                  placeholder="输入你的角色名..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={20}
                  autoFocus
                />
              </div>
              <Button onClick={handleToSpin} disabled={!name.trim()} className="w-full" size="lg">
                开始抽取属性
              </Button>
            </div>
          )}

          {/* 阶段二：属性抽奖 */}
          {(phase === 'spin' || phase === 'ready') && (
            <div className="space-y-4">
              {/* 转盘区域 */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative size-48">
                  <div
                    className="w-full h-full rounded-full border-4 border-border shadow-lg overflow-hidden transition-transform duration-[2000ms] ease-out"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  >
                    <svg viewBox="0 0 180 180" className="w-full h-full">
                      {TEMPLATES.map((t, i) => {
                        const angle = (360 / TEMPLATES.length) * i - 90;
                        const endAngle = (360 / TEMPLATES.length) * (i + 1) - 90;
                        const a1 = (angle * Math.PI) / 180;
                        const a2 = (endAngle * Math.PI) / 180;
                        const colors = ['#ef4444', '#a855f7', '#ec4899', '#22c55e', '#eab308', '#6366f1'];
                        return (
                          <g key={i}>
                            <path d={`M90,90 L${90 + 75 * Math.cos(a1)},${90 + 75 * Math.sin(a1)} A75,75 0 0,1 ${90 + 75 * Math.cos(a2)},${90 + 75 * Math.sin(a2)} Z`} fill={colors[i]} stroke="white" strokeWidth="1" />
                            <text x={90 + 42 * Math.cos((angle + endAngle) / 2 * Math.PI / 180)} y={90 + 42 * Math.sin((angle + endAngle) / 2 * Math.PI / 180)} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold" fill="white">{t.label}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                    <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-foreground drop-shadow" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="size-10 rounded-full bg-background border-2 border-border flex items-center justify-center">
                      <span className="text-sm">🎲</span>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSpin} variant="outline" size="sm" className="gap-2">
                  <RefreshCwIcon className="size-4" /> 重新抽奖
                </Button>
              </div>

              {/* 抽奖结果 */}
              {rolled && (
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="text-center mb-2">
                    <span className="text-lg font-semibold">{rolled.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{rolled.desc}</span>
                  </div>
                  <AttrBar label="❤️ HP" value={rolled.hp} max={100} />
                  <AttrBar label="⚔️ 攻击" value={rolled.attack} max={25} />
                  <AttrBar label="🛡 防御" value={rolled.defense} max={25} />
                  <AttrBar label="🧠 智力" value={rolled.intelligence} max={80} />
                  <AttrBar label="✨ 魅力" value={rolled.charm} max={80} />
                  <AttrBar label="🍀 运气" value={rolled.luck} max={80} />
                </div>
              )}

              {/* 接受按钮 */}
              <Button onClick={handleConfirm} disabled={starting || !rolled} className="w-full" size="lg">
                {starting ? <><Loader2Icon className="size-4 animate-spin mr-2" /> 创建中...</> : <><CheckIcon className="size-4 mr-2" /> 接受并开始冒险</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
