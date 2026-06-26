import { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon, ArrowDownIcon } from 'lucide-react';
import { Button } from 'src/components/ui/button';

interface StoryViewerProps {
  text: string;
  streaming?: boolean;
  placeholder?: string;
  waiting?: boolean;
}

const DIVIDER = '📖 **故事继续**';

export default function StoryViewer({ text, streaming, placeholder, waiting }: StoryViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const wasStreaming = useRef(false);

  // 将文本在分隔标记处拆分为旧内容 + 新内容
  const { oldText, newText } = useMemo(() => {
    const idx = text.indexOf(DIVIDER);
    if (idx === -1) return { oldText: text, newText: '' };
    return {
      oldText: text.slice(0, idx),
      newText: text.slice(idx + DIVIDER.length),
    };
  }, [text]);

  // 流式结束时 → 滚动到分隔标记（新内容开头）
  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      // 延迟一帧确保 DOM 已更新
      requestAnimationFrame(() => {
        if (dividerRef.current) {
          dividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    wasStreaming.current = streaming;
  }, [streaming]);

  // 检测滚动位置，决定是否显示"跳到新内容"按钮
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!dividerRef.current || !streaming) { setShowJumpBtn(false); return; }
      const dividerTop = dividerRef.current.getBoundingClientRect().top;
      const containerTop = el.getBoundingClientRect().top;
      // 如果分隔标记在可视区上方超过一定距离，显示按钮
      setShowJumpBtn(dividerTop < containerTop - 60);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [streaming]);

  const jumpToDivider = () => {
    if (dividerRef.current) {
      dividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 判断是否有新内容需要标记
  const hasDivider = text.includes(DIVIDER);

  return (
    <Card>
      <CardContent className="pt-4 relative">
        {text ? (
          <div
            ref={containerRef}
            className="prose prose-sm max-w-none dark:prose-invert h-96 overflow-y-auto p-2"
          >
            {/* 旧内容 */}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {oldText || ' '}
            </ReactMarkdown>

            {/* 可视分隔标记（带 ref，用于滚动定位） */}
            {hasDivider && (
              <div ref={dividerRef} className="border-t border-primary/20 my-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-primary/60">
                  <BookOpenIcon className="size-4" />
                  <span className="font-medium">故事继续</span>
                </div>
              </div>
            )}

            {/* 新内容 */}
            {newText && (
              <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {newText}
                </ReactMarkdown>
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

        {/* 跳到新内容按钮 */}
        {showJumpBtn && hasDivider && streaming && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Button
              variant="secondary"
              size="sm"
              onClick={jumpToDivider}
              className="shadow-md text-xs gap-1"
            >
              <ArrowDownIcon className="size-3" /> 跳到新内容
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
