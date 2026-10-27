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
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`…). The
  `commit-msg` hook runs commitlint and rejects anything else. The `pre-commit`
  hook runs lint-staged (prettier on every staged file), `tsc` and the full test
  suite, so a commit takes as long as the tests.
- `public/preview/main.js` is gitignored. A fresh clone has no preview until
  `bun run dev` or `bun run build:preview` has run once.

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

**Pipelines** (`lib/design/`). The two streaming routes are thin: both call
`change-service.ts`, which validates the body (`request`, `nodeId`,
`baseVersion`, `model`), loads the design, resolves the base version (editing a
version that is not the latest is allowed, and `nodeId` only applies when a base
exists), streams the model output as text and saves the new version at the end.
Every model call goes through `runDraft` in `draft-runner.ts`. A `Draft` has a
request, a `check` that turns the reply into a value plus a `Review` of errors
and warnings, and a `repair` message. The first reply must be clean. Otherwise
the model gets one repair turn listing every problem. A repair with only
warnings is accepted, and if the repair still has errors, a first reply with
only warnings is kept.

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

JSX is parsed with `@babel/parser` through `jsx-tree.ts`, which `annotate.ts`,
`subtree.ts`, `review.ts`, `code-draft.ts` and the handoff share. Use it instead
of regexes or a second parser.

**Element ids** (`annotate.ts`, `subtree.ts`). Saved code carries
`data-node-id="nN"` on host elements. Pages also put it on component usages:
components spread `...props`, so the id reaches the DOM. Ids are stable across
edits (`withRootId` keeps a replaced element's id). They are stripped before the
model sees code and in the handoff.

**Compile and run** (`compile.ts`, `load-design.ts`). sucrase transforms the
code. Only `react` and `./components` may be imported. `loadDesign` runs the
components module and then the page, with the component exports injected as
scope names and behind `require("./components")`.

**Preview** (`src/preview/main.tsx`, `components/preview/`). Generated code is
untrusted, so it runs in an iframe with `sandbox="allow-scripts"` and no
`allow-same-origin`. Its origin is opaque: it cannot read the app, its cookie or
its API. It is a static page, `public/preview/index.html`, that loads `main.js`.
`bun run build:preview` bundles that file as a classic script, and `dev` and
`build` run it first. Rebuild it after you change `components/preview/`. The two
sides talk over a private `MessageChannel`. The workspace offers a port with a
`connect` message when it mounts. It offers another when the preview's `ready`
reaches the window, because the preview can load before the workspace hydrates.
The preview keeps the first port it gets and answers `ready` on it, and after
that the workspace stops offering ports. If generated code navigates the frame
away, the new page has no port and gets nothing. Messages are validated by
`lib/preview-protocol.ts` (zod). A `render` message holds the code, the entry
(`default` or `Showcase`), the components source, the theme CSS from `themeCss`
and the light or dark mode. The theme goes into a
`<style type="text/tailwindcss">` for `@tailwindcss/browser`. The preview posts
back `ready`, `select` and `error`.

**Storage** (`lib/store/designs.ts`). Designs are JSON files in
`~/.local/share/local-designer/designs` (`LOCAL_DESIGNER_DESIGNS` overrides it).
Restoring adds a copy of an old version as a new version.

**API routes** (`app/api/designs/...`):

- `GET /api/models`: the models for the picker and the default. Every change
  request names its `model`, so the picker overrides `LOCAL_DESIGNER_MODEL` per
  request.
- `POST /`: create a design from a brief.
- `GET [id]`: read a design.
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
same-origin JSON. GET `/preview/` files are served without the cookie because
the sandboxed frame cannot send it. Every route forbids framing except
`/preview/`, which only its own origin may frame. The preview's CSP also allows
only this origin's scripts and blocks every network request. Keep new mutating
routes JSON.

**UI** uses Geist-style tokens in `src/app/(studio)/globals.css`, with dark mode
following `prefers-color-scheme`. Use those utilities, not hex or arbitrary
values. `components/ui/` holds the shadcn-style primitives (`components.json`);
add new primitives there rather than styling raw elements in the workspace.
Shared domain types are in `src/lib/types.ts`. Use the `@/` import alias for
`src/`.
