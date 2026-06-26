import { useEffect, useState } from 'react';

interface WheelOfFortuneProps {
  riskLevel: 'risky' | 'daring';
  rollResult?: number;
  success?: boolean;
  autoPlay: boolean;
  onComplete?: () => void;
}

const COLORS = ['#a855f7', '#eab308', '#ef4444', '#22c55e', '#6366f1', '#06b6d4'];
const SECTORS = [
  { icon: '✨', name: '奇遇' }, { icon: '💎', name: '宝箱' }, { icon: '⚔️', name: '战斗' },
  { icon: '💀', name: '诅咒' }, { icon: '🌀', name: '命运' }, { icon: '💕', name: '邂逅' },
];
const N = 6;

export default function WheelOfFortune({ riskLevel, rollResult, success, autoPlay, onComplete }: WheelOfFortuneProps) {
  const [pointerRot, setPointerRot] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [landedSector, setLandedSector] = useState(-1);

  useEffect(() => {
    if (!autoPlay) return;

    let targetAngle = 0;
    if (riskLevel === 'risky' && rollResult != null) {
      const sector = Math.max(0, Math.min(5, Math.floor((rollResult - 1) / 3.33)));
      targetAngle = sector * 60 + 30;
    } else {
      const sector = Math.floor(Math.random() * N);
      targetAngle = sector * 60 + 30;
    }

    const sector = riskLevel === 'risky' && rollResult != null
      ? Math.max(0, Math.min(5, Math.floor((rollResult - 1) / 3.33)))
      : Math.floor(Math.random() * N);

    setLandedSector(sector);
    const extraRotations = (3 + Math.floor(Math.random() * 3)) * 360;
    const totalRotation = pointerRot + extraRotations + sector * 60 + 30;

    setPointerRot(totalRotation);

    const timer = setTimeout(() => {
      setShowResult(true);
      if (onComplete) onComplete();
    }, 1200);

    return () => clearTimeout(timer);
  }, [autoPlay]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-40 sm:size-48">
        <div className="w-full h-full rounded-full border-2 border-border bg-card overflow-hidden">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {SECTORS.map((s, i) => {
              const a1 = ((360 / N) * i - 90) * Math.PI / 180;
              const a2 = ((360 / N) * (i + 1) - 90) * Math.PI / 180;
              const am = ((360 / N) * i - 90 + (360 / N) / 2) * Math.PI / 180;
              return (
                <g key={i}>
                  <path d={`M100,100 L${100 + 85 * Math.cos(a1)},${100 + 85 * Math.sin(a1)} A85,85 0 0,1 ${100 + 85 * Math.cos(a2)},${100 + 85 * Math.sin(a2)} Z`} fill={COLORS[i]} stroke="white" strokeWidth="1.5" />
                  <text x={100 + 40 * Math.cos(am)} y={100 + 40 * Math.sin(am)} textAnchor="middle" dominantBaseline="central" fontSize="28">{s.icon}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="absolute inset-0 transition-transform duration-[1200ms] ease-out" style={{ transform: `rotate(${pointerRot}deg)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-foreground" />
          </div>
        </div>
      </div>

      {showResult && landedSector >= 0 && (
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <span className="text-2xl">{SECTORS[landedSector].icon}</span>
            <span className="text-sm font-semibold">{SECTORS[landedSector].name}</span>
            {success != null && (
              <span className={`text-sm font-bold ${success ? 'text-green-600' : 'text-red-500'}`}>
                {success ? '✅' : '❌'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
