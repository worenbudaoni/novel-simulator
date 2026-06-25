import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';

interface WheelOfFortuneProps {
  onSpin: () => void;
  disabled?: boolean;
  spinning?: boolean;
}

const COLORS = ['#a855f7', '#eab308', '#ef4444', '#22c55e', '#6366f1', '#06b6d4'];

const SECTORS = [
  { icon: '✨' },
  { icon: '💎' },
  { icon: '⚔️' },
  { icon: '💀' },
  { icon: '🌀' },
  { icon: '💕' },
];

export default function WheelOfFortune({ onSpin, disabled, spinning }: WheelOfFortuneProps) {
  const [pointerRot, setPointerRot] = useState(0);

  const handleSpin = () => {
    const extra = (3 + Math.floor(Math.random() * 3)) * 360;
    const randomSector = Math.random() * 360;
    setPointerRot(prev => {
      let r = prev + extra + randomSector;
      // 保证每次多转 3-5 圈
      if (r - prev < 1080) r += 1080;
      return r;
    });
    onSpin();
  };

  const n = SECTORS.length;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-72">
        {/* 静态转盘 */}
        <div className="w-full h-full rounded-full border-2 border-border bg-card overflow-hidden">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {SECTORS.map((s, i) => {
              const a1 = ((360 / n) * i - 90) * Math.PI / 180;
              const a2 = ((360 / n) * (i + 1) - 90) * Math.PI / 180;
              const am = ((360 / n) * i - 90 + (360 / n) / 2) * Math.PI / 180;
              return (
                <g key={i}>
                  <path d={`M100,100 L${100 + 85 * Math.cos(a1)},${100 + 85 * Math.sin(a1)} A85,85 0 0,1 ${100 + 85 * Math.cos(a2)},${100 + 85 * Math.sin(a2)} Z`} fill={COLORS[i]} stroke="white" strokeWidth="1.5" />
                  <text x={100 + 40 * Math.cos(am)} y={100 + 40 * Math.sin(am)} textAnchor="middle" dominantBaseline="central" fontSize="28">{s.icon}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 旋转指针 */}
        <div className="absolute inset-0 transition-transform duration-[1000ms] ease-out" style={{ transform: `rotate(${pointerRot}deg)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-foreground" />
          </div>
        </div>

        {/* 中心按钮 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={handleSpin}
            disabled={disabled || spinning}
            className="size-12 rounded-full bg-background border-2 border-border hover:scale-110 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer z-10"
          >
            {spinning ? <Loader2Icon className="size-5 animate-spin text-muted-foreground" /> : <span className="text-xl">🎰</span>}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">点击中心按钮抽奖</p>
    </div>
  );
}
