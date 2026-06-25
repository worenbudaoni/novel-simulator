import { useState, useCallback } from 'react';
import { ChevronRightIcon, ChevronDownIcon } from 'lucide-react';

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

  return (
    <div className="space-y-0.5">
      {data.map(node => (
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
  );
}
