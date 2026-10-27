# Plan 003: History is legible: viewing a version shows what it changed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report; do
> not improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Depends on**: Plan 002 (the inspector must already take an
> `onSelect(nodeId | null)` prop). If
> `grep -n "onSelect" src/components/workspace/inspector-panel.tsx` prints
> nothing, STOP: do plan 002 first.
>
> **Drift check (run first)**:
> `git diff --stat f19afe1..HEAD -- src/components/workspace/target-view.ts src/components/workspace/use-target-view.ts src/components/workspace/target-view.test.ts src/components/workspace/use-workspace.test.tsx src/lib/design/subtree.ts`
> Plan 002 legitimately changes `inspector-panel.tsx` and `workspace.tsx`, so
> they are not in this drift check; read their current contents before step 3.
> If any file listed above changed, compare the "Current state" excerpts against
> the live code before proceeding; on a mismatch, treat it as a STOP condition.

- **Planned at**: commit `f19afe1`
- **Priority**: P2
- **Effort**: S for slice A, M for slice B (together, about a day)
- **Kind**: direction spike in two slices. Slice A is a sure thing. Slice B is a
  heuristic; the plan tells you how to judge it and when to stop.

## Why this matters

"Every change is a new version, so history is never lost" is a core promise, and
the thread panel lets the user view and restore any version and build new
changes on an old one ("Changes will build on version N",
`src/components/workspace/thread-panel.tsx:143-145`). But a version is opaque:
the thread shows the request text and an "Element" badge when the change was
scoped to one element (`thread-panel.tsx:53`), and the inspector shows the full
code. Nothing shows **what** changed or **where**, so comparing two versions
means reading two 150-line files.

Two facts make this cheap:

- Each element-scoped version records its `nodeId` (`src/lib/types.ts`,
  `VersionMeta.nodeId`), and `withRootId` keeps that id on the replacement
  (`src/lib/design/annotate.ts:37-42`). So when the user views such a version,
  the workspace can simply select that node and the canvas outlines it. That is
  slice A.
- Every element has a stable id across versions, so "which elements changed
  between version N-1 and N" is a per-id source comparison using `elementSource`
  from `src/lib/design/subtree.ts`, with no diff library. That is slice B: a row
  of "Changed" chips in the inspector that select the changed elements.

## Repo facts you need

- Runtime and package manager: **Bun**. Next.js 16, React 19, TypeScript, Vitest
  5 with two projects: `*.test.ts` in node, `*.test.tsx` in jsdom with
  `@testing-library/react` (`renderHook`, `act`, `waitFor`, `render`, `screen`)
  and `@testing-library/user-event`.
- Run one test file:
  `bunx vitest run src/components/workspace/target-view.test.ts`. Full gate:
  `.claude/verify` (tests with coverage, `tsc`, `eslint`, `fallow`). It must
  pass before you finish.
- Code style (enforced by hooks): **no comments**, no lint suppressions, small
  single-purpose functions, descriptive names, `@/` alias for `src/`. TDD.
- UI conventions: Geist utilities (`text-gray-900`, `bg-background-200`,
  `shadow-border`, `text-label`), primitives in `src/components/ui/` (`Badge`
  has variants `gray` (default) and `blue`; `Button` has `default`, `secondary`,
  `tertiary` and sizes `small`, `medium`, `icon`). No hex, no arbitrary values,
  no inline styles.
- JSX parsing goes through `src/lib/design/jsx-tree.ts`. Never add a regex or a
  second parser for JSX.
- Do **not** commit. Do not run formatters. Leave `CLAUDE.md` alone.

## Current state

`src/components/workspace/use-target-view.ts` (whole file, 40 lines):

