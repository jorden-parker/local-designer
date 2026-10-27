# Plan 002: The inspector shows an element tree, so any element can be selected

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report; do
> not improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat f19afe1..HEAD -- src/lib/design/jsx-tree.ts src/lib/design/annotate.ts src/components/workspace/inspector-panel.tsx src/components/workspace/inspector-panel.test.tsx src/components/workspace/workspace.tsx`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

- **Planned at**: commit `f19afe1`
- **Priority**: P1
- **Effort**: M (half a day, including tests)
- **Kind**: feature, adjacent possible. Every building block already exists;
  this plan wires them into one new panel section.

## Why this matters

Selecting one element and changing only it is the product's distinctive
interaction. Selection happens in the preview iframe by pointer:
`src/components/preview/use-pointer-selection.ts:3-6` resolves a click to
`target.closest("[data-node-id]")`, which is always the **innermost** annotated
element under the pointer. Containers whose area is fully covered by their
children (a `<section>` of cards, a grid, a `<nav>`) can only be hit by clicking
their padding, and a `<main>` with no padding cannot be selected at all. There
is no "select parent" and no tree.

Everything needed for a tree is already in the repo:

- `src/lib/design/jsx-tree.ts` exports `topLevelElements`, `childElements`,
  `tagName`, `directText` and `attributeValue`.
- `src/lib/handoff/outline.ts` already walks exactly this tree to print a
  Markdown outline for the handoff, but the UI never shows it.
- Saved code carries `data-node-id="nN"` on every selectable element
  (`src/lib/design/annotate.ts`), and the workspace already highlights the
  selected id in the preview through the `highlight` message.

So an element tree in the inspector is a pure function plus a list component.
Clicking a row selects the node exactly as a canvas click would.

## Repo facts you need

- Runtime and package manager: **Bun**. Next.js 16, React 19, TypeScript, Vitest
  5 with two projects: `*.test.ts` runs in node, `*.test.tsx` runs in jsdom with
  `@testing-library/react` and `@testing-library/user-event`.
- Run one test file:
  `bunx vitest run src/components/workspace/inspector-panel.test.tsx`. Full
  gate: `.claude/verify` (tests with coverage, `tsc`, `eslint`, `fallow`). It
  must pass before you finish.
- Code style (enforced by hooks): **no comments of any kind**, no lint
  suppressions, small single-purpose functions, descriptive names. Imports use
  the `@/` alias for `src/`. TDD: failing test first, then the smallest change.
- UI conventions: Geist-style utility classes from
  `src/app/(studio)/globals.css` such as `text-gray-900`, `text-gray-1000`,
  `bg-background-100`, `bg-background-200`, `bg-gray-alpha-100`,
  `shadow-border`, `text-label`. **No hex colours, no arbitrary values, no
  inline styles.** Dark mode follows `prefers-color-scheme` through those
  tokens. Primitives live in `src/components/ui/` (`Button`, `Badge`, `Select`,
  `Textarea`); icons come from `lucide-react`; `cn` from the `cn` package joins
  class names.
- JSX parsing goes through `src/lib/design/jsx-tree.ts` (Babel). Never add a
  regex or a second parser for JSX.
- No preview changes are needed, so you do **not** need `bun run build:preview`.
- Do **not** commit. Do not run formatters. Leave `CLAUDE.md` alone (it has
  uncommitted edits that are not yours).

## Current state

`src/lib/design/jsx-tree.ts:53-56, 62-68, 85-100` (the helpers you will use):

```ts
export function tagName(element: JsxElement): string | null {
  const name = element.openingElement.name;
  return name.type === "JSXIdentifier" ? (name.name ?? null) : null;
}

export function attributeValue(
  element: JsxElement,
  attribute: string,
): string | null {
  const found = element.openingElement.attributes.find(
    (node) => (node.name as { name?: string } | undefined)?.name === attribute,
  );
  const value = found?.value as
    { type: string; value?: string } | null | undefined;
  return value?.type === "StringLiteral" ? (value.value ?? null) : null;
}

