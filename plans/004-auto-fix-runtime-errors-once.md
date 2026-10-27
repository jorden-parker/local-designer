# Plan 004: A version that fails to render gets one automatic fix attempt

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report; do
> not improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat f19afe1..HEAD -- src/components/workspace/use-workspace.ts src/components/workspace/use-workspace.test.tsx src/components/workspace/canvas.tsx src/components/workspace/canvas.test.tsx src/components/workspace/use-change-runner.ts`
> `workspace.tsx` may have been changed by plans 002 and 003; read it before
> step 3. If any file listed above changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

- **Planned at**: commit `f19afe1`
- **Priority**: P2
- **Effort**: S (a few hours, including tests)
- **Kind**: direction spike. The gap is certain; how often it bites is not, so
  the plan ends by making the auto-fix visible in the thread, where the user can
  count it.

## Why this matters

The draft loop checks model output before saving (`src/lib/design/review.ts`):
it compiles with sucrase, checks the default export, rejects unknown components
and warns about non-token colours, and gives the model one repair turn. It never
**runs** the code. Runtime failures (`HEADING_SIZES[level]` undefined, `.map` on
a string, a hook called conditionally) therefore pass review, get saved as a
version, and only surface when the sandboxed preview renders them. The product
already acknowledges this: the canvas shows the error with a button labelled
"Ask the model to fix it" (`src/components/workspace/canvas.tsx:124-126`), which
sends `Fix this error: <message>` as a whole-page change
(`src/components/workspace/workspace.tsx:61`).

So today a broken draft costs the user a click, and only after they notice. Two
ways to close the loop were weighed:

- **Run the code during review on the server** (render with `react-dom/server`
  inside `check`, so runtime errors reach the repair turn). Cleanest for the
  loop, but it executes model-written code in the Node process. The architecture
  runs generated code only in an opaque-origin iframe (`CLAUDE.md`, "Security
  boundary"), and `node:vm` is not a security boundary. **Rejected for this
  plan**; it would need a worker with a hard timeout and its own threat review.
- **Keep the boundary and automate the click**: when the preview reports an
  error for the version that the last run just saved, the workspace sends the
  fix request itself, once. This plan.

Bounding rules, so this can never loop:

1. Only for a version saved by a run in this session (never on opening a design
   that is already broken).
2. Only when the viewed version is the latest.
3. Never when the latest version's request already starts with
   `Fix this error: ` (so a failed fix is not fixed again).
4. At most once per completed run.

The manual button stays for every other case.

## Repo facts you need

- Runtime and package manager: **Bun**. Next.js 16, React 19, TypeScript, Vitest
  5 with two projects: `*.test.ts` in node, `*.test.tsx` in jsdom with
  `@testing-library/react` (`renderHook`, `act`, `waitFor`, `render`, `screen`).
- Run one test file:
  `bunx vitest run src/components/workspace/use-workspace.test.tsx`. Full gate:
  `.claude/verify` (tests with coverage, `tsc`, `eslint`, `fallow`). It must
  pass before you finish.
- Code style (enforced by hooks): **no comments**, no lint suppressions, small
  single-purpose functions, descriptive names, `@/` alias for `src/`. TDD.
- No preview (`src/components/preview/**`) changes, so no
  `bun run build:preview` is needed. The preview already posts
  `{ type: "error", message }` over the private port.
- Do **not** commit. Do not run formatters. Leave `CLAUDE.md` alone.

## Current state

`src/components/workspace/use-workspace.ts` (whole file, 87 lines):

```ts
import { useCallback, useEffect, useRef } from "react";
import { addPage, fetchDesign, restoreVersion } from "@/components/api";
import type { Design, Target } from "@/lib/types";
import { SYSTEM_TARGET } from "./target-view";
import { useChangeRunner } from "./use-change-runner";
import { useModels } from "./use-models";
import { useTargetView } from "./use-target-view";

const SYSTEM_REQUEST = "Design system";

function useFirstDrafts(
  design: Design,
  ready: boolean,
  draftSystem: () => void,
  createPage: (prompt: string) => void,
) {
  const started = useRef({ system: false, page: false });
  useEffect(() => {
    if (!ready) return;
    if (design.system.length === 0 && !started.current.system) {
      started.current.system = true;
      draftSystem();
    } else if (
      design.system.length > 0 &&
      design.pages.length === 0 &&
      !started.current.page
    ) {
      started.current.page = true;
      createPage(design.brief);
    }
  }, [design, ready, draftSystem, createPage]);
}

export function useWorkspace(initialDesign: Design) {
  const state = useTargetView(initialDesign);
  const { design, showDesign, target, showTarget, view } = state;
  const { models, model, setModel } = useModels(view.latest?.model ?? null);

  const reload = useCallback(
    async () => showDesign(await fetchDesign(design.id)),
    [design.id, showDesign],
  );
  const { run, start, stop } = useChangeRunner(design.id, reload);

  const draft = useCallback(
    (on: Target, request: string) => {
      if (model) start(on, { request, nodeId: null, baseVersion: null, model });
    },
    [model, start],
  );

  const requestChange = useCallback(
    (request: string, nodeId: string | null) => {
      if (!model) return;
      start(target, {
        request,
        nodeId,
        baseVersion: view.viewed?.number ?? null,
        model,
      });
    },
    [model, start, target, view.viewed?.number],
  );

  const createPage = useCallback(
    async (prompt: string) => {
      const created = await addPage(design.id, prompt);
      showDesign(created.design);
      const page: Target = { kind: "page", pageId: created.pageId };
      showTarget(page);
      draft(page, prompt);
    },
    [design.id, draft, showDesign, showTarget],
  );

  const draftSystem = useCallback(
    () => draft(SYSTEM_TARGET, SYSTEM_REQUEST),
    [draft],
  );
  useFirstDrafts(
    design,
    model !== null && run.status === "idle",
    draftSystem,
    createPage,
  );

  const restore = useCallback(
    async (number: number) =>
      showDesign(await restoreVersion(design.id, target, number)),
    [design.id, target, showDesign],
  );

  return {
    ...state,
    models,
    model,
    setModel,
    run,
    stop,
    requestChange,
    createPage,
    restore,
  };
}
```

`src/components/workspace/use-change-runner.ts:14-41`: `start` sets
`{ status: "running" }`, streams, then
`await onSaved(); setRun({ status: "idle" })`. `onSaved` is the `reload` above,
so after every successful run `showDesign` runs with the fresh design and
`view.latest` becomes the new version.

`src/components/workspace/canvas.tsx:9-16, 59-89` (props and the error
plumbing):

```tsx
type Props = {
  design: RenderMessage | null;
  viewport: ViewportId;
  selectedNodeId: string | null;
  running: boolean;
  onSelect: (nodeId: string | null) => void;
  onFixError: (message: string) => void;
};
```

```tsx
function usePreviewFrame(
  design: RenderMessage | null,
  selectedNodeId: string | null,
  onSelect: Props["onSelect"],
) {
  const { frame, port } = usePreviewPort();
  const [error, setError] = useState<{ design: RenderMessage | null; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (!port) return;
    const receive = (event: MessageEvent) => {
      if (!isFromPreview(event.data)) return;
      if (event.data.type === "select") onSelect(event.data.nodeId);
      if (event.data.type === "error") setError({ design, message: event.data.message });
    };
    port.addEventListener("message", receive);
    return () => port.removeEventListener("message", receive);
  }, [port, design, onSelect]);
```

```tsx
  return { frame, error: error?.design === design ? error.message : null };
}

export function Canvas({ design, viewport, selectedNodeId, running, onSelect, onFixError }: Props) {
  const { frame, error } = usePreviewFrame(design, selectedNodeId, onSelect);
```

`src/components/workspace/workspace.tsx:55-62` (the caller):

```tsx
<Canvas
  design={view.render}
  viewport={viewport}
  selectedNodeId={selectedNodeId}
  running={running}
  onSelect={selectNode}
  onFixError={(message) => requestChange(`Fix this error: ${message}`, null)}
/>
```

`src/components/workspace/canvas.test.tsx:37-67` has a `setup()` that renders
`<Canvas ... onSelect={onSelect} onFixError={onFixError} />` with a mocked
`contentWindow.postMessage`, and `connectPreview(posted)` which returns
`{ received, send }` where `send(data)` posts a message from the preview side of
the port and flushes.

`src/components/workspace/use-workspace.test.tsx:38-55`:

```ts
function fakeApi(saved: Design[]) {
  const posts: { url: string; body: unknown }[] = [];
  let reloads = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/models")
      return Response.json({ models: ["granite"], defaultModel: "granite" });
    if (init?.method === "POST")
      posts.push({ url, body: JSON.parse(String(init.body)) });
    if (url.endsWith("/pages"))
      return Response.json({ design: saved.at(-1), pageId: "p1" });
    if (url.endsWith("/restore"))
      return Response.json({ ...WITH_PAGE, title: "restored" });
    if (init?.method === "POST") return new Response("streamed code");
    reloads += 1;
    return Response.json(saved[Math.min(reloads, saved.length) - 1]);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { posts };
}

const draft = (request: string) => ({
  request,
  nodeId: null,
  baseVersion: null,
  model: "granite",
});
```

Each reload (GET of the design) returns the next entry of `saved`, then keeps
returning the last one. The fixtures `META`, `WITH_PAGE` are shown in plan 003's
"Current state" and in the file itself; `WITH_PAGE` has page `p1` with versions
1 and 2, both with `request: "r"`.

## Scope

**In scope** (the only files you may edit):

- `src/components/workspace/use-workspace.ts`, `use-workspace.test.tsx`
- `src/components/workspace/canvas.tsx`, `canvas.test.tsx`
- `src/components/workspace/workspace.tsx`
- `plans/README.md` (status row only)

**Out of scope** (do not touch):

- `src/lib/design/**`: no server-side execution of model code. If you find
  yourself importing `react-dom/server` anywhere outside a test, stop.
- `src/components/preview/**`, `src/lib/preview-protocol.ts`: the error message
  already exists.
- `src/components/workspace/use-change-runner.ts`, `thread-panel.ts`,
  `use-target-view.ts`.
- `src/lib/store/**`, API routes, `src/lib/types.ts`.
- `CLAUDE.md`, `.env.local`.

## Steps

### Step 1: the canvas reports render errors upward

TDD: in `src/components/workspace/canvas.test.tsx`, add `onRenderError` to
`setup()`: create `const onRenderError = vi.fn();`, pass
`onRenderError={onRenderError}` to `<Canvas>`, and return it alongside the other
spies. Then add a test:

```tsx
it("reports a render error for the current design", async () => {
  const { posted, onRenderError } = setup();
  const preview = await connectPreview(posted);
  await preview.send({ type: "error", message: "x is not defined" });
  expect(onRenderError).toHaveBeenCalledWith("x is not defined");
  expect(screen.getByRole("alert").textContent).toContain("x is not defined");
});
```

Run and confirm the file fails to typecheck or the new test fails:

```
bunx vitest run src/components/workspace/canvas.test.tsx
```

In `src/components/workspace/canvas.tsx`:

- Add `onRenderError: (message: string) => void;` to `Props`.
- Give `usePreviewFrame` a fourth parameter
  `onRenderError: Props["onRenderError"]` and, in `receive`, change the error
  line to:

```tsx
if (event.data.type === "error") {
  setError({ design, message: event.data.message });
  onRenderError(event.data.message);
}
```

Add `onRenderError` to that effect's dependency array.

- Destructure `onRenderError` in `Canvas` and pass it to `usePreviewFrame`.

Verify:

```
bunx vitest run src/components/workspace/canvas.test.tsx
```

Expected: all pass. Typecheck will fail in `workspace.tsx` until step 3.

### Step 2: the workspace asks for one fix

TDD: in `src/components/workspace/use-workspace.test.tsx`, add (inside the
existing `describe`):

```ts
const SAVED: Design = { ...WITH_PAGE, title: "saved" };

const FIXED: Design = {
  ...WITH_PAGE,
  title: "fixed",
  pages: [
    {
      ...WITH_PAGE.pages[0],
      versions: [
        ...WITH_PAGE.pages[0].versions,
        {
          ...META,
          number: 3,
          request: "Fix this error: x is not defined",
          code: "three",
        },
      ],
    },
  ],
};

const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

it("asks for one fix when the version it just drafted fails to render", async () => {
  const { posts } = fakeApi([SAVED, FIXED]);
  const { result } = renderHook(() => useWorkspace(WITH_PAGE));
  await waitFor(() => expect(result.current.model).toBe("granite"));
  act(() => result.current.requestChange("Add a footer", null));
  await waitFor(() => expect(result.current.design.title).toBe("saved"));
  await waitFor(() => expect(result.current.run.status).toBe("idle"));
  act(() => result.current.reportRenderError("x is not defined"));
  await waitFor(() => expect(posts).toHaveLength(2));
  expect(posts[1].body).toEqual({
    ...draft("Fix this error: x is not defined"),
    baseVersion: 2,
  });
  await waitFor(() => expect(result.current.design.title).toBe("fixed"));
  await waitFor(() => expect(result.current.run.status).toBe("idle"));
  act(() => result.current.reportRenderError("still broken"));
  await settle();
  expect(posts).toHaveLength(2);
});

it("does not ask for a fix for a version it did not draft", async () => {
  const { posts } = fakeApi([WITH_PAGE]);
  const { result } = renderHook(() => useWorkspace(WITH_PAGE));
  await waitFor(() => expect(result.current.model).toBe("granite"));
  act(() => result.current.reportRenderError("x is not defined"));
  await settle();
  expect(posts).toHaveLength(0);
});
```

Why the waits are what they are: `requestChange` builds on the viewed version,
which is the latest (number 2), hence `baseVersion: 2`. The first reload returns
`SAVED`, so waiting for the title proves the run's reload happened; waiting for
`idle` after that proves the runner finished. The second reload returns `FIXED`,
whose latest request carries the fix prefix.

Run and confirm both fail (`reportRenderError` is not a function):

```
bunx vitest run src/components/workspace/use-workspace.test.tsx
```

In `src/components/workspace/use-workspace.ts`:

- Add `const FIX_REQUEST = "Fix this error: ";` next to `SYSTEM_REQUEST`.
- Make `reload` mark that a run just saved a version. Add
  `const justDrafted = useRef(false);` in `useWorkspace` and change `reload` to:

```ts
const reload = useCallback(async () => {
  showDesign(await fetchDesign(design.id));
  justDrafted.current = true;
}, [design.id, showDesign]);
```

- Add, after `requestChange`:

```ts
const reportRenderError = useCallback(
  (message: string) => {
    const latest = view.latest;
    const viewingLatest =
      latest !== null && view.viewed?.number === latest.number;
    if (run.status !== "idle" || !justDrafted.current || !viewingLatest) return;
    justDrafted.current = false;
    if (latest.request.startsWith(FIX_REQUEST)) return;
    requestChange(`${FIX_REQUEST}${message}`, null);
  },
  [view.latest, view.viewed?.number, run.status, requestChange],
);
```

Note the order: an error that arrives while a run is still in progress is for a
stale render and does not consume the flag; the flag is consumed before the
prefix check, so a failed fix is never fixed again, and a second error for the
same version does nothing.

- Return `reportRenderError` from the hook.

Verify:

```
bunx vitest run src/components/workspace/use-workspace.test.tsx
```

Expected: all pass, including the four pre-existing tests. If "drafts the design
system first and then the first page from the brief" fails, the flag logic has
leaked into `useFirstDrafts`; it must not.

### Step 3: wire the canvas to the workspace

Read the current `src/components/workspace/workspace.tsx` (plans 002 and 003 may
have changed the `InspectorPanel` props; leave those as they are). Add
`onRenderError={workspace.reportRenderError}` to the `<Canvas>` element. Keep
`onFixError` exactly as it is: the manual button still works.

Verify:

```
bun run typecheck
bun run lint
```

Expected: exit 0 for both.

### Step 4: full gate

```
.claude/verify
```

Expected: exit 0.

### Step 5 (optional, only if Ollama runs here): observe

Skip, and say so, if `curl -s http://localhost:11434/api/tags` does not answer.

1. `bun run dev`, create a design from "A dashboard with KPI cards and a table",
   wait for the first page.
2. If the page renders, request "Replace the table with a chart that calls a
   helper you forgot to define" to provoke a runtime error on purpose.
3. Observe the thread: a `Fix this error: ...` run should start by itself right
   after the broken version appears, once. The canvas alert and its button stay
   visible while it runs.
4. Record in `plans/README.md` whether the automatic fix produced a working
   version, and the model name.

## Done criteria

- `bunx vitest run src/components/workspace/canvas.test.tsx src/components/workspace/use-workspace.test.tsx`
  exits 0 with the three new tests present.
- `grep -c "onRenderError" src/components/workspace/workspace.tsx` prints `1`.
- `grep -rn "react-dom/server" src --include=*.ts --include=*.tsx | grep -v "\.test\." `
  prints nothing.
- `git diff --stat -- src/lib src/components/preview` prints nothing.
- `.claude/verify` exits 0.

## Test plan

| File                     | Test                                                          | Pattern to copy                                            |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `canvas.test.tsx`        | error over the port calls `onRenderError` and shows the alert | existing port tests in the file (`connectPreview`, `send`) |
| `use-workspace.test.tsx` | one auto fix after a run; no second fix; nothing on load      | "builds a change on the version being viewed"              |

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts do not match the live code (drift).
- The auto-fix test passes only if you also change `use-change-runner.ts`.
- You need to execute generated code anywhere outside the preview iframe.
- The existing test "drafts the design system first and then the first page from
  the brief" fails after step 2.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The only state is one `useRef<boolean>` consumed on the first error after a
  save. If `useChangeRunner` ever stops calling `onSaved` after a successful
  run, auto-fix silently stops; the "asks for one fix" test catches that.
- The prefix `Fix this error: ` is now load-bearing in two places
  (`workspace.tsx` for the button and `use-workspace.ts` for the guard). If
  anyone rewords it, both must change; a shared constant exported from
  `use-workspace.ts` is the natural follow-up when `workspace.tsx` next changes.
- Reviewer focus: the guard order in `reportRenderError`, and that the preview
  and the server are untouched.
- Deferred: making the automatic run visually distinct in the thread (an
  "Automatic" badge), and a server-side render check in an isolated worker,
  which needs its own security review.
