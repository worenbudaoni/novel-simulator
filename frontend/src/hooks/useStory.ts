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
  label: string;
  targetNodeId: number;
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
  const [sessions, setSessions] = useState<any[]>([]);

  const createSession = useCallback(async (novelId: number, characterName?: string, attrs?: any) => {
    setLoading(true);
    try {
      const body: any = { novelId };
      if (characterName) body.characterName = characterName;
      if (attrs) {
        body.hp = attrs.hp; body.attack = attrs.attack; body.defense = attrs.defense;
        body.intelligence = attrs.intelligence; body.charm = attrs.charm; body.luck = attrs.luck;
      }
      const res = await api.post('/player/session/create', body);
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
    const sid = session?.sessionId;
    const res = await api.get(`/player/node/${nodeId}${sid ? `?sessionId=${sid}` : ''}`);
    if (res.data.code === 200) {
      setCurrentNode(res.data.data.node);
      setCurrentOptions([]);  // 清空旧选项，稍后由 generateOptions 填充
      if (res.data.data.character) {
        setCharacter(res.data.data.character);
      }
    }
  }, [session]);

  const generateOptions = useCallback(async (nodeId: number) => {
    if (!session?.sessionId) return;
    try {
      const res = await api.get(`/player/option/generate?sessionId=${session.sessionId}&nodeId=${nodeId}`);
      if (res.data.code === 200) {
        setCurrentOptions(res.data.data || []);
      } else {
        setCurrentOptions([]);
      }
    } catch (e) {
      setCurrentOptions([]);
      throw e;
    }
  }, [session]);

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

  const chooseAction = useCallback(async (targetNodeId: number, label: string) => {
    if (!session?.sessionId) return null;
    const res = await api.post('/player/action/choose', {
      sessionId: session.sessionId,
      targetNodeId,
      label,
    });
    if (res.data.code === 200) {
      const data = res.data.data;
      if (data.character) setCharacter(data.character);
      if (data.targetNode?.id) {
        await loadNode(data.targetNode.id);
      }
      return data;
    }
    return null;
  }, [session, loadNode]);

  const spinAction = useCallback(async () => {
    if (!session?.sessionId) return null;
    const res = await api.post('/player/action/spin', {
      sessionId: session.sessionId,
      nodeId: session.currentNodeId,
    });
    if (res.data.code === 200) {
      const data = res.data.data;
      if (data.character) setCharacter(data.character);
      return data;
    }
    return null;
  }, [session]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/player/session/list');
      if (res.data.code === 200) setSessions(res.data.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadBySessionId = useCallback(async (sid: string) => {
    setLoading(true);
    try {
      const res = await api.post('/player/session/load', { sessionId: sid });
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
    return null;
  }, [loadNode]);

  return {
    session, character, currentNode, currentOptions, loading, sessions,
    createSession, loadSession, loadBySessionId, fetchSessions,
    chooseAction, spinAction,
    loadNode, generateOptions,
    saveSession, restartSession, saveSettings,
  };
}