export function topLevelElements(source: string): JsxElement[] {
  return [...outermostElements(parseModule(source))];
}

export function childElements(element: JsxElement): JsxElement[] {
  return [...outermostElements(element.children)];
}

export function directText(element: JsxElement): string {
  return element.children
    .filter((child) => child.type === "JSXText")
    .map((child) => String(child.value))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
```

`parseModule` throws on a syntax error, so every caller that may receive
unparseable code wraps the call in `try`/`catch`, as `selectedElement` does
below.

`src/lib/design/annotate.ts:4`:

```ts
export const NODE_ID_ATTRIBUTE = "data-node-id";
```

`src/lib/handoff/outline.ts` (the walk you are mirroring; do not edit it):

```ts
function lines(element: JsxElement, depth: number): string[] {
  return [
    line(element, depth),
    ...childElements(element).flatMap((child) => lines(child, depth + 1)),
  ];
}

export function outline(code: string): string {
  return topLevelElements(code)
    .flatMap((element) => lines(element, 0))
    .join("\n");
}
```

`src/components/workspace/inspector-panel.tsx` (relevant parts; the file is 121
lines):

```tsx
type Props = {
  code: string | null;
  fileName: string;
  tokens: Tokens | null;
  selectedNodeId: string | null;
  running: boolean;
  onClear: () => void;
  onRequest: (request: string, nodeId: string) => void;
};

const ELEMENT_SUGGESTIONS = [
  "Make it more prominent",
  "Simplify it",
  "Add an image placeholder",
];

function selectedElement(code: string | null, nodeId: string | null) {
  if (!code || !nodeId) return null;
  try {
    const source = elementSource(code, nodeId);
    return source
      ? { source, tag: elementTag(code, nodeId) ?? "element" }
      : null;
  } catch {
    return null;
  }
}
```

```tsx
export function InspectorPanel(props: Props) {
  const {
    code,
    fileName,
    tokens,
    selectedNodeId,
    running,
    onClear,
    onRequest,
  } = props;
  const element = useMemo(
    () => selectedElement(code, selectedNodeId),
    [code, selectedNodeId],
  );

  if (!element || !selectedNodeId) {
    return (
      <aside className="flex min-h-0 flex-col gap-4 border-l border-gray-alpha-400 bg-background-100 p-4">
        <div className="flex flex-col items-start gap-2 rounded-md bg-background-200 p-4 shadow-border">
          <MousePointerClick className="size-5 text-gray-900" />
          <p className="text-sm font-medium">Select an element</p>
          <p className="text-label text-gray-900">
            Click anything in the canvas to inspect it and change just that
            part.
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
```

`src/components/workspace/workspace.tsx:63-71` (the only caller):

```tsx
<InspectorPanel
  code={view.code}
  fileName={target.kind === "system" ? "components.tsx" : "Page.tsx"}
  tokens={view.tokens}
  selectedNodeId={selectedNodeId}
  running={running}
  onClear={() => selectNode(null)}
  onRequest={requestChange}
/>
```

`selectNode` there is `(nodeId: string | null) => void`, from `useTargetView`.

Test exemplar, `src/components/workspace/inspector-panel.test.tsx:8-34`:

```tsx
const CODE = annotate(
  'export default function Design() {\n  return <main><h1 className="text-2xl">Hello</h1></main>;\n}',
);

describe("InspectorPanel", () => {
  it("shows the selected element and sends a change for just that element", async () => {
    const onRequest = vi.fn();
    render(
      <InspectorPanel
        code={CODE}
        fileName="Page.tsx"
        tokens={null}
        selectedNodeId="n2"
        running={false}
        onClear={() => {}}
        onRequest={onRequest}
      />,
    );
    expect(screen.getByText("<h1>")).toBeTruthy();
```

With that `CODE`, `annotate` gives `<main>` the id `n1` and `<h1>` the id `n2`.

## Scope

**In scope** (the only files you may edit or create):

- `src/lib/design/element-tree.ts` (new) and
  `src/lib/design/element-tree.test.ts` (new)
- `src/components/workspace/element-tree.tsx` (new) and
  `src/components/workspace/element-tree.test.tsx` (new)
- `src/components/workspace/inspector-panel.tsx`
- `src/components/workspace/inspector-panel.test.tsx`
- `src/components/workspace/workspace.tsx`
- `plans/README.md` (status row only)

**Out of scope** (do not touch, even if it looks related):

- `src/lib/design/jsx-tree.ts`, `annotate.ts`, `subtree.ts`: use them, do not
  change them. If a helper seems missing, STOP and report.
- `src/lib/handoff/outline.ts`: the handoff outline stays as it is. Do not
  refactor it to share code with the new module; a second small walk is
  acceptable here.
- `src/components/preview/**` and `src/lib/preview-protocol.ts`: hover
  highlighting from the tree would need a new message. Not in this plan.
- `src/components/workspace/use-target-view.ts`, `use-workspace.ts`,
  `canvas.tsx`, `thread-panel.tsx`.
- `CLAUDE.md`, `.env.local`.

## Steps

### Step 1: a pure `elementTree` function

TDD: create `src/lib/design/element-tree.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { annotate } from "./annotate";
import { elementTree } from "./element-tree";

const PAGE = annotate(
  `export default function Page() {
  const tiers = ["Free", "Pro"];
  return (
    <main>
      <h1>Pricing</h1>
      <section>
        {tiers.map((tier) => (
          <Card key={tier}>{tier}</Card>
        ))}
      </section>
    </main>
  );
}`,
  "elements-and-components",
);

describe("elementTree", () => {
  it("nests every element with its id, tag and direct text", () => {
    expect(elementTree(PAGE)).toEqual([
      {
        nodeId: "n1",
        tag: "main",
        text: "",
        children: [
          { nodeId: "n2", tag: "h1", text: "Pricing", children: [] },
          {
            nodeId: "n3",
            tag: "section",
            text: "",
            children: [{ nodeId: "n4", tag: "Card", text: "", children: [] }],
          },
        ],
      },
    ]);
  });

  it("gives an element without an id a null id", () => {
    const [root] = elementTree(
      "export function Showcase() { return <Button>Go</Button>; }",
    );
    expect(root).toEqual({
      nodeId: null,
      tag: "Button",
      text: "Go",
      children: [],
    });
  });

  it("is empty for code that does not parse", () => {
    expect(
      elementTree("export default function Page() { return <main>; }"),
    ).toEqual([]);
  });
});
```

Run it and confirm it fails because the module does not exist:

```
bunx vitest run src/lib/design/element-tree.test.ts
```

Create `src/lib/design/element-tree.ts`:

```ts
import { NODE_ID_ATTRIBUTE } from "./annotate";
import {
  attributeValue,
  childElements,
  directText,
  tagName,
  topLevelElements,
  type JsxElement,
} from "./jsx-tree";

export type ElementNode = {
  nodeId: string | null;
  tag: string;
  text: string;
  children: ElementNode[];
};

function elementNode(element: JsxElement): ElementNode {
  return {
    nodeId: attributeValue(element, NODE_ID_ATTRIBUTE),
    tag: tagName(element) ?? "element",
    text: directText(element),
    children: childElements(element).map(elementNode),
  };
}

export function elementTree(code: string): ElementNode[] {
  try {
    return topLevelElements(code).map(elementNode);
  } catch {
    return [];
  }
}
```

Verify:

```
bunx vitest run src/lib/design/element-tree.test.ts
```

Expected: 3 passed. If the first test's expected ids differ from what `annotate`
produces, check the order in which `annotate` numbers elements (source order)
and fix the **test**, not the function.

### Step 2: an `ElementTree` list component

TDD: create `src/components/workspace/element-tree.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ElementTree } from "./element-tree";

const NODES = [
  {
    nodeId: "n1",
    tag: "main",
    text: "",
    children: [
      {
        nodeId: "n2",
        tag: "h1",
        text: "Pricing plans for every team",
        children: [],
      },
      { nodeId: null, tag: "Button", text: "Go", children: [] },
    ],
  },
];

describe("ElementTree", () => {
  it("selects the element of a clicked row and marks the selected one", async () => {
    const onSelect = vi.fn();
    render(
      <ElementTree nodes={NODES} selectedNodeId="n1" onSelect={onSelect} />,
    );
    expect(
      screen.getByRole("button", { name: /main/, pressed: true }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /h1/ }));
    expect(onSelect).toHaveBeenCalledWith("n2");
  });

  it("disables rows that have no id", () => {
    render(
      <ElementTree nodes={NODES} selectedNodeId={null} onSelect={() => {}} />,
    );
    expect(
      (screen.getByRole("button", { name: /Button/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
```

Run and confirm it fails (module missing):

```
bunx vitest run src/components/workspace/element-tree.test.tsx
```

Create `src/components/workspace/element-tree.tsx`:

```tsx
"use client";

import { cn } from "cn";
import type { ElementNode } from "@/lib/design/element-tree";

type Props = {
  nodes: ElementNode[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string | null) => void;
};

const TEXT_LENGTH = 32;

function Row({
  node,
  selectedNodeId,
  onSelect,
}: { node: ElementNode } & Omit<Props, "nodes">) {
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
          selected
            ? "bg-gray-alpha-200 text-gray-1000"
            : "text-gray-1000 hover:bg-gray-alpha-100",
          "disabled:text-gray-700 disabled:hover:bg-transparent",
        )}
      >
        <span className="font-mono">{node.tag}</span>
        {node.text && (
          <span className="truncate text-gray-900">
            {node.text.slice(0, TEXT_LENGTH)}
          </span>
        )}
      </button>
      {node.children.length > 0 && (
        <Rows
          nodes={node.children}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
        />
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
```

The outermost `Rows` gets `pl-3` too; that is fine for a tree with one root.

Verify:

```
bunx vitest run src/components/workspace/element-tree.test.tsx
bun run lint
```

Expected: 2 passed, lint clean.

### Step 3: the inspector renders the tree and selects through `onSelect`

TDD first. In `src/components/workspace/inspector-panel.test.tsx`:

1. Replace every `onClear={() => {}}` with `onSelect={() => {}}`.
2. Add a test:

```tsx
it("selects an element from the tree", async () => {
  const onSelect = vi.fn();
  render(
    <InspectorPanel
      code={CODE}
      fileName="Page.tsx"
      tokens={null}
      selectedNodeId={null}
      running={false}
      onSelect={onSelect}
      onRequest={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: /h1.*Hello/ }));
  expect(onSelect).toHaveBeenCalledWith("n2");
});
```

3. Add a test that the clear button now calls `onSelect(null)`:

```tsx
it("clears the selection", async () => {
  const onSelect = vi.fn();
  render(
    <InspectorPanel
      code={CODE}
      fileName="Page.tsx"
      tokens={null}
      selectedNodeId="n2"
      running={false}
      onSelect={onSelect}
      onRequest={() => {}}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Clear selection" }),
  );
  expect(onSelect).toHaveBeenCalledWith(null);
});
```

Run and confirm the file fails to typecheck or the new tests fail:

```
bunx vitest run src/components/workspace/inspector-panel.test.tsx
```

Then edit `src/components/workspace/inspector-panel.tsx`:

- In `Props`, replace `onClear: () => void;` with
  `onSelect: (nodeId: string | null) => void;`.
- Import `elementTree` from `@/lib/design/element-tree` and `ElementTree` from
  `./element-tree`.
- In `InspectorPanel`, destructure `onSelect` instead of `onClear`, and add
  `const tree = useMemo(() => (code ? elementTree(code) : []), [code]);` next to
  the existing `element` memo.
- In the **no selection** branch, render
  `{tree.length > 0 && <ElementTree nodes={tree} selectedNodeId={null} onSelect={onSelect} />}`
  directly after the "Select an element" hint `div` and before `TokenSwatches`.
- In the **selected** branch, change the clear button's `onClick={onClear}` to
  `onClick={() => onSelect(null)}`, and render
  `<ElementTree nodes={tree} selectedNodeId={selectedNodeId} onSelect={onSelect} />`
  directly after the header `div` and before the "Selected element" `CodeBlock`.

Update the hint copy in the no-selection branch from "Click anything in the
canvas to inspect it and change just that part." to "Click anything in the
canvas, or pick it from the tree, to change just that part." Keep it one
sentence.

Then update the caller in `src/components/workspace/workspace.tsx`: replace
`onClear={() => selectNode(null)}` with `onSelect={selectNode}`.

Verify:

```
bunx vitest run src/components/workspace/inspector-panel.test.tsx
bun run typecheck
grep -rn "onClear" src/components/workspace
```

Expected: all tests pass, typecheck exit 0, and the grep prints nothing.

### Step 4: full gate

```
.claude/verify
```

Expected: exit 0. If `fallow` reports an unused export, remove it rather than
suppressing it.

### Step 5: look at it in a browser (only if the dev server runs here)

Skip, and say so, if there is no Ollama on `localhost:11434` or if there are no
designs with a drafted page in the gallery. This step needs no model call:
opening an existing design is enough.

1. `bun run dev` and open the sign-in link it prints.
2. Open a design with a page. In the right panel, the tree appears under the
   hint. Click the row for the outermost `main` (or equivalent): the canvas
   outlines the whole page and the "Selected" header shows `<main>`.
3. Click a nested row: the outline moves. Click the X: the tree stays and the
   selection clears.
4. Check the browser console for errors. There should be none from
   `inspector-panel` or `element-tree`.

Note the outcome in the status row's note in `plans/README.md`.

## Done criteria

- `bunx vitest run src/lib/design/element-tree.test.ts src/components/workspace/element-tree.test.tsx src/components/workspace/inspector-panel.test.tsx`
  exits 0 with the 7 tests listed in this plan present.
- `grep -rn "onClear" src/components/workspace` prints nothing.
- `grep -c "ElementTree" src/components/workspace/inspector-panel.tsx` prints
  `3` (one import, two usages).
- `git status --short -- src/lib/design/jsx-tree.ts src/lib/handoff/outline.ts src/components/preview`
  prints nothing.
- `.claude/verify` exits 0.

## Test plan

| File                                 | Test                                                   | Pattern to copy                                                                             |
| ------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `element-tree.test.ts` (new, node)   | nested ids/tags/text; null id; unparseable code        | `src/lib/design/subtree.test.ts` style: build code with `annotate`, assert on plain objects |
| `element-tree.test.tsx` (new, jsdom) | click selects; selected row pressed; null row disabled | `inspector-panel.test.tsx` (render + `userEvent`)                                           |
| `inspector-panel.test.tsx`           | tree click selects `n2`; clear calls `onSelect(null)`  | existing tests in the same file                                                             |

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts do not match the live code (drift).
- `annotate` numbers the fixture differently from the step 1 test and you cannot
  explain the order from `src/lib/design/annotate.ts` (it numbers in source
  order, skipping elements that already have an id).
- You need to change `jsx-tree.ts` to build the tree.
- The tree needs more than `max-h-64` and scrolling to fit without pushing the
  composer off screen; report the layout problem with a screenshot description
  instead of restructuring the panel.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Elements rendered inside `.map()` share one source element and therefore one
  id. Selecting that row outlines every rendered instance; that matches how a
  canvas click on any instance behaves today.
- Component usages inside `components.tsx` (the design-system target) have no
  id, because `annotate` with kind `"elements"` ids only host elements. Those
  rows are disabled by design. If that is ever changed in `annotate`, the tree
  starts offering them with no further work.
- Reviewer focus: no inline styles and no colour values in `element-tree.tsx`;
  only Geist utilities. Indentation is nested `<ul class="pl-3">`, not computed
  padding.
- Deferred: hover-to-highlight from the tree (needs a hover id in the
  `highlight` message or a second message), keyboard navigation, and a "select
  parent" shortcut on the canvas. Each is small once the tree exists.