```ts
import { useCallback, useMemo, useState } from "react";
import type { ThemeMode } from "@/lib/preview-protocol";
import type { Design, Target } from "@/lib/types";
import { initialTarget, targetView } from "./target-view";

export function useTargetView(initialDesign: Design) {
  const [design, setDesign] = useState(initialDesign);
  const [target, setTarget] = useState<Target>(() =>
    initialTarget(initialDesign),
  );
  const [viewedNumber, setViewedNumber] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>("light");
  const view = useMemo(
    () => targetView(design, target, viewedNumber, mode),
    [design, target, viewedNumber, mode],
  );

  const showTarget = useCallback((next: Target) => {
    setTarget(next);
    setViewedNumber(null);
    setSelectedNodeId(null);
  }, []);

  const showDesign = useCallback((next: Design) => {
    setDesign(next);
    setViewedNumber(null);
  }, []);

  return {
    design,
    showDesign,
    target,
    showTarget,
    view,
    viewVersion: setViewedNumber,
    selectedNodeId,
    selectNode: setSelectedNodeId,
    mode,
    setMode,
  };
}
```

`src/components/workspace/target-view.ts:6-28` (types and the version picker):

```ts
export type VersionSummary = {
  number: number;
  request: string;
  nodeId: string | null;
  model: string;
};

export type TargetView = {
  versions: VersionSummary[];
  latest: VersionSummary | null;
  viewed: VersionSummary | null;
  code: string | null;
  tokens: Tokens | null;
  render: RenderMessage | null;
};

export const SYSTEM_TARGET: Target = { kind: "system" };

function pick<T extends VersionSummary>(
  versions: T[],
  viewedNumber: number | null,
) {
  const latest = versions.at(-1) ?? null;
  const viewed =
    versions.find((version) => version.number === viewedNumber) ?? latest;
  return { versions, latest, viewed };
}
```

`systemView` (lines 30-46) and `pageView` (lines 48-74) both spread `...picked`
into the returned `TargetView` and add `code`, `tokens` and `render`. `pageView`
finds the page with `design.pages.find((candidate) => candidate.id === pageId)`
and uses `page?.versions ?? []`.

`src/lib/design/subtree.ts:11-14`:

```ts
export function elementSource(source: string, nodeId: string): string | null {
  const element = findElement(source, nodeId);
  return element ? stripIds(source.slice(element.start, element.end)) : null;
}
```

`findElement` in that file does `jsxElements(source).find(...)`, which throws on
unparseable code.

`src/components/workspace/use-workspace.test.tsx:7-36` fixtures (shared by the
existing tests; do not edit them, add your own):

```ts
const META = { request: "r", nodeId: null, model: "granite", createdAt: "t" };

const EMPTY: Design = {
  id: "d",
  title: "Shop",
  brief: "A plant shop",
  createdAt: "t",
  system: [],
  pages: [],
};

const WITH_SYSTEM: Design = {
  ...EMPTY,
  system: [{ ...META, number: 1, tokens: DEFAULT_TOKENS, components: "c" }],
};

const WITH_PAGE: Design = {
  ...WITH_SYSTEM,
  pages: [
    {
      id: "p1",
      name: "A plant shop",
      prompt: "A plant shop",
      versions: [
        { ...META, number: 1, code: "one" },
        { ...META, number: 2, code: "two" },
      ],
    },
  ],
};
```

The same file has `fakeApi(saved: Design[])`, which stubs `fetch` and must be
called before `renderHook(() => useWorkspace(...))` because the hook fetches
`/api/models` on mount. The test "switches targets, clearing the selection and
the viewed version" shows the
`act(() => { result.current.viewVersion(1); result.current.selectNode("n2"); })`
style.

`src/components/workspace/target-view.test.ts:7-27` has a `DESIGN` fixture with
one system version and one page `p1` with versions `one` and `two` whose
`nodeId` is `null`.

## Scope

**In scope** (the only files you may edit or create):

- `src/components/workspace/target-view.ts`, `target-view.test.ts`
- `src/components/workspace/use-target-view.ts`
- `src/components/workspace/use-workspace.test.tsx` (add tests only)
- `src/lib/design/version-diff.ts` (new), `version-diff.test.ts` (new)
- `src/components/workspace/inspector-panel.tsx`, `inspector-panel.test.tsx`
- `src/components/workspace/workspace.tsx`
- `plans/README.md` (status row only)

**Out of scope** (do not touch):

- `src/components/workspace/thread-panel.tsx`: the thread keeps showing the
  request and the Element badge. Do not add diff UI there.
