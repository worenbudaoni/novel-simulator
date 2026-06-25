import { useState, useCallback } from 'react';
import api from '@/hooks/useApi';

export interface NodeData {
  id: number;
  novelId: number;
  title: string;
  description: string;
  nodeType: number;
  isStart: boolean;
  isEnd: boolean;
  sortOrder: number;
}

export interface NodeOption {
  id: number;
  nodeId: number;
  label: string;
  targetNodeId?: number;
  triggerEvent: boolean;
  riskHint?: string;
}

export interface CharacterData {
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  currentTitle?: string;
  choicesMade: number;
  eventsTriggered: number;
  timesDied: number;
}

export interface SessionData {
  sessionId: string;
  novelId: number;
  userId?: number;
  currentNodeId: number;
  historyPath: string;
  storyText: string;
  settingsJson?: string;
}

export function useStory() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [currentNode, setCurrentNode] = useState<NodeData | null>(null);
  const [currentOptions, setCurrentOptions] = useState<NodeOption[]>([]);
  const [loading, setLoading] = useState(false);

  const createSession = useCallback(async (novelId: number) => {
    setLoading(true);
    try {
      const res = await api.post('/player/session/create', { novelId });
      if (res.data.code === 200) {
        const data = res.data.data;
        setSession(data.session);
        setCharacter(data.character);
        if (data.session?.currentNodeId) {
          await loadNode(data.session.currentNodeId);
        }
        return data;
      }
    } finally { setLoading(false); }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/player/session/${sessionId}`);
      if (res.data.code === 200) {
        const data = res.data.data;
        setSession(data.session);
        setCharacter(data.character);
        if (data.session?.currentNodeId) {
          await loadNode(data.session.currentNodeId);
        }
      }
    } finally { setLoading(false); }
  }, []);

  const loadNode = useCallback(async (nodeId: number) => {
    const res = await api.get(`/player/node/${nodeId}`);
    if (res.data.code === 200) {
      setCurrentNode(res.data.data.node);
      setCurrentOptions(res.data.data.options || []);
    }
  }, []);

  const saveSession = useCallback(async () => {
    if (!session?.sessionId) return;
    await api.post('/player/session/save', { sessionId: session.sessionId });
  }, [session]);

  const restartSession = useCallback(async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      const res = await api.post('/player/session/restart', { sessionId: session.sessionId });
      if (res.data.code === 200) {
        const data = res.data.data;
        setSession(data.session);
        setCharacter(data.character);
        if (data.session?.currentNodeId) {
          await loadNode(data.session.currentNodeId);
        }
      }
    } finally { setLoading(false); }
  }, [session, loadNode]);

  const saveSettings = useCallback(async (settings: Record<string, any>) => {
    if (!session?.sessionId) return;
    await api.post('/player/session/settings', { sessionId: session.sessionId, settings });
  }, [session]);

  return {
    session, character, currentNode, currentOptions, loading,
    createSession, loadSession, loadNode, saveSession, restartSession, saveSettings,
  };
}
