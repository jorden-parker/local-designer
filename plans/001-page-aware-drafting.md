# Plan 001: Pages know about each other, and the starter kit has a Nav component

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report; do
> not improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat f19afe1..HEAD -- src/lib/design/prompts.ts src/lib/design/page-change.ts src/lib/design/change-service.ts src/lib/design/starter-components.ts src/lib/design/page-change.test.ts src/lib/design/change-service.test.ts src/lib/design/starter-components.test.ts src/lib/design/system-change.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

- **Planned at**: commit `f19afe1`
- **Priority**: P1
- **Effort**: M (half a day to a day, including tests)
- **Kind**: direction spike with a concrete first slice. The product value is
  inferred from the code, not from a written product brief, so the last step
  records what you observed instead of claiming success.

## Why this matters

A design in local-designer is a project: one design system plus several pages,
and the handoff tells the implementer to "build each page with the project's
routing". But the model drafts every page blind to the others:

- `newPageMessages` in `src/lib/design/prompts.ts:97` sends only the brief and
  the page request. The page list in the left nav (`ProjectNav`) never reaches
  the model, so a "Pricing" page invents a header linking to "Features", "Blog"
  and "Docs" that do not exist, and the next page invents a different set.
- The only cross-page consistency mechanism is `components.tsx`, and the starter
  kit (`src/lib/design/starter-components.ts`) has no navigation or shell
  component: Button, Card, Input, Badge, Heading, Text, ImagePlaceholder. Every
  page therefore hand-rolls its own header with raw elements, which is exactly
  the duplication the design system exists to prevent.

The first slice is small and testable: tell the page prompt which other pages
exist, and add a `Nav` component to the starter kit so headers are drawn from
the system. Both are prompt-level changes that have to work with a 3B model, so
the wording stays short and concrete.

## Repo facts you need

- Runtime and package manager: **Bun**. Next.js 16, React 19, TypeScript, Vitest
  5 with two projects: `*.test.ts` runs in node, `*.test.tsx` in jsdom.
- Run one test file: `bunx vitest run src/lib/design/page-change.test.ts`. Run
  everything with coverage: `bun run test`. Typecheck: `bun run typecheck`.
  Lint: `bun run lint`. Dead-code check: `bunx fallow`. Full gate:
  `.claude/verify` (runs all four; it must pass before you finish).
- Code style (enforced by hooks): **no comments of any kind**, no lint
  suppressions, small single-purpose functions, descriptive names. Imports use
  the `@/` alias for `src/`. Workflow is TDD: write the failing test first, then
  the smallest change that passes.
- Prompts live only in `src/lib/design/prompts.ts`. Rules there are short bullet
  lines because they must work with a 3B model.
- Pipeline tests use `fakeModel` from `src/test/fake-model.ts`, which records
  every `ModelRequest` it receives in `requests` and replays canned replies.
  `fenced(code)` wraps code in a ```tsx block.
- Do **not** commit. Do not run formatters. Leave `CLAUDE.md` alone (it has
  uncommitted edits that are not yours).

## Current state

`src/lib/design/prompts.ts:97-99`:

```ts
export function newPageMessages(brief: string, request: string): Message[] {
  return [
    {
      role: "user",
      content: `Product: ${brief}\n\nDesign this page: ${request}`,
    },
  ];
}
```

`src/lib/design/prompts.ts:39-46` (the components system prompt; line 42 is the
list of required components):

```ts
export const COMPONENTS_SYSTEM_PROMPT = `You are a design-system engineer. You write a product's shared UI components as one TSX file.
Rules:
- Export every component as export function Name({ className = "", ...props }) and spread ...props on its root element, joining className onto its classes.
- Always include Button (variant "primary" or "secondary"), Card, Input, Badge, Heading (level 1 to 3), Text and ImagePlaceholder, plus up to four components this product needs.
- Also export function Showcase() that renders every component once, with example content, in labelled sections.
${TOKEN_RULES}
${EFFICIENCY_RULES}
${CODE_REPLY}`;
```

`src/lib/design/page-change.ts` (whole file, 39 lines):

```ts
import { stripIds } from "./annotate";
import { codeDraft, elementDraft, FILE_MAX_TOKENS } from "./code-draft";
import { runDraft, type StreamText } from "./draft-runner";
import {
  newPageMessages,
  pageSystemPrompt,
  wholeChangeMessages,
} from "./prompts";
import { componentNames, reviewPage } from "./review";

export type PageChange = {
  brief: string;
  request: string;
  nodeId: string | null;
  baseCode: string | null;
  components: string;
};