- `src/lib/store/designs.ts`, `src/lib/types.ts`, any API route: no stored data
  changes. Everything here is derived from versions that already exist.
- `src/lib/design/subtree.ts`, `jsx-tree.ts`, `annotate.ts`: use, do not edit.
- `src/components/preview/**`, `src/lib/preview-protocol.ts`.
- `package.json`: **no new dependencies**. In particular, do not add a text diff
  library; slice B is structural on purpose.
- `CLAUDE.md`, `.env.local`.

## Steps

### Slice A

#### Step 1: `editedNodeId` is a pure function on the design

TDD: in `src/components/workspace/target-view.test.ts`, import `editedNodeId`
alongside `initialTarget, targetView` and add:

```ts
describe("editedNodeId", () => {
  const edited: Design = {
    ...DESIGN,
    pages: [
      {
        ...DESIGN.pages[0],
        versions: [
          ...DESIGN.pages[0].versions,
          { ...META, number: 3, nodeId: "n2", code: "three" },
        ],
      },
    ],
  };

  it("is the element a version was scoped to", () => {
    expect(editedNodeId(edited, { kind: "page", pageId: "p1" }, 3)).toBe("n2");
  });

  it("is null for whole-file versions, unknown versions and unknown pages", () => {
    expect(editedNodeId(edited, { kind: "page", pageId: "p1" }, 2)).toBeNull();
    expect(editedNodeId(edited, { kind: "page", pageId: "p1" }, 9)).toBeNull();
    expect(editedNodeId(edited, { kind: "page", pageId: "p9" }, 3)).toBeNull();
    expect(editedNodeId(edited, { kind: "system" }, 1)).toBeNull();
  });
});
```

Run and confirm the failure (no such export):

```
bunx vitest run src/components/workspace/target-view.test.ts
```

In `src/components/workspace/target-view.ts`, add a helper and the export. There
is already a `pageView` that finds a page; add a shared finder so both use it:

```ts
function targetVersions(design: Design, target: Target): VersionSummary[] {
  if (target.kind === "system") return design.system;
  return (
    design.pages.find((candidate) => candidate.id === target.pageId)
      ?.versions ?? []
  );
}

export function editedNodeId(
  design: Design,
  target: Target,
  number: number,
): string | null {
  return (
    targetVersions(design, target).find((version) => version.number === number)
      ?.nodeId ?? null
  );
}
```

You may make `pageView` use `targetVersions` only if it stays a one-line change;
otherwise leave `pageView` as it is.

Verify:

```
bunx vitest run src/components/workspace/target-view.test.ts
```

Expected: all pass.

#### Step 2: viewing a version selects its edited element

TDD: in `src/components/workspace/use-workspace.test.tsx`, add (inside the
existing `describe("useWorkspace", ...)`, using the `fakeApi` helper exactly as
the neighbouring tests do):

```ts
it("selects the element a viewed version edited", async () => {
  const page = WITH_PAGE.pages[0];
  const edited: Design = {
    ...WITH_PAGE,
    pages: [
      {
        ...page,
        versions: [
          ...page.versions,
          { ...META, number: 3, nodeId: "n2", code: "three" },
        ],
      },
    ],
  };
  fakeApi([edited]);
  const { result } = renderHook(() => useWorkspace(edited));
  act(() => result.current.viewVersion(3));
  expect(result.current.selectedNodeId).toBe("n2");
  act(() => result.current.viewVersion(2));
  expect(result.current.selectedNodeId).toBeNull();
});
```

Run and confirm it fails (`selectedNodeId` stays null):

```
bunx vitest run src/components/workspace/use-workspace.test.tsx -t "viewed version edited"
```

In `src/components/workspace/use-target-view.ts`, import `editedNodeId` and
replace `viewVersion: setViewedNumber,` with a callback defined above the
return:

```ts
const viewVersion = useCallback(
  (number: number) => {
    setViewedNumber(number);
    setSelectedNodeId(editedNodeId(design, target, number));
  },
  [design, target],
);
```

and return `viewVersion,`.

Verify:

```
bunx vitest run src/components/workspace/use-workspace.test.tsx src/components/workspace/thread-panel.test.tsx
bun run typecheck
```

