"use client";

import { cn } from "cn";
import type { ElementNode } from "@/lib/design/element-tree";

type Props = {
  nodes: ElementNode[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string | null) => void;
};

const TEXT_LENGTH = 32;

function Row({ node, selectedNodeId, onSelect }: { node: ElementNode } & Omit<Props, "nodes">) {
  const selected = node.nodeId !== null && node.nodeId === selectedNodeId;
  return (
    <li>
      <button
        type="button"
        disabled={node.nodeId === null}
        aria-pressed={selected}
        onClick={() => onSelect(node.nodeId)}
        className={cn(
          "flex w-full items-baseline gap-2 rounded-sm px-1.5 py-0.5 text-left text-xs",
          selected ? "bg-gray-alpha-200 text-gray-1000" : "text-gray-1000 hover:bg-gray-alpha-100",
          "disabled:text-gray-700 disabled:hover:bg-transparent",
        )}
      >
        <span className="font-mono">{node.tag}</span>
        {node.text && (
          <span className="truncate text-gray-900">{node.text.slice(0, TEXT_LENGTH)}</span>
        )}
      </button>
      {node.children.length > 0 && (
        <Rows nodes={node.children} selectedNodeId={selectedNodeId} onSelect={onSelect} />
      )}
    </li>
  );
}

function Rows({ nodes, selectedNodeId, onSelect }: Props) {
  return (
    <ul className="flex flex-col pl-3">
      {nodes.map((node, index) => (
        <Row
          key={node.nodeId ?? `unnamed-${index}`}
          node={node}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

export function ElementTree(props: Props) {
  return (
    <nav
      aria-label="Elements"
      className="min-h-0 max-h-64 overflow-auto rounded-md bg-background-200 p-2 shadow-border"
    >
      <Rows {...props} />
    </nav>
  );
}
