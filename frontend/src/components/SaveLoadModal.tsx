import { useState, useEffect } from 'react';
import { Button } from 'src/components/ui/button';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon, SaveIcon, UploadIcon, ClockIcon } from 'lucide-react';
import { useStory } from '@/hooks/useStory';
import { toast } from 'sonner';

interface SaveLoadModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SaveLoadModal({ open, onClose }: SaveLoadModalProps) {
  const { sessions, fetchSessions, loadBySessionId, saveSession, loadSession } = useStory();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchSessions().finally(() => setLoading(false));
    }
  }, [open, fetchSessions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSession();
      toast.success('存档成功');
      await fetchSessions();
    } finally { setSaving(false); }
  };

  const handleLoad = async (sessionId: string) => {
    if (!confirm('确定读档？当前未保存的进度将丢失。')) return;
    setLoading(true);
    try {
      await loadBySessionId(sessionId);
      toast.success('读档成功');
      onClose();
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="max-w-md w-full max-h-[80vh] flex flex-col">
        <CardContent className="pt-5 pb-4 flex flex-col gap-4 flex-1 min-h-0">
          <h2 className="text-lg font-semibold text-center">存档管理</h2>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <><Loader2Icon className="size-4 animate-spin mr-2" /> 保存中...</> : <><SaveIcon className="size-4 mr-2" /> 保存当前进度</>}
            </Button>
            <Button variant="outline" onClick={onClose} className="shrink-0">关闭</Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2Icon className="size-4 animate-spin mr-2" /> 加载中...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                暂无存档记录
              </div>
            ) : sessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.lastSaveAt ? new Date(s.lastSaveAt).toLocaleString('zh-CN') : '未保存'}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleLoad(s.sessionId)}>
                  <UploadIcon className="size-3 mr-1" /> 读档
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