Expected: all pass, exit 0. The thread panel calls `onView(version.number)` and
is unaffected.

### Slice B

#### Step 3: `changedNodeIds` compares two versions by element

TDD: create `src/lib/design/version-diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { annotate } from "./annotate";
import { replaceElement } from "./subtree";
import { changedNodeIds } from "./version-diff";

const PAGE = annotate(`export default function Page() {
  return (
    <main>
      <h1>Pricing</h1>
      <section>
        <p>Monthly</p>
        <p>Yearly</p>
      </section>
    </main>
  );
}`);

describe("changedNodeIds", () => {
  it("names the innermost elements whose source changed", () => {
    const next = replaceElement(
      PAGE,
      "n4",
      '<p data-node-id="n4">Per month</p>',
    );
    expect(changedNodeIds(PAGE, next)).toEqual(["n4"]);
  });

  it("names a new element rather than its unchanged ancestors", () => {
    const next = PAGE.replace(
      "</section>",
      '<p data-node-id="n6">Team</p></section>',
    );
    expect(changedNodeIds(PAGE, next)).toEqual(["n6"]);
  });

  it("ignores whitespace-only differences", () => {
    const next = PAGE.replace(
      '<h1 data-node-id="n2">Pricing</h1>',
      '<h1 data-node-id="n2">\n  Pricing\n</h1>',
    );
    expect(changedNodeIds(PAGE, next)).toEqual([]);
  });

  it("is empty when either version does not parse", () => {
    expect(changedNodeIds(PAGE, "<main>")).toEqual([]);
    expect(changedNodeIds("<main>", PAGE)).toEqual([]);
  });
});
```

With this fixture, `annotate` numbers `main` n1, `h1` n2, `section` n3, the
first `p` n4 and the second `p` n5. Run it; it fails because the module is
missing:

```
bunx vitest run src/lib/design/version-diff.test.ts
```

Create `src/lib/design/version-diff.ts`:

```ts
import { NODE_ID_ATTRIBUTE, stripIds } from "./annotate";
import { attributeValue, jsxElements, type JsxElement } from "./jsx-tree";

type Identified = { nodeId: string; element: JsxElement; source: string };

function normalised(code: string, element: JsxElement): string {
  return stripIds(code.slice(element.start, element.end))
    .replace(/\s+/g, " ")
    .replace(/\s*([<>{}])\s*/g, "$1");
}

function identified(code: string): Identified[] {
  return jsxElements(code).flatMap((element) => {
    const nodeId = attributeValue(element, NODE_ID_ATTRIBUTE);
    return nodeId
      ? [{ nodeId, element, source: normalised(code, element) }]
      : [];
  });
}

function encloses(outer: JsxElement, inner: JsxElement): boolean {
  return (
    outer !== inner && outer.start <= inner.start && inner.end <= outer.end
  );
}

function innermost(changed: Identified[]): string[] {
  return changed
    .filter(
      (candidate) =>
        !changed.some((other) => encloses(candidate.element, other.element)),
    )
    .map((candidate) => candidate.nodeId);
}

export function changedNodeIds(previous: string, current: string): string[] {
  try {
    const before = new Map(
      identified(previous).map((item) => [item.nodeId, item.source]),
    );
    return innermost(
      identified(current).filter(
        (item) => before.get(item.nodeId) !== item.source,
      ),
    );
  } catch {
    return [];
  }
}
```

Verify:

```
bunx vitest run src/lib/design/version-diff.test.ts
```

Expected: 4 passed. If the first test returns `["n4"]` plus ancestors, the
`innermost` filter is wrong; if it returns `[]`, check that `replaceElement`
kept the id (`withRootId` is not used here; the replacement string carries
`data-node-id="n4"` explicitly).

**Spike checkpoint.** Add one more test and look at its result before deciding
whether to continue:

```ts
it("reports every leaf when a whole file is re-indented", () => {
  const reindented = PAGE.replaceAll("  ", "    ");
  expect(changedNodeIds(PAGE, reindented)).toEqual([]);
});
```

