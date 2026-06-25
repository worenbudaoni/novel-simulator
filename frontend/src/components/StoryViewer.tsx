import { useEffect, useRef } from 'react';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon } from 'lucide-react';

interface StoryViewerProps {
  text: string;
  streaming?: boolean;
  placeholder?: string;
}

export default function StoryViewer({ text, streaming, placeholder }: StoryViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [text]);

  return (
    <Card>
      <CardContent className="pt-4">
        {text ? (
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {placeholder || '故事即将开始...'}
          </p>
        )}
        {streaming && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" /> 生成中...
          </div>
        )}
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  );
}
