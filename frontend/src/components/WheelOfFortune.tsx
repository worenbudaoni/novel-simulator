import { useState } from 'react';
import { Button } from 'src/components/ui/button';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon, SparklesIcon } from 'lucide-react';

interface WheelOfFortuneProps {
  onSpin: () => void;
  disabled?: boolean;
  spinning?: boolean;
}

export default function WheelOfFortune({ onSpin, disabled, spinning }: WheelOfFortuneProps) {
  const [rotation, setRotation] = useState(0);

  const handleSpin = () => {
    setRotation(prev => prev + 720 + Math.random() * 360);
    onSpin();
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
      <CardContent className="py-4">
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg transition-transform duration-1000 ease-out"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <SparklesIcon className="size-8 text-white" />
          </div>
          <Button
            onClick={handleSpin}
            disabled={disabled || spinning}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
            size="lg"
          >
            {spinning ? (
              <><Loader2Icon className="size-4 animate-spin mr-2" /> 抽奖中...</>
            ) : (
              '🎰 转盘抽奖'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