Whitespace is normalised (runs collapse to one space, and spaces next to `<`,
`>`, `{` and `}` are dropped, which is what JSX itself ignores), so this should
pass. If it does, slice B is sound for both element edits and reformatting;
continue. If it fails, STOP and report the output: the heuristic is noisier than
planned. Known, accepted blind spot: a change that only adds or removes a space
inside a text node or an attribute string is not reported.

#### Step 4: `TargetView` carries the changed ids of the viewed version

TDD: in `src/components/workspace/target-view.test.ts`, add inside
`describe("targetView", ...)`:

```ts
it("lists the elements the viewed version changed against the one before", () => {
  const first = annotate(
    "export default function P() { return <main><h1>A</h1></main>; }",
  );
  const second = first.replace(">A<", ">B<");
  const design: Design = {
    ...DESIGN,
    pages: [
      {
        ...DESIGN.pages[0],
        versions: [
          { ...META, number: 1, code: first },
          { ...META, number: 2, code: second },
        ],
      },
    ],
  };
  expect(
    targetView(design, { kind: "page", pageId: "p1" }, null, "light")
      .changedNodeIds,
  ).toEqual(["n2"]);
  expect(
    targetView(design, { kind: "page", pageId: "p1" }, 1, "light")
      .changedNodeIds,
  ).toEqual([]);
});
```

Also extend the existing test "has nothing to render before anything is drafted"
only if its `toMatchObject` now fails; add `changedNodeIds: []` to the expected
object in that case.

Run and confirm the new test fails (property missing):

```
bunx vitest run src/components/workspace/target-view.test.ts
```

In `src/components/workspace/target-view.ts`:

- Add `changedNodeIds: string[];` to `TargetView`.
- Import `changedNodeIds` from `@/lib/design/version-diff`.
- Add a helper that finds the version before the viewed one and compares code.
  Pages compare `code`; the system compares `components`:

```ts
function changedSince<T extends VersionSummary>(
  versions: T[],
  viewed: T | null,
  codeOf: (version: T) => string,
): string[] {
  if (!viewed) return [];
  const previous = versions.find(
    (version) => version.number === viewed.number - 1,
  );
  return previous ? changedNodeIds(codeOf(previous), codeOf(viewed)) : [];
}
```

- In `systemView`, add
  `changedNodeIds: changedSince(design.system, viewed, (version) => version.components),`
  and in `pageView`,
  `changedNodeIds: changedSince(picked.versions, viewed, (version) => version.code),`.

Verify:

```
bunx vitest run src/components/workspace/target-view.test.ts
bun run typecheck
```

Expected: all pass. Typecheck exit 0 (the new property is additive; nothing else
constructs a `TargetView`).

#### Step 5: the inspector offers the changed elements as chips

Read the current `src/components/workspace/inspector-panel.tsx` first; plan 002
changed it (it now has `onSelect` and renders an `ElementTree`).

TDD: in `src/components/workspace/inspector-panel.test.tsx`, add
`changedNodeIds={[]}` to every existing `<InspectorPanel ... />` render, then
add:

```tsx
it("offers the elements the viewed version changed", async () => {
  const onSelect = vi.fn();
  render(
    <InspectorPanel
      code={CODE}
      fileName="Page.tsx"
      tokens={null}
      selectedNodeId={null}
      changedNodeIds={["n2"]}
      running={false}
      onSelect={onSelect}
      onRequest={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Changed: <h1>" }));
  expect(onSelect).toHaveBeenCalledWith("n2");
});
```

Run and confirm it fails. Then in `inspector-panel.tsx`:

- Add `changedNodeIds: string[];` to `Props` and destructure it.
- Add a small component in the same file:

```tsx
function ChangedElements({
  code,
  nodeIds,
  onSelect,
}: {
  code: string;
  nodeIds: string[];
  onSelect: (nodeId: string) => void;
}) {
  if (nodeIds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-label text-gray-900">Changed in this version</span>
      {nodeIds.map((nodeId) => (
        <button
          key={nodeId}
          type="button"
          aria-label={`Changed: <${elementTag(code, nodeId) ?? "element"}>`}
          className="rounded-full px-2 py-0.5 font-mono text-xs text-gray-1000 shadow-border hover:bg-gray-alpha-100"
          onClick={() => onSelect(nodeId)}
        >
          &lt;{elementTag(code, nodeId) ?? "element"}&gt;
        </button>
      ))}
    </div>
  );
}
```

