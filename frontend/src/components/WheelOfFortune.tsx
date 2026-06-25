import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';

interface WheelOfFortuneProps {
  onSpin: () => void;
  disabled?: boolean;
  spinning?: boolean;
}

const SECTORS = [
  { label: '奇遇', emoji: '✨', color: '#a855f7' },
  { label: '宝藏', emoji: '💎', color: '#eab308' },
  { label: '战斗', emoji: '⚔️', color: '#ef4444' },
  { label: '治愈', emoji: '❤️', color: '#22c55e' },
  { label: '诅咒', emoji: '💀', color: '#6366f1' },
  { label: '命运', emoji: '🌀', color: '#06b6d4' },
];

const SECTOR_ANGLE = 360 / SECTORS.length;

export default function WheelOfFortune({ onSpin, disabled, spinning }: WheelOfFortuneProps) {
  const [rotation, setRotation] = useState(0);

  const handleSpin = () => {
    const extraSpins = 1800 + Math.random() * 1080;
    const randomSector = Math.random() * 360;
    setRotation(prev => prev + extraSpins + randomSector);
    onSpin();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-60">
        {/* 旋转的转盘 */}
        <div
          className="w-full h-full rounded-full transition-transform duration-[2500ms] ease-out shadow-xl border-4 border-border overflow-hidden"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <svg viewBox="0 0 180 180" className="w-full h-full">
            {SECTORS.map((sector, i) => {
              const startAngle = i * SECTOR_ANGLE - 90;
              const endAngle = (i + 1) * SECTOR_ANGLE - 90;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const x1 = 90 + 80 * Math.cos(startRad);
              const y1 = 90 + 80 * Math.sin(startRad);
              const x2 = 90 + 80 * Math.cos(endRad);
              const y2 = 90 + 80 * Math.sin(endRad);
              const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
              const labelX = 90 + 45 * Math.cos(midAngle);
              const labelY = 90 + 45 * Math.sin(midAngle);

              return (
                <g key={i}>
                  <path
                    d={`M90,90 L${x1},${y1} A80,80 0 0,1 ${x2},${y2} Z`}
                    fill={sector.color}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11"
                    fontWeight="bold"
                    fill="white"
                    className="select-none"
                  >
                    {sector.emoji}
                  </text>
                  <text
                    x={labelX}
                    y={labelY + 14}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="8"
                    fill="white"
                    className="select-none opacity-90"
                  >
                    {sector.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 顶部指针 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[18px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-lg" />
        </div>

        {/* 中心装饰 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-11 rounded-full bg-background border-[3px] border-border shadow-inner flex items-center justify-center">
            <span className="text-lg">⭐</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSpin}
        disabled={disabled || spinning}
        className="w-44 h-11 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-base shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {spinning ? (
          <><Loader2Icon className="size-5 animate-spin" /> 抽奖中...</>
        ) : (
          '🎰 抽奖！'
        )}
      </button>
    </div>
  );
}
