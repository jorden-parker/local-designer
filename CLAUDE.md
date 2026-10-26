# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this is

local-designer is a local-only Next.js app for drafting wireframes with a local
model through Ollama. A design is a project made of:

- a **design system**: tokens (light and dark colours, radius, font) and a
  `components.tsx` of shared React components with a `Showcase`;
- **pages**, each a React component that must reuse those tokens and components.

Every change is a new version, so history is never lost. You can select one
element in the preview and change only that element. A handoff zip (or a Claude
Code prompt) carries the tokens, theme, components, pages and a brief.

## Commands

- `bun run dev`: dev server on http://127.0.0.1:4490 (it binds to loopback only,
  on purpose)
- `bun run test`: all Vitest tests, with coverage
- `bunx vitest run src/lib/design/page-change.test.ts`: one file; add
  `-t "<name>"` for a single test
- `bunx vitest run --project node` or `--project dom`: one test environment only
- `bun run typecheck`, `bun run lint`, `bunx fallow`
- `.claude/verify`: runs the full gate (tests, tsc, eslint, fallow). It must
  pass before you finish.

Vitest has two projects. `*.test.ts` runs in node and `*.test.tsx` runs in jsdom
(setup: `src/test/dom-setup.ts`). `src/test/fake-model.ts` fakes a streaming
model for pipeline tests.

## Architecture

**Model** (`lib/llm/`). `client.ts` streams from Ollama's Anthropic-compatible
`/v1/messages` with thinking off and temperature 0. Configure it with
`LOCAL_DESIGNER_LLM_URL` (or `OLLAMA_HOST`), `LOCAL_DESIGNER_MODEL` and
`LOCAL_DESIGNER_LLM_TIMEOUT_MS`. Without `LOCAL_DESIGNER_MODEL`,
`model-choice.ts` uses the first model in claude-ollama's `ollama/sizes.json`
that Ollama has installed. `chatModels` lists the models for the picker. On this
machine `.env.local` pins the small `granite4.2-3b-cc` for testing.

**Pipelines** (`lib/design/`). Every model call goes through `runDraft` in
`draft-runner.ts`. A `Draft` has a request, a `check` that turns the reply into
a value plus a `Review` of errors and warnings, and a `repair` message. The
first reply must be clean. Otherwise the model gets one repair turn listing
every problem. A repair with only warnings is accepted, and if the repair still
has errors, a first reply with only warnings is kept.

- `system-change.ts`: tokens as JSON (`tokens.ts`, zod-validated) and then
  components. A new system starts from `starter-components.ts`, which the model
  adapts to the product. If that fails, the starter kit is kept. Small models
  cannot write a component library from nothing.
- `page-change.ts`: drafts or edits a page with the components in scope.
  `review.ts` rejects components that do not exist and warns about colours that
  are not tokens.
- `code-draft.ts`: whole-file and single-element drafts. An element reply with
  sibling roots is wrapped in a fragment, and a whole-file reply replaces the
  file.
- `prompts.ts` holds every prompt. Keep the rules short and concrete, because
  they have to work with a 3B model.

**Element ids** (`annotate.ts`, `subtree.ts`). Saved code carries
`data-node-id="nN"` on host elements. Pages also put it on component usages:
components spread `...props`, so the id reaches the DOM. Ids are stable across
edits (`withRootId` keeps a replaced element's id). They are stripped before the
model sees code and in the handoff.

**Compile and run** (`compile.ts`, `load-design.ts`). sucrase transforms the
code. Only `react` and `./components` may be imported. `loadDesign` runs the
components module and then the page, with the component exports injected as
scope names and behind `require("./components")`.

**Preview** (`app/(preview)/preview`, `components/preview/`). An iframe
(`sandbox="allow-scripts allow-same-origin"`) gets `render` messages through
`lib/preview-protocol.ts` (zod). A message holds the code, the entry (`default`
or `Showcase`), the components source, the theme CSS from `themeCss` and the
light or dark mode. The theme goes into a `<style type="text/tailwindcss">` for
`@tailwindcss/browser`. The preview posts back `ready`, `select` and `error`.

**Storage** (`lib/store/designs.ts`). Designs are JSON files in
`~/.local/share/local-designer/designs` (`LOCAL_DESIGNER_DESIGNS` overrides it).
Restoring adds a copy of an old version as a new version.

**API routes** (`app/api/designs/...`):

- `POST /`: create a design from a brief.
- `POST [id]/system`: stream a design system change.
- `POST [id]/pages`: add a page.
- `POST [id]/pages/[pageId]/changes`: stream a page change. It returns 409
  before a system exists.
- `POST [id]/restore`: restore a version of `{ target, version }`.
- `GET [id]/handoff`: the zip, or the prompt with `?format=prompt`
  (`lib/handoff/`).

Streams are plain text, and a failure ends them with `STREAM_ERROR_MARKER`.

**Client** (`components/workspace/`). `use-workspace.ts` drafts the system and
then the first page from the brief, and runs changes against the current target.
`use-target-view.ts` and the pure `target-view.ts` turn the design, the target,
the viewed version and the mode into what the panels and canvas show. `api.ts`
is the only module that fetches.

**Security boundary** (`src/proxy.ts`). It rejects non-loopback `Host` headers
and requires the `local-designer-token` cookie. The token lives in a 0600 file,
and `instrumentation.ts` prints the sign-in link. Non-GET requests must be
same-origin JSON. Every route forbids framing except `/preview`, which only its
own origin may frame. Keep new mutating routes JSON.

**UI** uses Geist-style tokens in `src/app/(studio)/globals.css`, with dark mode
following `prefers-color-scheme`. Use those utilities, not hex or arbitrary
values. Shared domain types are in `src/lib/types.ts`. Use the `@/` import alias
for `src/`.
