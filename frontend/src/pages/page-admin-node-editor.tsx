import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, addEdge, useNodesState, useEdgesState, Controls, Background,
  Handle, Position, MarkerType,
  type Connection, type Node, type Edge, type NodeProps, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Textarea } from 'src/components/ui/textarea';
import { Badge } from 'src/components/ui/badge';
import { Separator } from 'src/components/ui/separator';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import {
  ArrowLeftIcon, PlusIcon, SaveIcon, Loader2Icon, Trash2Icon,
} from 'lucide-react';

interface NovelNode {
  id?: number;
  novelId?: number;
  title: string;
  description: string;
  nodeType: number;
  isStart: boolean;
  isEnd: boolean;
  sortOrder: number;
}

interface NovelEdge {
  id?: number;
  sourceNodeId: number;
  targetNodeId: number;
  conditionDesc?: string;
  edgeType?: number;
}

// --- Custom Node Component ---
function GraphNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 shadow-md bg-white min-w-[140px] transition-shadow relative ${
      selected ? 'border-primary shadow-lg ring-2 ring-primary/20' :
      data.isStart ? 'border-emerald-400' :
      data.isEnd ? 'border-amber-400' :
      'border-border'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !border-2 !border-white !size-3" />
      <div className="text-sm font-medium truncate max-w-[180px]">{data.label}</div>
      <div className="flex gap-1 mt-1.5">
        {data.isStart && <Badge variant="default" className="text-[9px] h-4 px-1">起点</Badge>}
        {data.isEnd && <Badge variant="secondary" className="text-[9px] h-4 px-1">结局</Badge>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !border-2 !border-white !size-3" />
    </div>
  );
}

const nodeTypes: NodeTypes = { graphNode: GraphNode };

