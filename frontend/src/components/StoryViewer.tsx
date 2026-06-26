import { useEffect, useRef, useCallback, useState } from 'react';
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

export default function StoryViewer({ text, streaming, placeholder, waiting }: StoryViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const prevStreamingRef = useRef(false);

  // 检测用户是否向上滚动
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (!isAtBottom && streaming) {
      setUserScrolledUp(true);
      setShowJumpToBottom(true);
    } else {
      setUserScrolledUp(false);
      setShowJumpToBottom(false);
    }
  }, [streaming]);

  // 流式结束时，如果用户没主动向上翻，滚动到新内容开头（不是底部）
  useEffect(() => {
    if (prevStreamingRef.current && !streaming && !userScrolledUp) {
      // 流式刚刚结束 → 滚动到新内容起始标记
      if (markerRef.current) {
        markerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    prevStreamingRef.current = streaming;
  }, [streaming, userScrolledUp]);

  // 用户点击"跳到最新"
  const jumpToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    setUserScrolledUp(false);
    setShowJumpToBottom(false);
  };

  return (
    <Card>
      <CardContent className="pt-4 relative">
        {text ? (
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="prose prose-sm max-w-none dark:prose-invert h-96 overflow-y-auto p-2"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {text}
            </ReactMarkdown>

            {/* 新内容起始标记 */}
            <div ref={markerRef} />

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

        {/* 跳到最新按钮 */}
        {showJumpToBottom && streaming && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Button
              variant="secondary"
              size="sm"
              onClick={jumpToBottom}
              className="shadow-md text-xs gap-1"
            >
              <ArrowDownIcon className="size-3" /> 跳到最新
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
