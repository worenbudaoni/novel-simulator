import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useStory } from '@/hooks/useStory';
import api from '@/hooks/useApi';
import { Loader2Icon, ArrowLeftIcon, RefreshCwIcon, CheckIcon, SparklesIcon } from 'lucide-react';

const RANDOM_NAMES = [
  '云逸', '星瑶', '月影', '风吟', '雪见',
  '凌云', '紫嫣', '苍穹', '碧落', '玄霜',
  '墨羽', '青鸾', '赤霄', '白泽', '朱雀',
  '玄冥', '离火', '巽风', '震雷', '坎水',
];

const TEMPLATES = [
  { icon: '🗡️', label: '战士',   hp: 100, attack: 20, defense: 20, intelligence: 30, charm: 30, luck: 40, desc: '高攻高防' },
  { icon: '📖', label: '智者',   hp: 80,  attack: 8,  defense: 8,  intelligence: 70, charm: 40, luck: 40, desc: '高悟性' },
  { icon: '💕', label: '魅力型', hp: 90,  attack: 10, defense: 10, intelligence: 40, charm: 70, luck: 40, desc: '高魅力' },
  { icon: '🍀', label: '幸运型', hp: 80,  attack: 10, defense: 10, intelligence: 40, charm: 40, luck: 70, desc: '高气运' },
  { icon: '⚖️', label: '均衡型', hp: 100, attack: 12, defense: 12, intelligence: 45, charm: 45, luck: 45, desc: '属性平均' },
  { icon: '🔥', label: '挑战型', hp: 70,  attack: 8,  defense: 8,  intelligence: 50, charm: 50, luck: 50, desc: '低起点高成长' },
];

const TRAITS = [
  { label: '初始功法 · 清风诀', effect: '攻击+3', attack: 3 },
  { label: '灵脉觉醒', effect: '智力+5', intelligence: 5 },
  { label: '天生神力', effect: 'HP+20', hp: 20 },
  { label: '护体罡气', effect: '防御+5', defense: 5 },
  { label: '福星高照', effect: '运气+5', luck: 5 },
  { label: '玉树临风', effect: '魅力+5', charm: 5 },
  { label: '丹药馈赠', effect: '全属性+2', hp: 10, attack: 2, defense: 2, intelligence: 2, charm: 2, luck: 2 },
  { label: '神秘印记', effect: '智力+3 运气+3', intelligence: 3, luck: 3 },
  { label: '百战余生的经验', effect: '攻击+4 防御+2', attack: 4, defense: 2 },
  { label: '天眷之人', effect: '运气+8', luck: 8 },
];

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

interface RolledAttrs {
  icon: string;
  label: string;
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  desc: string;
  trait?: { label: string; effect: string };
}

function AttrBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
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
  const [phase, setPhase] = useState<'name' | 'spin'>('name');
  const [spinning, setSpinning] = useState(false);
  const [pointerRot, setPointerRot] = useState(0);
  const [randomRate] = useState(50);
  const [deathRate] = useState(30);

  useEffect(() => {
    if (!novelId) return;
    api.get(`/player/novel/${novelId}/full`).then(res => {
      if (res.data.code === 200) setNovel(res.data.data.novel);
    }).finally(() => setLoading(false));
  }, [novelId]);

  const randomName = () => {
    setName(RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]);
  };

  const doSpin = () => {
    setSpinning(true);
    const idx = Math.floor(Math.random() * TEMPLATES.length);
    const template = TEMPLATES[idx];
    // 提前计算目标角度，首次抽奖时先显转盘再转
    const extraTurns = (3 + Math.floor(Math.random() * 3)) * 360;
    const target = idx * 60 + Math.random() * 60;
    const raw = pointerRot + extraTurns;
    let finalRot = raw - (raw % 360) + target;
    if (finalRot <= pointerRot) finalRot += 360;

    const variance = () => rand(-5, 5);
    const hasTrait = Math.random() < 0.3;
    const trait = hasTrait ? TRAITS[Math.floor(Math.random() * TRAITS.length)] : undefined;

    const attrs: RolledAttrs = {
      icon: template.icon,
      label: template.label,
      hp: Math.max(50, template.hp + variance()),
      attack: Math.max(3, template.attack + variance()),
      defense: Math.max(3, template.defense + variance()),
      intelligence: Math.max(3, template.intelligence + variance()),
      charm: Math.max(3, template.charm + variance()),
      luck: Math.max(3, template.luck + variance()),
      desc: template.desc,
      trait,
    };

    if (trait) {
      if (trait.hp) attrs.hp += trait.hp;
      if (trait.attack) attrs.attack += trait.attack;
      if (trait.defense) attrs.defense += trait.defense;
      if (trait.intelligence) attrs.intelligence += trait.intelligence;
      if (trait.charm) attrs.charm += trait.charm;
      if (trait.luck) attrs.luck += trait.luck;
    }

    if (phase === 'name') {
      // 首次抽奖：先显示转盘（角度归零），下一帧再转
      setPhase('spin');
      setPointerRot(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPointerRot(finalRot);
          setTimeout(() => { setRolled(attrs); setSpinning(false); }, 1500);
        });
      });
    } else {
      setPointerRot(prev => {
        const extra = (3 + Math.floor(Math.random() * 3)) * 360;
        const t = idx * 60 + Math.random() * 60;
        let r = prev + extra;
        r = r - (r % 360) + t;
        if (r <= prev) r += 360;
        return r;
      });
      setTimeout(() => {
        setRolled(attrs);
        setSpinning(false);
      }, 1500);
    }
  };

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
        navigate(`/player/story/${sessionData.session.sessionId}`, { state: { novelTitle: novel?.title } });
      }
    } catch { /* handled */ }
    setStarting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  const colors = ['#ef4444', '#a855f7', '#ec4899', '#22c55e', '#eab308', '#6366f1'];

  return (
    <div className="max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/player')} className="mb-4">
        <ArrowLeftIcon className="size-4 mr-1" /> 返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{novel?.title || '开始冒险'}</CardTitle>
          <CardDescription>
            {phase === 'name' ? '创建你的角色' : '抽取初始属性，不满意可重新抽奖'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 转盘 — 始终渲染（名称阶段隐藏），保证首次抽奖指针动画生效 */}
          <div className={`flex flex-col items-center gap-2 ${phase === 'name' ? 'hidden' : ''}`}>
            <div className="relative size-72">
              {/* 轮盘主体（始终静止） */}
              <div className="w-full h-full rounded-full border-2 border-border bg-card overflow-hidden">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {TEMPLATES.map((t, i) => {
                    const angle = (360 / TEMPLATES.length) * i - 90;
                    const endAngle = (360 / TEMPLATES.length) * (i + 1) - 90;
                    const a1 = (angle * Math.PI) / 180;
                    const a2 = (endAngle * Math.PI) / 180;
                    const midAngle = ((angle + endAngle) / 2 * Math.PI) / 180;
                    return (
                      <g key={i}>
                        <path
                          d={`M100,100 L${100 + 85 * Math.cos(a1)},${100 + 85 * Math.sin(a1)} A85,85 0 0,1 ${100 + 85 * Math.cos(a2)},${100 + 85 * Math.sin(a2)} Z`}
                          fill={colors[i]} stroke="white" strokeWidth="1.5"
                        />
                        <text
                          x={100 + 40 * Math.cos(midAngle)}
                          y={100 + 40 * Math.sin(midAngle)}
                          textAnchor="middle" dominantBaseline="central"
                          fontSize="22"
                        >
                          {t.icon}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 旋转指针 */}
              <div
                className="absolute inset-0 transition-transform duration-[1500ms] ease-out"
                style={{ transform: `rotate(${pointerRot}deg)` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-foreground" />
                </div>
              </div>

              {/* 中心圆 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={doSpin}
                  disabled={spinning}
                  className="size-12 rounded-full bg-background border-2 border-border hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer z-10"
                  title={spinning ? '抽奖中...' : '点击抽奖'}
                >
                  {spinning ? (
                    <Loader2Icon className="size-5 text-muted-foreground animate-spin" />
                  ) : (
                    <span className="text-xl">🎲</span>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">点击中心骰子抽奖，不满意可重复抽取</p>
          </div>

          {/* 阶段一：输入名称 */}
          {phase === 'name' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>角色名称</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入角色名..."
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={20}
                    autoFocus
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={randomName} type="button" title="随机生成">
                    <SparklesIcon className="size-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={doSpin} disabled={!name.trim()} className="w-full" size="lg">
                抽取初始属性
              </Button>
            </div>
          )}

          {/* 阶段二：属性抽奖结果 */}
          {phase === 'spin' && (
            <div className="space-y-5">

              {/* 结果展示 */}
              {rolled && !spinning && (
                <>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                    <div className="text-center space-y-1">
                      <span className="text-4xl">{rolled.icon}</span>
                      <div>
                        <span className="text-lg font-semibold">{rolled.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{rolled.desc}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <AttrBar label="❤️ 气血" value={rolled.hp} max={120} />
                      <AttrBar label="⚔️ 攻击" value={rolled.attack} max={30} />
                      <AttrBar label="🛡 防御" value={rolled.defense} max={30} />
                      <AttrBar label="🧠 悟性" value={rolled.intelligence} max={80} />
                      <AttrBar label="✨ 魅力" value={rolled.charm} max={80} />
                      <AttrBar label="🍀 气运" value={rolled.luck} max={80} />
                    </div>
                    {rolled.trait && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 text-sm flex items-center gap-2">
                        <SparklesIcon className="size-4 text-amber-500 shrink-0" />
                        <span className="font-medium text-amber-700 dark:text-amber-400">{rolled.trait.label}</span>
                        <span className="text-xs text-amber-500 ml-auto">{rolled.trait.effect}</span>
                      </div>
                    )}
                  </div>

                  <Button onClick={handleConfirm} disabled={starting} className="w-full" size="lg">
                    {starting ? (
                      <><Loader2Icon className="size-4 animate-spin mr-2" /> 创建中...</>
                    ) : (
                      <><CheckIcon className="size-4 mr-2" /> 接受并开始冒险</>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
