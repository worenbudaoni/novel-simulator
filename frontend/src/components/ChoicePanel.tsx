import { Button } from 'src/components/ui/button';

export interface OptionItem {
  label: string;
  targetNodeId: number;
}

interface ChoicePanelProps {
  options: OptionItem[];
  disabled?: boolean;
  onChoose: (targetNodeId: number, label: string) => void;
}

export default function ChoicePanel({ options, disabled, onChoose }: ChoicePanelProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">做出你的选择：</p>
      {options.map((opt, idx) => (
        <Button
          key={opt.targetNodeId + '-' + idx}
          variant="outline"
          disabled={disabled}
          onClick={() => onChoose(opt.targetNodeId, opt.label)}
          className="w-full justify-start text-left h-auto py-3 px-4 whitespace-normal break-words hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span className="text-sm leading-relaxed">{opt.label}</span>
        </Button>
      ))}
    </div>
  );
}
