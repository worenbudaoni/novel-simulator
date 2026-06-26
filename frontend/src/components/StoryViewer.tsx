import { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon, ArrowDownIcon, BookOpenIcon } from 'lucide-react';
import { Button } from 'src/components/ui/button';

interface StoryViewerProps {
  text: string;
  streaming?: boolean;
  placeholder?: string;
}

const DIVIDER = '<!--NEW-STORY-->';

export default function StoryViewer({ text, streaming, placeholder }: StoryViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const wasStreaming = useRef(false);

  // 在分隔标记处拆分：分隔之前是旧内容，分隔之后是新内容
  const { hasDivider, oldContent, newContent } = useMemo(() => {
    const idx = text.indexOf(DIVIDER);
    if (idx === -1) return { hasDivider: false, oldContent: text, newContent: '' };
    const before = text.slice(0, idx);
    const after = text.slice(idx + DIVIDER.length);
    return { hasDivider: true, oldContent: before, newContent: after };
  }, [text]);

  const hasNewText = newContent.trim().length > 0;

  // 流式结束 → 滚动到分隔标记（新内容开头）
  useEffect(() => {
    if (wasStreaming.current && !streaming && dividerRef.current) {
      requestAnimationFrame(() => {
        dividerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    wasStreaming.current = streaming;
  }, [streaming]);

  // 滚动监测：分隔标记离开视口时显示"跳到新内容"按钮
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !streaming) { setShowJumpBtn(false); return; }
    const onScroll = () => {
      if (!dividerRef.current) { setShowJumpBtn(false); return; }
      const db = dividerRef.current.getBoundingClientRect();
      const cb = el.getBoundingClientRect();
      setShowJumpBtn(db.top < cb.top - 40);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [streaming]);

  const jumpToDivider = () => {
    dividerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Card>
      <CardContent className="pt-4 relative">
        {text ? (
          <div ref={containerRef} className="h-96 overflow-y-auto p-2 prose prose-sm max-w-none dark:prose-invert">
            {/* 旧内容 */}
            {oldContent && (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{oldContent}</ReactMarkdown>
            )}

            {/* 分隔标记 */}
            {hasDivider && (
              <div ref={dividerRef} className="border-t border-primary/20 my-4 pt-2" />
            )}

            {/* 新内容 */}
            {hasNewText && (
              <div className="animate-in fade-in duration-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{newContent}</ReactMarkdown>
              </div>
            )}

            {streaming && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" /> 生成中...
              </div>
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

        {showJumpBtn && hasDivider && streaming && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Button variant="secondary" size="sm" onClick={jumpToDivider} className="shadow-md text-xs gap-1">
              <ArrowDownIcon className="size-3" /> 跳到新内容
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