export default function AdminNodeEditorPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // RF nodes/edges state
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Original data for saving
  const [originalNodes, setOriginalNodes] = useState<Map<string, NovelNode>>(new Map());
  const [dbEdges, setDbEdges] = useState<NovelEdge[]>([]);

  // Selected node for editing
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIsStart, setEditIsStart] = useState(false);
  const [editIsEnd, setEditIsEnd] = useState(false);

  // Convert backend nodes to RF nodes
  const toRfNodes = (nodes: NovelNode[], edges: NovelEdge[]): { nodes: Node[]; edges: Edge[] } => {
    const edgeMap = new Map<string, number>();
    edges.forEach(e => {
      edgeMap.set(`${e.sourceNodeId}->${e.targetNodeId}`, e.sourceNodeId);
    });

    const rfNodes: Node[] = nodes.map((n, i) => {
      const nodeId = n.id ? `db-${n.id}` : `new-${i}`;
      return {
        id: nodeId,
        type: 'graphNode',
        position: {
          x: 150 + (i % 3) * 220,
          y: 80 + Math.floor(i / 3) * 160,
        },
        data: { label: n.title || '未命名', isStart: n.isStart, isEnd: n.isEnd },
        origin: [0.5, 0.5],
      };
    });

    const idMap = new Map<string, string>();
    nodes.forEach((n, i) => {
      if (n.id) idMap.set(String(n.id), `db-${n.id}`);
    });

    const rfEdges: Edge[] = edges.map(e => {
      let src = idMap.get(String(e.sourceNodeId));
      let tgt = idMap.get(String(e.targetNodeId));
      // Fallback: use index in nodes array
      if (!src || !tgt) {
        const srcIdx = nodes.findIndex(n => n.id === e.sourceNodeId);
        const tgtIdx = nodes.findIndex(n => n.id === e.targetNodeId);
        if (srcIdx >= 0) src = `db-${nodes[srcIdx].id}`;
        if (tgtIdx >= 0) tgt = `db-${nodes[tgtIdx].id}`;
      }
      if (!src || !tgt) return null as any;
      return {
        id: `e-${e.sourceNodeId}-${e.targetNodeId}`,
        source: src,
        target: tgt,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 },
      };
    }).filter(Boolean);

    return { nodes: rfNodes, edges: rfEdges };
  };

  // Load data
  useEffect(() => {
    if (!novelId) return;
    setLoading(true);
    api.get(`/admin/novel/${novelId}/nodes`).then(res => {
      if (res.data.code === 200) {
        const nodes: NovelNode[] = res.data.data.nodes || [];
        const edges: NovelEdge[] = res.data.data.edges || [];
        console.log('Nodes:', nodes);
        console.log('Edges:', edges);
        setDbEdges(edges);
        // Store original node data map
        const map = new Map<string, NovelNode>();
        nodes.forEach(n => { if (n.id) map.set(`db-${n.id}`, n); });
        setOriginalNodes(map);
        // Convert to RF
        const { nodes: rfN, edges: rfE } = toRfNodes(nodes, edges);
        setRfNodes(rfN);
        setRfEdges(rfE);
      }
    }).finally(() => setLoading(false));
  }, [novelId]);

  // Selection handler
  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
    setEditTitle(node.data.label);
    const orig = originalNodes.get(node.id);
    setEditDesc(orig?.description || '');
    setEditIsStart(!!node.data.isStart);
    setEditIsEnd(!!node.data.isEnd);
  }, [originalNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Connect handler
  const onConnect = useCallback((params: Connection) => {
    setRfEdges(eds => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }, eds));
  }, [setRfEdges]);

  // Update node from sidebar
  const updateSelectedNode = (field: string, value: any) => {
    setRfNodes(nds => nds.map(n => {
      if (n.id !== selectedNodeId) return n;
      const newData = { ...n.data };
      if (field === 'title') { newData.label = value; setEditTitle(value); }
      if (field === 'isStart') { newData.isStart = value; setEditIsStart(value); }
      if (field === 'isEnd') { newData.isEnd = value; setEditIsEnd(value); }
      return { ...n, data: newData };
    }));
  };

  // Add node
  const addNode = () => {
    const id = `new-${Date.now()}`;
    const count = rfNodes.length;
    setRfNodes(nds => [...nds, {
      id,
      type: 'graphNode',
      position: { x: 150 + (count % 3) * 220, y: 80 + Math.floor(count / 3) * 160 },
      data: { label: '新节点', isStart: false, isEnd: false },
    }]);
  };

  // Delete selected node
  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setRfNodes(nds => nds.filter(n => n.id !== selectedNodeId));
    setRfEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  // Save
  const saveAll = async () => {
    if (!novelId) return;
    setSaving(true);
    try {
      // Build id mapping: old DB id → new RF node id
      const nodeIdToDbId = new Map<string, number>();
      originalNodes.forEach((n, rfId) => { if (n.id) nodeIdToDbId.set(rfId, n.id); });

      // Build novel nodes array
      const novelNodes: NovelNode[] = rfNodes.map(n => {
        const existing = originalNodes.get(n.id);
        return {
          id: existing?.id,
          novelId: Number(novelId),
          title: (n.data as any).label || '未命名',
          description: existing?.description || '',
          nodeType: 0,
          isStart: !!(n.data as any).isStart,
          isEnd: !!(n.data as any).isEnd,
          sortOrder: 0,
        };
      });

      // Build edges: RF edge → source/target node indexes
      const rfNodeIds = rfNodes.map(n => n.id);
      const novelEdges = rfEdges.map(e => {
        const srcIdx = rfNodeIds.indexOf(e.source);
        const tgtIdx = rfNodeIds.indexOf(e.target);
        if (srcIdx === -1 || tgtIdx === -1) return null;
        return {
          id: undefined as number | undefined,
          sourceNodeId: srcIdx, // index, will be mapped by backend
          targetNodeId: tgtIdx,
          conditionDesc: '',
          edgeType: 0,
        };
      }).filter(Boolean) as NovelEdge[];

      const res = await api.put(`/admin/novel/${novelId}/nodes`, {
        nodes: novelNodes,
        edges: novelEdges,
      });
      if (res.data.code === 200) {
        toast.success('保存成功');
        // Reload
        const reload = await api.get(`/admin/novel/${novelId}/nodes`);
        if (reload.data.code === 200) {
          const nodes: NovelNode[] = reload.data.data.nodes || [];
          const edges: NovelEdge[] = reload.data.data.edges || [];
          setDbEdges(edges);
          const map = new Map<string, NovelNode>();
          nodes.forEach(n => { if (n.id) map.set(`db-${n.id}`, n); });
          setOriginalNodes(map);
          const { nodes: rfN, edges: rfE } = toRfNodes(nodes, edges);
          setRfNodes(rfN);
          setRfEdges(rfE);
          setSelectedNodeId(null);
        }
      }
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  const selectedNode = rfNodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">节点编辑器</h2>
          <Badge variant="outline">{rfNodes.length} 节点 / {rfEdges.length} 连接</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addNode}>
            <PlusIcon className="size-4 mr-1" /> 添加节点
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <><Loader2Icon className="size-4 animate-spin mr-1" /> 保存中...</> : <><SaveIcon className="size-4 mr-1" /> 保存</>}
          </Button>
        </div>
      </div>

      {/* Main area: canvas + property panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 rounded-xl border bg-muted/10">
          {rfNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="mb-3">暂无节点</p>
                <Button variant="outline" onClick={addNode}>添加第一个节点</Button>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[20, 20]}
              deleteKeyCode="Delete"
            >
              <Controls />
              <Background gap={20} size={1} />
            </ReactFlow>
          )}
        </div>

        {/* Property Panel */}
        <div className="w-72 shrink-0 rounded-xl border bg-background p-4 flex flex-col">
          {selectedNode ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">节点属性</h3>
                <Button variant="ghost" size="icon-sm" onClick={deleteSelectedNode}>
                  <Trash2Icon className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="space-y-3 flex-1">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">标题</label>
                  <Input value={editTitle} onChange={e => updateSelectedNode('title', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">描述</label>
                  <Textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={4}
                    placeholder="节点描述"
                  />
                </div>
                <div className="flex gap-3 text-sm pt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={editIsStart} onChange={e => updateSelectedNode('isStart', e.target.checked)} className="rounded" />
                    起始节点
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={editIsEnd} onChange={e => updateSelectedNode('isEnd', e.target.checked)} className="rounded" />
                    结局节点
                  </label>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>点击节点选中</p>
                  <p>拖拽节点移动</p>
                  <p>拖拽连线创建连接</p>
                  <p>按 Delete 删除节点</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              <div className="text-center space-y-1">
                <p>点击节点编辑属性</p>
                <p>拖拽连线创建关联</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
