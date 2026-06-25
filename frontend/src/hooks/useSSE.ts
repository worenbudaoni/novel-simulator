import { useState, useEffect, useRef, useCallback } from 'react';

interface SSEOptions {
  onStory?: (text: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export function useSSE() {
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef<SSEOptions>({});

  const connect = useCallback((sessionId: string, options?: SSEOptions) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    optionsRef.current = options || {};
    const url = `/api/player/story/stream/${sessionId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setConnected(true);
    setStreaming(true);

    es.addEventListener('story', (event) => {
      if (optionsRef.current.onStory) {
        optionsRef.current.onStory(event.data);
      }
    });

    es.addEventListener('done', () => {
      setStreaming(false);
      if (optionsRef.current.onDone) optionsRef.current.onDone();
      es.close();
      setConnected(false);
    });

    es.addEventListener('error', (event) => {
      const msg = (event as any)?.data || '连接错误';
      if (optionsRef.current.onError) optionsRef.current.onError(msg);
      setStreaming(false);
      setConnected(false);
      es.close();
    });

    es.onerror = () => {
      setStreaming(false);
      setConnected(false);
      es.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
    setStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  return { connected, streaming, connect, disconnect };
}
