import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon, ArrowDownIcon } from 'lucide-react';
import { Button } from 'src/components/ui/button';

interface StoryViewerProps {
  text: string;
  streaming?: boolean;
  placeholder?: string;
  /** 新内容起始的字符位置。streaming=true 时自动滚动到此。 */
  contentStart?: number;
  /** CSS 隐藏（保持挂载以保留滚动位置） */
  hidden?: boolean;
}

export default function StoryViewer({ text, streaming, placeholder, contentStart, hidden: isHidden }: StoryViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef<HTMLDivElement>(null);
  const prevStreaming = useRef(false);
  const prevContentStart = useRef(contentStart);

  // 流式开始时 → 立即滚动到内容边界
  useEffect(() => {
    if (!prevStreaming.current && streaming && boundaryRef.current) {
      requestAnimationFrame(() => {
        boundaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    prevStreaming.current = streaming;
  }, [streaming]);

  // contentStart变化时（意味着新内容即将到来），立即滚动到边界
  useEffect(() => {
    if (contentStart && contentStart !== prevContentStart.current && boundaryRef.current && !streaming) {
      requestAnimationFrame(() => {
        boundaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    prevContentStart.current = contentStart;
  }, [contentStart, streaming]);

  // 按字符位置拆分：text[0..contentStart) 是旧内容，[contentStart..] 是新内容
  const hasBoundary = contentStart != null && contentStart > 0 && contentStart < text.length;
  const oldContent = hasBoundary ? text.slice(0, contentStart) : text;
  const newContent = hasBoundary ? text.slice(contentStart) : '';
  const hasNewText = newContent.trim().length > 0;
  const empty = !text || text.trim().length === 0;

  return (
    <Card className={isHidden ? 'hidden' : ''}>
      <CardContent className="pt-4 relative">
        {!empty ? (
          <div ref={containerRef} className="h-96 overflow-y-auto p-2 prose prose-sm max-w-none dark:prose-invert">
            {/* 旧内容 */}
            {!hasBoundary ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            ) : (
              <>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{oldContent}</ReactMarkdown>

                {/* 可视边界标记 */}
                <div ref={boundaryRef} className="border-t border-primary/20 my-4" />

                {/* 新内容 */}
                {hasNewText && (
                  <div className="animate-in fade-in duration-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{newContent}</ReactMarkdown>
                  </div>
                )}

                {/* 流式指示器 — 紧跟在边界下方 */}
                {streaming && (
                  <div className="flex items-center gap-2 my-3 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    <Loader2Icon className="size-4 animate-spin shrink-0" />
                    <span>故事生成中...</span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center">
            {streaming ? (
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
