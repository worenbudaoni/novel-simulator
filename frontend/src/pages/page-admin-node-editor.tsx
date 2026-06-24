import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Badge } from 'src/components/ui/badge';
import { Input } from 'src/components/ui/input';
import { Textarea } from 'src/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import {
  ArrowLeftIcon, PlusIcon, SaveIcon, Loader2Icon, GitBranchIcon,
  Trash2Icon, GripVerticalIcon,
} from 'lucide-react';

interface NodeData {
  id?: number;
  novelId?: number;
  title: string;
  description: string;
  nodeType: number;
  isStart: boolean;
  isEnd: boolean;
  sortOrder: number;
}

export default function AdminNodeEditorPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!novelId) return;
    setLoading(true);
    api.get(`/admin/novel/${novelId}/nodes`).then(res => {
      if (res.data.code === 200) {
        setNodes(res.data.data.nodes || []);
        setEdges(res.data.data.edges || []);
        setOptions(res.data.data.options || []);
      }
    }).finally(() => setLoading(false));
  }, [novelId]);

  const addNode = () => {
    const idx = nodes.length;
    setNodes([...nodes, {
      title: '新节点',
      description: '',
      nodeType: 0,
      isStart: idx === 0,
      isEnd: false,
      sortOrder: idx,
    }]);
    setExpanded(idx);
  };

  const updateNode = (index: number, field: string, value: any) => {
    setNodes(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      return updated;
    });
  };

  const removeNode = (index: number) => {
    setNodes(prev => prev.filter((_, i) => i !== index));
    if (expanded === index) setExpanded(null);
  };

  const moveNode = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return;
    setNodes(prev => {
      const updated = [...prev];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated.map((n, i) => ({ ...n, sortOrder: i }));
    });
  };

  const saveAll = async () => {
    if (!novelId) return;
    setSaving(true);
    try {
      const res = await api.put(`/admin/novel/${novelId}/nodes`, {
        nodes: nodes.map((n, i) => ({ ...n, sortOrder: i })),
        edges,
        options,
      });
      if (res.data.code === 200) {
        toast.success('保存成功');
        // Reload to get updated IDs
        const reload = await api.get(`/admin/novel/${novelId}/nodes`);
        if (reload.data.code === 200) {
          setNodes(reload.data.data.nodes || []);
          setEdges(reload.data.data.edges || []);
          setOptions(reload.data.data.options || []);
        }
      }
    } finally {
      setSaving(false);
    }
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
          <h2 className="text-lg font-semibold">节点编辑器</h2>
          <Badge variant="outline">{nodes.length} 节点 / {edges.length} 连接 / {options.length} 选项</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addNode}>
            <PlusIcon className="size-4 mr-1" /> 添加节点
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving
              ? <><Loader2Icon className="size-4 animate-spin mr-1" /> 保存中...</>
              : <><SaveIcon className="size-4 mr-1" /> 保存</>}
          </Button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <GitBranchIcon className="size-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-3">暂无节点数据</p>
          <Button variant="outline" onClick={addNode}>
            <PlusIcon className="size-4 mr-1" /> 添加第一个节点
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node, idx) => (
            <Card key={idx} className={node.isStart ? 'border-l-4 border-l-primary' : ''}>
              <CardHeader className="py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 font-mono">#{idx + 1}</span>
                  <span className="text-sm font-medium flex-1 truncate">{node.title || '未命名'}</span>
                  {node.isStart && <Badge variant="default" className="text-[10px] h-4">起点</Badge>}
                  {node.isEnd && <Badge variant="secondary" className="text-[10px] h-4">结局</Badge>}
                  <div className="flex gap-0.5 ml-auto">
                    <Button variant="ghost" size="icon-sm" onClick={() => moveNode(idx, -1)} disabled={idx === 0}>
                      <span className="text-xs">▲</span>
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => moveNode(idx, 1)} disabled={idx === nodes.length - 1}>
                      <span className="text-xs">▼</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setExpanded(expanded === idx ? null : idx)}
                    >
                      <span className="text-xs">{expanded === idx ? '收起' : '编辑'}</span>
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeNode(idx)}>
                      <Trash2Icon className="size-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expanded === idx && (
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">标题</label>
                    <Input
                      value={node.title}
                      onChange={e => updateNode(idx, 'title', e.target.value)}
                      placeholder="节点标题"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">描述</label>
                    <Textarea
                      value={node.description || ''}
                      onChange={e => updateNode(idx, 'description', e.target.value)}
                      placeholder="节点描述 / 场景介绍"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={node.isStart}
                        onChange={e => updateNode(idx, 'isStart', e.target.checked)}
                        className="rounded"
                      />
                      起始节点
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={node.isEnd}
                        onChange={e => updateNode(idx, 'isEnd', e.target.checked)}
                        className="rounded"
                      />
                      结局节点
                    </label>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
