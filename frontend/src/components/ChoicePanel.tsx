import { Button } from 'src/components/ui/button';
import type { ChoiceOption } from '@/types';

interface ChoicePanelProps {
  options: ChoiceOption[];
  disabled?: boolean;
  onChoose: (option: ChoiceOption) => void;
}

const riskStyle: Record<string, { label: string; tagCls: string; borderCls: string }> = {
  safe:    { label: '安全', tagCls: 'bg-green-100 text-green-700', borderCls: 'border-green-200' },
  risky:   { label: '冒险', tagCls: 'bg-amber-100 text-amber-700', borderCls: 'border-amber-300' },
  daring:  { label: '高危', tagCls: 'bg-red-100 text-red-700', borderCls: 'border-red-300' },
};

export default function ChoicePanel({ options, disabled, onChoose }: ChoicePanelProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">做出你的选择：</p>
      {options.map((opt, idx) => {
        const style = riskStyle[opt.riskLevel] || riskStyle.safe;
        return (
          <Button
            key={opt.targetNodeId + '-' + idx}
            variant="outline"
            disabled={disabled}
            onClick={() => onChoose(opt)}
            className={`w-full justify-start text-left h-auto py-3 px-4 whitespace-normal break-words
              hover:bg-accent hover:text-accent-foreground transition-colors ${style.borderCls}`}
          >
            <div className="flex flex-col w-full gap-1">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${style.tagCls}`}>
                  {style.label}
                </span>
                <span className="text-sm leading-relaxed">{opt.label}</span>
              </div>
              {opt.expectedOutcome && (
                <span className="text-xs text-muted-foreground ml-1">{opt.expectedOutcome}</span>
              )}
              {opt.attrHint && opt.riskLevel !== 'safe' && (
                <span className="text-[11px] text-amber-600 ml-1">{opt.attrHint}</span>
              )}
            </div>
          </Button>
        );
      })}
    </div>
  );
}
