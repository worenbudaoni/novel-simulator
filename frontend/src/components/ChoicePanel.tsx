import { Button } from 'src/components/ui/button';
import { Badge } from 'src/components/ui/badge';

export interface OptionItem {
  id: number;
  label: string;
  targetNodeId?: number;
  minIntelligence?: number;
  minCharm?: number;
}

interface CharacterInfo {
  intelligence: number;
  charm: number;
  currentTitle?: string;
}

interface ChoicePanelProps {
  options: OptionItem[];
  disabled?: boolean;
  onChoose: (optionId: number) => void;
  character?: CharacterInfo | null;
}

export default function ChoicePanel({ options, disabled, onChoose, character }: ChoicePanelProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">做出你的选择：</p>
      {options.map(opt => {
        const intelligenceReq = opt.minIntelligence || 0;
        const charmReq = opt.minCharm || 0;
        const hasIntelligence = character ? (character.intelligence || 0) >= intelligenceReq : true;
        const hasCharm = character ? (character.charm || 0) >= charmReq : true;
        const canAccess = hasIntelligence && hasCharm;

        return (
          <Button
            key={opt.id}
            variant="outline"
            disabled={disabled || !canAccess}
            onClick={() => canAccess && onChoose(opt.id)}
            className={`w-full justify-start text-left h-auto py-3 px-4 transition-colors ${
              canAccess
                ? 'hover:bg-accent hover:text-accent-foreground'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <span className="text-sm">{opt.label}</span>
            {!hasIntelligence && intelligenceReq > 0 && (
              <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">
                智力不足
              </Badge>
            )}
            {!hasCharm && charmReq > 0 && (
              <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">
                魅力不足
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
