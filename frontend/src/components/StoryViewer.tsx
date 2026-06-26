import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon } from 'lucide-react';

interface StoryViewerProps {
  text: string;
  streaming?: boolean;
  placeholder?: string;
  waiting?: boolean;     // SSE 等待中
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
          <div className="prose prose-sm max-w-none dark:prose-invert h-96 overflow-y-auto p-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {text}
            </ReactMarkdown>
            {streaming && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" /> 生成中...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center">
            {waiting ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-5 animate-spin" />
                <span>故事生成中...</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {placeholder || '故事即将开始...'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