`elementTag` is already imported in this file.

- Render
  `{code && <ChangedElements code={code} nodeIds={changedNodeIds} onSelect={onSelect} />}`
  in the **no selection** branch, directly before the `ElementTree`.

Then in `src/components/workspace/workspace.tsx`, pass
`changedNodeIds={view.changedNodeIds}` to `InspectorPanel`.

Verify:

```
bunx vitest run src/components/workspace/inspector-panel.test.tsx
bun run typecheck
```

Expected: all pass, exit 0.

### Step 6: full gate

```
.claude/verify
```

Expected: exit 0. Remove any unused export `fallow` reports; never suppress.

### Step 7 (optional, only if the dev server runs here): observe

Skip, and say so, if there is no design with at least one element-scoped version
in the gallery (the thread shows an "Element" badge on it).

1. `bun run dev`, open the design, click "View" on an Element version: the
   canvas outlines the edited element and the inspector shows it selected.
2. Click the X to clear. The "Changed in this version" chips appear; clicking
   one selects it.
3. View a whole-file version made by a redraft. Count the chips. If it is more
   than about ten, record that in the README note: the heuristic is too noisy
   for redrafts and the chips should be hidden above a threshold (a follow-up
   decision, not a change in this plan).

## Done criteria

- `bunx vitest run src/components/workspace/target-view.test.ts src/components/workspace/use-workspace.test.tsx src/lib/design/version-diff.test.ts src/components/workspace/inspector-panel.test.tsx`
  exits 0 with the new tests present.
- `grep -c "editedNodeId" src/components/workspace/use-target-view.ts` prints
  `2` (import and use).
- `grep -n "changedNodeIds" src/components/workspace/workspace.tsx` prints
  exactly one line.
- `git diff --stat -- package.json bun.lock src/components/workspace/thread-panel.tsx`
  prints nothing.
- `.claude/verify` exits 0.

## Test plan

| File                               | Test                                                                        | Pattern to copy                                                   |
| ---------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `target-view.test.ts`              | `editedNodeId` cases; `changedNodeIds` on the view                          | existing `targetView` tests in the file                           |
| `use-workspace.test.tsx`           | viewing an Element version selects its node; a whole-file version clears it | "switches targets, clearing the selection and the viewed version" |
| `version-diff.test.ts` (new, node) | innermost changed; new element; whitespace ignored; unparseable             | `src/lib/design/subtree.test.ts`                                  |
| `inspector-panel.test.tsx`         | chip selects the changed element                                            | existing tests in the file                                        |

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 002 is not done (no `onSelect` prop on `InspectorPanel`).
- The "Current state" excerpts do not match the live code (drift).
- The spike checkpoint test in step 3 fails.
- `use-workspace.test.tsx`'s existing test "builds a change on the version being
  viewed" starts failing after step 2: that test views version 1 and then
  selects `n3` explicitly, so it should not; if it does, report rather than
  editing the test.
- You want to add a dependency or to touch `thread-panel.tsx`.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Slice A relies on `withRootId` keeping the edited element's id. If element
  edits ever stop preserving ids, `editedNodeId` still returns the recorded id
  but the canvas finds nothing to outline. A test in `page-change.test.ts`
  ("rewrites only the selected element and keeps its id") guards this.
- Slice B compares consecutive version numbers (`viewed.number - 1`). Restored
  versions are copies appended as new numbers, so viewing a restore shows the
  difference from the version right before it, which is what the user did.
- `changedNodeIds` runs two Babel parses per view change. Pages are capped at
  about 150 lines by the prompt, so this is cheap; if designs grow, memoise by
  version number in `useTargetView`.
- Reviewer focus: no new dependencies; the thread panel unchanged; chips only in
  the no-selection state so they never compete with the element composer.
- Deferred: a textual diff view, hiding chips above a count threshold, and
  showing the changed elements in the thread list itself.
