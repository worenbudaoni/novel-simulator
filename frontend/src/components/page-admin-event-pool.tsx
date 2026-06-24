import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Textarea } from 'src/components/ui/textarea';
import { Badge } from 'src/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from 'src/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import {
  ArrowLeftIcon, PlusIcon, SaveIcon, Loader2Icon,
  PencilIcon, Trash2Icon, ZapIcon,
} from 'lucide-react';

interface RandomEvent {
  id?: number;
  novelId?: number;
  nodeId?: number;
  title: string;
  content: string;
  eventType: number;
  deathProbability: number;
  attrChanges: string;
  weight: number;
}

export default function AdminEventPoolPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<RandomEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RandomEvent | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!novelId) return;
    setLoading(true);
    api.get(`/api/admin/novel/${novelId}/events`).then(res => {
      if (res.data.code === 200) {
        setEvents(res.data.data || []);
      }
    }).finally(() => setLoading(false));
  }, [novelId]);

  const openNew = () => {
    setEditingEvent({ title: '', content: '', eventType: 2, deathProbability: 0, attrChanges: '{}', weight: 10 });
    setEditingIndex(null);
    setShowDialog(true);
  };

  const openEdit = (event: RandomEvent, idx: number) => {
    setEditingEvent({ ...event });
    setEditingIndex(idx);
    setShowDialog(true);
  };

  const saveEvent = () => {
    if (!editingEvent || !editingEvent.title.trim()) {
      toast.error('请输入事件标题');
      return;
    }
    if (editingIndex !== null) {
      setEvents(events.map((e, i) => i === editingIndex ? editingEvent : e));
    } else {
      setEvents([...events, { ...editingEvent }]);
    }
    setShowDialog(false);
    setEditingEvent(null);
    setEditingIndex(null);
  };

  const removeEvent = (idx: number) => {
    setEvents(events.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    if (!novelId) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/admin/novel/${novelId}/events`, { events });
      if (res.data.code === 200) {
        toast.success('保存成功');
      }
    } finally {
      setSaving(false);
    }
  };

  const eventTypeLabel = (t: number) => ['正面', '负面', '中立'][t] || '未知';
  const eventTypeColor = (t: number) => {
    if (t === 0) return 'text-green-600';
    if (t === 1) return 'text-red-600';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">事件管理</h2>
          <Badge variant="outline">{events.length} 事件</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openNew}>
            <PlusIcon className="size-4 mr-1" /> 添加事件
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving
              ? <><Loader2Icon className="size-4 animate-spin mr-1" /> 保存中...</>
              : <><SaveIcon className="size-4 mr-1" /> 保存</>}
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ZapIcon className="size-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-3">暂无事件数据</p>
          <Button variant="outline" onClick={openNew}>
            <PlusIcon className="size-4 mr-1" /> 添加第一个事件
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>死亡率</TableHead>
                <TableHead>权重</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event, idx) => (
                <TableRow key={event.id || idx}>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell className={eventTypeColor(event.eventType)}>
                    {eventTypeLabel(event.eventType)}
                  </TableCell>
                  <TableCell>{event.deathProbability}%</TableCell>
                  <TableCell>{event.weight}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(event, idx)}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeEvent(idx)}>
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? '编辑事件' : '新建事件'}</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">标题 *</label>
                <Input
                  value={editingEvent.title}
                  onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  placeholder="事件标题"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">内容描述</label>
                <Textarea
                  value={editingEvent.content}
                  onChange={e => setEditingEvent({ ...editingEvent, content: e.target.value })}
                  placeholder="事件描述文本"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">类型</label>
                  <select
                    value={editingEvent.eventType}
                    onChange={e => setEditingEvent({ ...editingEvent, eventType: Number(e.target.value) })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                  >
                    <option value={0}>正面</option>
                    <option value={1}>负面</option>
                    <option value={2}>中立</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">死亡率 (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editingEvent.deathProbability}
                    onChange={e => setEditingEvent({ ...editingEvent, deathProbability: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">权重</label>
                  <Input
                    type="number"
                    min={1}
                    value={editingEvent.weight}
                    onChange={e => setEditingEvent({ ...editingEvent, weight: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">属性变化 (JSON)</label>
                <Input
                  value={editingEvent.attrChanges}
                  onChange={e => setEditingEvent({ ...editingEvent, attrChanges: e.target.value })}
                  placeholder='{"hp": -20, "attack": 5}'
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={saveEvent}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
