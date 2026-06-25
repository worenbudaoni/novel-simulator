import { Button } from 'src/components/ui/button';
import { Badge } from 'src/components/ui/badge';

export interface OptionItem {
  id: number;
  label: string;
  riskHint?: string;
}

interface ChoicePanelProps {
  options: OptionItem[];
  disabled?: boolean;
  onChoose: (optionId: number) => void;
}

export default function ChoicePanel({ options, disabled, onChoose }: ChoicePanelProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">做出你的选择：</p>
      {options.map(opt => (
        <Button
          key={opt.id}
          variant="outline"
          disabled={disabled}
          onClick={() => onChoose(opt.id)}
          className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span className="text-sm">{opt.label}</span>
          {opt.riskHint && (
            <Badge variant="destructive" className="ml-auto text-[10px] shrink-0">{opt.riskHint}</Badge>
          )}
        </Button>
      ))}
    </div>
  );
}
