import { strToU8, zipSync } from "fflate";
import { stripIds } from "@/lib/design/annotate";
import { componentTags } from "@/lib/design/jsx-tree";
import { componentNames } from "@/lib/design/review";
import { COLOR_TOKENS, themeCss, type Tokens } from "@/lib/design/tokens";
import { slug } from "@/lib/slug";
import type { Design, Page, PageVersion, SystemVersion } from "@/lib/types";
import { outline } from "./outline";

const WHAT_TO_BUILD = `This is a wireframe. It settles layout, hierarchy, content and behaviour, and it comes with a small design system: tokens, a theme and shared components.
Map the tokens and components onto this project's own design system where it has one, and add them where it does not. Build each page with the project's routing and data, replace the image placeholders with real images, and keep everything responsive.`;

const REACT_IMPORT = 'import React from "react";\n';

type DraftedPage = Page & { latest: PageVersion };

function latestSystem(design: Design): SystemVersion {
  const latest = design.system.at(-1);
  if (!latest) throw new Error(`Design ${design.id} has no design system yet`);
  return latest;
}

function draftedPages(design: Design): DraftedPage[] {
  return design.pages.flatMap((page) => {
    const latest = page.versions.at(-1);
    return latest ? [{ ...page, latest }] : [];
  });
}

function pagePath(page: Page): string {
  return `pages/${page.id}-${slug(page.name, "page")}.tsx`;
}

function pageFile(page: DraftedPage, components: string[]): string {
  const used = [...componentTags(page.latest.code)].filter((name) => components.includes(name));
  const componentsImport = used.length
    ? `import { ${used.join(", ")} } from "../components";\n`
    : "";
  return `${REACT_IMPORT}${componentsImport}\n${stripIds(page.latest.code)}`;
}

export function handoffFiles(design: Design): Record<string, string> {
  const system = latestSystem(design);
  const names = componentNames(system.components);
  const pages = draftedPages(design).map((page) => [pagePath(page), pageFile(page, names)]);
  return {
    "tokens.json": `${JSON.stringify(system.tokens, null, 2)}\n`,
    "theme.css": `@import "tailwindcss";\n\n${themeCss(system.tokens)}\n`,
    "components.tsx": `${REACT_IMPORT}\n${stripIds(system.components)}`,
    ...Object.fromEntries(pages),
  };
}

function changeList(versions: { request: string; nodeId: string | null }[]): string {
  const changes = versions.slice(1).map((version, index) => {
    const scope = version.nodeId ? " (on one selected element)" : "";
    return `${index + 1}. ${version.request}${scope}`;
  });
  return changes.length > 0 ? changes.join("\n") : "None.";
}

function tokenTable(tokens: Tokens): string {
  const rows = COLOR_TOKENS.map(
    (token) => `| ${token} | \`${tokens.light[token]}\` | \`${tokens.dark[token]}\` |`,
  );
  return ["| Token | Light | Dark |", "| --- | --- | --- |", ...rows].join("\n");
}

function systemSection(design: Design): string {
  const system = latestSystem(design);
  const names = componentNames(system.components).map((name) => `\`${name}\``);
  const { radius, font } = system.tokens;
  return `## Design system

Version ${system.number}, drafted by \`${system.model}\`. Pages use only these tokens and components.

${tokenTable(system.tokens)}

Radius: sm \`${radius.sm}\`, md \`${radius.md}\`, lg \`${radius.lg}\`. Font: ${font}.

Components (\`components.tsx\`): ${names.join(", ")}.

Changes requested:

${changeList(design.system)}`;
}

function pageSection(page: DraftedPage): string {
  return `## Page: ${page.name} (\`${pagePath(page)}\`)

Version ${page.latest.number}, drafted by \`${page.latest.model}\`.

${page.prompt}

Changes requested:

${changeList(page.versions)}

Structure:

${outline(page.latest.code)}`;
}

export function handoffMarkdown(design: Design): string {
  const sections = [
    `# ${design.title}`,
    `## What to build\n\n${WHAT_TO_BUILD}`,
    `## Brief\n\n${design.brief}`,
    systemSection(design),
    ...draftedPages(design).map(pageSection),
    '## Files\n\n- `tokens.json`: the design tokens.\n- `theme.css`: the tokens as a Tailwind 4 theme, with dark mode under `[data-theme="dark"]`.\n- `components.tsx`: the shared components, plus a `Showcase` of them all.\n- `pages/`: one React component per page, styled with Tailwind and the tokens.',
  ];
  return `${sections.join("\n\n")}\n`;
}

function fenceLanguage(path: string): string {
  return path.split(".").at(-1) ?? "";
}

export function claudeCodePrompt(design: Design): string {
  const files = Object.entries(handoffFiles(design)).map(
    ([path, content]) => `### ${path}\n\n\`\`\`${fenceLanguage(path)}\n${content}\`\`\``,
  );
  return `Implement this wireframe in the current project.\n\n${handoffMarkdown(design)}\n${files.join("\n\n")}\n`;
}

export function handoffZip(design: Design): Uint8Array {
  const files = { ...handoffFiles(design), "HANDOFF.md": handoffMarkdown(design) };
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([path, content]) => [path, strToU8(content)])),
  );
}
