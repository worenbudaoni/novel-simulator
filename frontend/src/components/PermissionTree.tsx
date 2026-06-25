import { useState, useCallback, useMemo } from 'react';
import { ChevronRightIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { Input } from 'src/components/ui/input';

interface TreeNode {
  id: number;
  name: string;
  code: string;
  type: number;
  children?: TreeNode[];
}

interface PermissionTreeProps {
  data: TreeNode[];
  selectedIds: number[];
  onSelectChange: (ids: number[]) => void;
}

function collectAllIds(node: TreeNode): number[] {
  const ids = [node.id];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...collectAllIds(child));
    }
  }
  return ids;
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  selectedIds: number[];
  onSelectChange: (ids: number[]) => void;
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
}

function TreeNodeItemInner({
  node,
  depth,
  selectedIds,
  onSelectChange,
  expandedIds,
  onToggleExpand,
}: TreeNodeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const allIds = collectAllIds(node);
  const selectedCount = allIds.filter(id => selectedIds.includes(id)).length;
  const allSelected = selectedCount === allIds.length;
  const indeterminate = selectedCount > 0 && selectedCount < allIds.length;

  const handleCheck = () => {
    if (allSelected) {
      const removeSet = new Set(allIds);
      onSelectChange(selectedIds.filter(id => !removeSet.has(id)));
    } else {
      const newIds = new Set(selectedIds);
      for (const id of allIds) {
        newIds.add(id);
      }
      onSelectChange(Array.from(newIds));
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 text-sm hover:bg-muted/30 rounded-sm transition-colors cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 18}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggleExpand(node.id)}
          className={`p-0.5 shrink-0 ${hasChildren ? 'cursor-pointer' : 'invisible'}`}
        >
          {isExpanded ? (
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-3.5 text-muted-foreground" />
          )}
        </button>
        <label className="flex items-center gap-2 flex-1 cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = indeterminate;
            }}
            onChange={handleCheck}
            className="size-4 rounded accent-primary cursor-pointer"
          />
          <span className={`font-medium ${node.type === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
            {node.name}
          </span>
          <code className="text-xs text-muted-foreground ml-1">{node.code}</code>
        </label>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <TreeNodeItemInner
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              onSelectChange={onSelectChange}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PermissionTree({ data, selectedIds, onSelectChange }: PermissionTreeProps) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    const collect = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        ids.add(n.id);
        if (n.children) collect(n.children);
      }
    };
    collect(data);
    return ids;
  });

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // 搜索过滤：父节点匹配时保留全部子节点
  const filteredData = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    const filterTree = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        const selfMatch = node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
        const filteredChildren = node.children ? filterTree(node.children) : [];
        if (selfMatch) {
          result.push(node);
        } else if (filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren });
        }
      }
      return result;
    };
    return filterTree(data);
  }, [data, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="搜索权限..."
          value={search}
          onChange={e => { setSearch(e.target.value); setExpandedIds(new Set(data.flatMap(collectAllIds))); }}
          className="pl-8 h-8 text-sm"
        />
      </div>
      <div className="space-y-0.5">
        {filteredData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">无匹配权限</p>
        ) : filteredData.map(node => (
          <TreeNodeItemInner
            key={node.id}
            node={node}
            depth={0}
            selectedIds={selectedIds}
            onSelectChange={onSelectChange}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>
    </div>
  );
}
