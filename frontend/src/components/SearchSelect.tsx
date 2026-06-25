import { useState } from 'react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from 'src/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from 'src/components/ui/command';
import { ChevronDownIcon, CheckIcon } from 'lucide-react';
import { cn } from 'src/lib/utils';

export interface SearchSelectOption {
  value: string;
  label: string;
  depth: number;
  path?: string;
}

interface SearchSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export default function SearchSelect({
  value, onValueChange, options, placeholder = '请选择', emptyText = '未找到', className,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.path || selected?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-placeholder:text-muted-foreground data-[size=default]:h-8 dark:bg-input/30 dark:hover:bg-input/50',
          className,
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.path || ''}`}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <span style={{ display: 'inline-block', paddingLeft: `${opt.depth * 20}px` }}>
                    {opt.label}
                  </span>
                  {value === opt.value && (
                    <CheckIcon className="ml-auto size-3.5 shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