export async function pageChange(
  stream: StreamText,
  change: PageChange,
  onText: (text: string) => void,
): Promise<string> {
  const { brief, request, nodeId, baseCode, components } = change;
  const names = componentNames(components);
  const rules = {
    review: (code: string) => reviewPage(code, names),
    kinds: "elements-and-components" as const,
  };
  if (baseCode && nodeId) {
    return runDraft(
      stream,
      elementDraft(baseCode, nodeId, request, names, rules),
      onText,
    );
  }
  const messages = baseCode
    ? wholeChangeMessages(stripIds(baseCode), request)
    : newPageMessages(brief, request);
  const system = pageSystemPrompt(names, stripIds(components));
  return runDraft(
    stream,
    codeDraft({ system, maxTokens: FILE_MAX_TOKENS, messages }, rules),
    onText,
  );
}
```

`src/lib/design/change-service.ts:100-121` (the caller that has the whole design
in hand):

```ts
  const loaded = await loadChange(designId, body, deps);
  if ("failure" in loaded) return loaded.failure;
  const { input, design } = loaded;
  const page = design.pages.find((candidate) => candidate.id === pageId);
  if (!page) return jsonError("Page not found", 404);
  const system = design.system.at(-1);
  if (!system) return jsonError("Create the design system first", 409);
  const base = baseVersion(page.versions, input.baseVersion);
  if (base === false) return jsonError("Version not found", 400);
  const nodeId = base ? input.nodeId : null;
  return textStream(async (emit) => {
    const code = await pageChange(
      modelStream(deps, input.model),
      {
        brief: design.brief,
        request: input.request,
        nodeId,
        baseCode: base ? base.code : null,
        components: system.components,
      },
      emit,
    );
```

`src/lib/design/starter-components.ts` is one exported template string,
`STARTER_COMPONENTS`, holding a TSX file. Its last component before `Showcase`
is `ImagePlaceholder` (lines 37-43), and `Showcase` (lines 45-72) renders every
component in labelled sections. The starter file is also the exemplar of the
component shape: every component is
`export function Name({ className = "", ...props })` and spreads `...props` on
its root. Inside the template string, backticks and `${}` are escaped as
`` \` `` and `\${`.

`src/lib/design/starter-components.test.ts:13-22` pins the exported names:

```ts
expect(componentNames(STARTER_COMPONENTS)).toEqual([
  "Button",
  "Card",
  "Input",
  "Badge",
  "Heading",
  "Text",
  "ImagePlaceholder",
]);
```

Pipeline test exemplar, `src/lib/design/page-change.test.ts:21-31`:

```ts
describe("pageChange", () => {
  it("drafts a page with the design system's components in the prompt", async () => {
    const { stream, requests } = fakeModel([fenced(PAGE)]);
    await expect(pageChange(stream, change(), () => {})).resolves.toBe(
      annotate(PAGE, "elements-and-components"),
    );
    expect(requests[0].system).toContain("use them without importing: Button.");
    expect(requests[0].system).toContain("bg-primary");
    expect(requests[0].system).not.toContain("data-node-id");
    expect(requests[0].messages[0].content).toContain("a shop");
  });
```

The `change()` helper in that test (lines 11-18) builds a `PageChange` with
`brief`, `request`, `nodeId`, `baseCode`, `components` and accepts overrides.

## Scope

**In scope** (the only files you may edit or create):

- `src/lib/design/prompts.ts`
- `src/lib/design/page-change.ts`
- `src/lib/design/change-service.ts`
- `src/lib/design/starter-components.ts`
- `src/lib/design/page-change.test.ts`
- `src/lib/design/change-service.test.ts`
- `src/lib/design/starter-components.test.ts`
- `src/lib/design/system-change.test.ts` (only if a Showcase or required-list
  assertion there breaks; see step 3)
- `plans/README.md` (status row only)

**Out of scope** (do not touch, even if it looks related):

- `src/lib/handoff/*`: the handoff already lists every page in its own section.
  Changing the handoff shape is a separate decision.
- `src/components/**`: no UI changes in this plan. The left nav already shows
  the page list.
- `src/lib/design/review.ts`, `code-draft.ts`, `draft-runner.ts`: the review and
  repair loop is unchanged.
- `src/lib/store/designs.ts` and `src/lib/types.ts`: no schema changes. Page
  names already exist on `Page.name`.
- `CLAUDE.md`, `.env.local`, anything under `node_modules`.

## Steps

### Step 1: `PageChange` carries the names of the other pages

TDD: first add a failing test to `src/lib/design/page-change.test.ts`, inside
the existing `describe("pageChange", ...)`:

```ts
it("tells the model which other pages exist when drafting a new page", async () => {
  const { stream, requests } = fakeModel([fenced(PAGE)]);
  await pageChange(
    stream,
    change({ otherPages: ["Home", "Checkout"] }),
    () => {},
  );
  expect(requests[0].messages[0].content).toContain(
    "Other pages: Home, Checkout.",
  );
});

it("says nothing about other pages when there are none", async () => {
  const { stream, requests } = fakeModel([fenced(PAGE)]);
  await pageChange(stream, change(), () => {});
  expect(requests[0].messages[0].content).not.toContain("Other pages");
});
```

Update the `change()` helper in the same file so its defaults include
`otherPages: []` (add it next to `components: COMPONENTS`).

Verify the first new test fails for the right reason (the prompt has no "Other
pages" line yet). Vitest does not typecheck, so the second new test already
passes; it guards the empty case once the feature exists.

```
bunx vitest run src/lib/design/page-change.test.ts
```

Expected: one new test fails, the others pass.

Now make them pass:

1. In `src/lib/design/page-change.ts`, add `otherPages: string[];` to the
   `PageChange` type, destructure it in `pageChange`, and pass it as the third
   argument to `newPageMessages(brief, request, otherPages)`. Do **not** pass it
   to `wholeChangeMessages` or `elementDraft`: edits of an existing page keep
   their prompts unchanged.
2. In `src/lib/design/prompts.ts`, change `newPageMessages` to:

```ts
function otherPagesLine(otherPages: string[]): string {
  return otherPages.length > 0
    ? `\n\nOther pages: ${otherPages.join(", ")}. Link to them by name in the navigation and nowhere else.`
    : "";
}

export function newPageMessages(
  brief: string,
  request: string,
  otherPages: string[],
): Message[] {
  return [
    {
      role: "user",
      content: `Product: ${brief}\n\nDesign this page: ${request}${otherPagesLine(otherPages)}`,
    },
  ];
}
```

Keep the sentence exactly that short: it is for a 3B model.

Verify:

```
bunx vitest run src/lib/design/page-change.test.ts
bun run typecheck
```

Expected: all tests in the file pass. Typecheck fails in exactly one place,
`src/lib/design/change-service.ts`, because it does not pass `otherPages` yet.
Step 2 fixes that.

### Step 2: the change service supplies the other pages' names

TDD: add a failing test to `src/lib/design/change-service.test.ts`. The file has
a `designWithSystem()` helper that creates a design, a system version and one
page named `pricing`, and a `modelReplying(...replies)` helper whose `fetchImpl`
records nothing but the model name. You need the request body, so add a small
helper next to `modelReplying`:

```ts
function modelSeeing(reply: string) {
  const bodies: { messages: { content: string }[] }[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(sse(reply));
  }) as typeof fetch;
  return { fetchImpl, bodies };
}
```

Then the test, inside `describe("change service", ...)`:

```ts
it("names the design's other pages when drafting a page", async () => {
  const { id, pageId } = await designWithSystem();
  await addPage(directory, id, "checkout");
  const { fetchImpl, bodies } = modelSeeing(fenced(PAGE));
  await pageChangeResponse(id, pageId, body, {
    directory,
    config: CONFIG,
    fetchImpl,
  }).then((response) => response.text());
  expect(bodies[0].messages[0].content).toContain("Other pages: checkout.");
  expect(bodies[0].messages[0].content).not.toContain("pricing");
});
```

`addPage` is already imported in that test file. Run it and confirm it fails:

```
bunx vitest run src/lib/design/change-service.test.ts -t "other pages"
```

Make it pass in `src/lib/design/change-service.ts`: add a helper near
`baseVersion`,

```ts
function otherPageNames(design: Design, pageId: string): string[] {
  return design.pages
    .filter((page) => page.id !== pageId)
    .map((page) => page.name);
}
```

and add `otherPages: otherPageNames(design, pageId),` to the object passed to
`pageChange` in `pageChangeResponse`. `Design` is already imported as a type in
that file.

Verify:

```
bunx vitest run src/lib/design/change-service.test.ts src/lib/design/page-change.test.ts
bun run typecheck
```

Expected: all pass, typecheck exit 0.

### Step 3: the starter kit gains a `Nav` component

TDD: in `src/lib/design/starter-components.test.ts`, change the expected
`componentNames` list to end with `"ImagePlaceholder", "Nav"`, and add:

```ts
it("renders Nav links from an array", () => {
  const code = `${STARTER_COMPONENTS}\nexport default function Page() { return <Nav links={["Home", "Pricing"]} />; }`;
  const loaded = loadDesign({ code, entry: "default", components: null });
  const html = loaded.ok
    ? renderToStaticMarkup(createElement(loaded.component))
    : "";
  expect(html).toContain(">Home<");
  expect(html).toContain(">Pricing<");
});
```

Run and confirm both assertions fail:

```
bunx vitest run src/lib/design/starter-components.test.ts
```

Then add `Nav` to `STARTER_COMPONENTS`, directly after `ImagePlaceholder` and
before `Showcase`. It must follow the same shape as the others (spread
`...props` on the root, join `className`), use only token classes, take a
`links` array of strings, and render an `<a>` per link with `href="#"` so the
wireframe never navigates the sandboxed frame away. Inside the template string,
escape backticks and `${` as the existing components do:

```tsx
export function Nav({ brand = "Brand", links = [], className = "", ...props }) {
  return (
    <nav className={\`bg-background text-foreground border-b border-border flex items-center gap-6 px-6 py-3 \${className}\`} {...props}>
      <span className="font-semibold">{brand}</span>
      {links.map((link) => (
        <a key={link} href="#" className="text-muted text-sm hover:text-foreground">{link}</a>
      ))}
    </nav>
  );
}
```

Add one line to `Showcase` so the review rule "Showcase renders every component"
stays true. Put it as the first child of the outer `div`, before the
`<Heading level={1}>`:

```tsx
<Nav links={["Home", "Pricing", "Docs"]} />
```

Then update line 42 of `src/lib/design/prompts.ts` so the model keeps `Nav` when
it adapts the starter kit. Replace `Text and ImagePlaceholder,` with
`Text, ImagePlaceholder and Nav (brand and a links array),`. Change nothing else
in that prompt.

Verify:

```
bunx vitest run src/lib/design/starter-components.test.ts src/lib/design/system-change.test.ts src/lib/design/review.test.ts
```

Expected: all pass. `system-change.test.ts` asserts that the starter kit sent to
the model contains `export function ImagePlaceholder`; that still holds. If a
test in that file asserts on the exact text of line 42 of the prompt, update
that assertion to the new wording and nothing else.

### Step 4: full gate

```
.claude/verify
```

Expected: exit 0 (tests with coverage, `tsc`, `eslint`, `fallow` all clean). If
`fallow` reports an unused export you introduced, remove it; never suppress.

### Step 5 (optional, only if Ollama is running on this machine): observe the model

This is the spike part. Skip it, and say you skipped it, if
`curl -s http://localhost:11434/api/tags` does not answer.

1. `bun run dev` in a second terminal, open the sign-in link it prints.
2. Create a design from the brief "A plant shop", wait for the system and the
   first page, then add a page "Checkout" from the left nav.
3. In the inspector's code block for the Checkout page, note whether the header
   uses `<Nav` and whether its links name the real pages.

Record the observation (one or two sentences, including the model name from the
picker) in the status row's note in `plans/README.md`. A 3B model that ignores
the hint is a finding, not a failure of this plan.

## Done criteria

- `bunx vitest run src/lib/design/page-change.test.ts src/lib/design/change-service.test.ts src/lib/design/starter-components.test.ts`
  exits 0 and the four new tests from steps 1-3 are present and passing.
- `grep -c "Other pages:" src/lib/design/prompts.ts` prints `1`.
- `grep -c "export function Nav" src/lib/design/starter-components.ts` prints
  `1`.
- `grep -n "otherPages" src/lib/design/code-draft.ts src/lib/handoff/handoff.ts`
  prints nothing (edits and handoff untouched).
- `.claude/verify` exits 0.
- `git status --short` lists only files from the "In scope" list plus the
  pre-existing `CLAUDE.md` modification.

## Test plan

New tests, all following the exemplars already in their files:

| File                         | Test                                                  | Pattern to copy                                                   |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `page-change.test.ts`        | other pages named for a new page                      | "drafts a page with the design system's components in the prompt" |
| `page-change.test.ts`        | no mention when there are none                        | same                                                              |
| `change-service.test.ts`     | service passes sibling page names, not the page's own | "drafts a page from the latest design system"                     |
| `starter-components.test.ts` | Nav renders its links                                 | "exports the core components and a Showcase that renders"         |

No new test files are needed.

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts do not match the live code (drift).
- `STARTER_COMPONENTS` with `Nav` added fails `reviewComponents` with a warning
  about colours: that means a class in the snippet is not a token class. Report
  the warning text rather than loosening the review.
- Adding `Nav` to the required list in the prompt makes `system-change.test.ts`
  fail for a reason other than an exact-text assertion on that line.
- You find yourself wanting to change `handoff.ts`, `review.ts` or any
  `components/**` file.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The hint is only sent for **new** pages. Whole-page edits
  (`wholeChangeMessages`) deliberately do not get it, to keep edit prompts
  minimal. If pages later get renamed, the stale link names in existing pages
  are a known gap; a "refresh navigation" change request is the manual fix.
- `otherPageNames` includes pages that have no drafted version yet (a page that
  is mid-draft). That is intended: the user has named it.
- Reviewer focus: the prompt wording in `prompts.ts` should remain one short
  sentence. Resist adding more rules there; every extra line costs a 3B model.
- Deferred, on purpose: a shared `Shell`/layout component with slots, a page map
  in the handoff markdown, and re-drafting existing pages when a page is added.
  Each is a separate decision once the Nav hint has been observed with a real
  model (step 5).
