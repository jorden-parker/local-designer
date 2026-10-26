"use client";

import { MousePointerClick, X } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { stripIds } from "@/lib/design/annotate";
import { elementSource, elementTag } from "@/lib/design/subtree";
import { COLOR_TOKENS, type Tokens } from "@/lib/design/tokens";
import { Composer } from "./composer";

type Props = {
  code: string | null;
  fileName: string;
  tokens: Tokens | null;
  selectedNodeId: string | null;
  running: boolean;
  onClear: () => void;
  onRequest: (request: string, nodeId: string) => void;
};

const ELEMENT_SUGGESTIONS = ["Make it more prominent", "Simplify it", "Add an image placeholder"];

function selectedElement(code: string | null, nodeId: string | null) {
  if (!code || !nodeId) return null;
  try {
    const source = elementSource(code, nodeId);
    return source ? { source, tag: elementTag(code, nodeId) ?? "element" } : null;
  } catch {
    return null;
  }
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <figure className="flex min-h-0 flex-col overflow-hidden rounded-md shadow-border">
      <figcaption className="border-b border-gray-alpha-400 bg-background-200 px-3 py-1.5 font-mono text-xs text-gray-900">
        {label}
      </figcaption>
      <pre className="min-h-0 overflow-auto bg-background-100 p-3 font-mono text-xs leading-5 text-gray-1000">
        {code}
      </pre>
    </figure>
  );
}

function TokenSwatches({ tokens }: { tokens: Tokens }) {
  const { radius, font } = tokens;
  return (
    <section className="flex flex-col gap-2 rounded-md bg-background-200 p-3 shadow-border">
      <p className="text-sm font-medium">Design tokens</p>
      <ul className="grid grid-cols-4 gap-2">
        {COLOR_TOKENS.map((token) => (
          <li
            key={token}
            title={`${token}: ${tokens.light[token]} light, ${tokens.dark[token]} dark`}
            className="flex flex-col gap-1"
          >
            <span className="flex h-6 overflow-hidden rounded-sm shadow-border">
              <span className="flex-1" style={{ background: tokens.light[token] }} />
              <span className="flex-1" style={{ background: tokens.dark[token] }} />
            </span>
            <span className="truncate font-mono text-[10px] text-gray-900">{token}</span>
          </li>
        ))}
      </ul>
      <p className="font-mono text-xs text-gray-900">
        Radius {radius.sm} · {radius.md} · {radius.lg} · {font}
      </p>
    </section>
  );
}

export function InspectorPanel(props: Props) {
  const { code, fileName, tokens, selectedNodeId, running, onClear, onRequest } = props;
  const element = useMemo(() => selectedElement(code, selectedNodeId), [code, selectedNodeId]);

  if (!element || !selectedNodeId) {
    return (
      <aside className="flex min-h-0 flex-col gap-4 border-l border-gray-alpha-400 bg-background-100 p-4">
        <div className="flex flex-col items-start gap-2 rounded-md bg-background-200 p-4 shadow-border">
          <MousePointerClick className="size-5 text-gray-900" />
          <p className="text-sm font-medium">Select an element</p>
          <p className="text-label text-gray-900">
            Click anything in the canvas to inspect it and change just that part.
          </p>
        </div>
        {tokens && <TokenSwatches tokens={tokens} />}
        {code && <CodeBlock label={fileName} code={stripIds(code)} />}
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col gap-4 border-l border-gray-alpha-400 bg-background-100 p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Selected</p>
        <Badge variant="blue" className="font-mono">
          &lt;{element.tag}&gt;
        </Badge>
        <Button
          variant="tertiary"
          size="icon"
          aria-label="Clear selection"
          className="ml-auto"
          onClick={onClear}
        >
          <X />
        </Button>
      </div>
      <CodeBlock label="Selected element" code={element.source} />
      <Composer
        placeholder="Describe a change to this element"
        disabled={running}
        suggestions={ELEMENT_SUGGESTIONS}
        onSubmit={(request) => onRequest(request, selectedNodeId)}
      />
    </aside>
  );
}
