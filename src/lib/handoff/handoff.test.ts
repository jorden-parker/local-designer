import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { annotate } from "@/lib/design/annotate";
import type { Design } from "@/lib/types";
import { DEFAULT_TOKENS } from "@/lib/design/tokens";
import { claudeCodePrompt, handoffFiles, handoffMarkdown, handoffZip } from "./handoff";
import { outline } from "./outline";

const CODE = annotate(`export default function Design() {
  const tiers = ["Free", "Pro"];
  return (
    <main>
      <h1>Pricing</h1>
      <section>
        {tiers.map((tier) => (
          <div key={tier}>
            <h2>{tier}</h2>
            <Button>Choose</Button>
          </div>
        ))}
      </section>
    </main>
  );
}`);

const META = { nodeId: null, model: "granite4.2-3b-cc", createdAt: "2026-10-26T00:00:00Z" };

const COMPONENTS = annotate(
  'export function Button({ className = "", ...props }) {\n  return <button className={`bg-primary ${className}`} {...props} />;\n}\nexport function Card(props) {\n  return <div {...props} />;\n}\nexport function Showcase() {\n  return <Button>Go</Button>;\n}',
);

const DESIGN: Design = {
  id: "d",
  title: "Shop",
  brief: "A shop for plants",
  createdAt: "2026-10-26T00:00:00Z",
  system: [
    { ...META, number: 1, tokens: DEFAULT_TOKENS, components: "old", request: "Design system" },
    { ...META, number: 2, tokens: DEFAULT_TOKENS, components: COMPONENTS, request: "Rounder" },
  ],
  pages: [
    {
      id: "p1",
      name: "Pricing page",
      prompt: "A pricing page with a FAQ",
      versions: [
        { ...META, number: 1, code: "old", request: "A pricing page with a FAQ" },
        { ...META, number: 2, code: CODE, request: "Make the cards bigger", nodeId: "n3" },
      ],
    },
    { id: "p2", name: "Empty", prompt: "Nothing yet", versions: [] },
  ],
};

describe("outline", () => {
  it("nests elements, labels them with their text and reaches into mapped lists", () => {
    expect(outline(CODE)).toBe(
      [
        "- `main`",
        '  - `h1` "Pricing"',
        "  - `section`",
        "    - `div`",
        "      - `h2`",
        '      - `Button` "Choose"',
      ].join("\n"),
    );
  });
});

describe("handoff", () => {
  it("writes a brief with the design system, each page, its changes and its structure", () => {
    const markdown = handoffMarkdown(DESIGN);
    expect(markdown).toContain("# Shop");
    expect(markdown).toContain("A shop for plants");
    expect(markdown).toContain("| primary | `#171717` | `#ededed` |");
    expect(markdown).toContain("`Button`, `Card`");
    expect(markdown).toContain("## Page: Pricing page (`pages/p1-pricing-page.tsx`)");
    expect(markdown).toContain("1. Make the cards bigger (on one selected element)");
    expect(markdown).toContain('  - `h1` "Pricing"');
    expect(markdown).not.toContain("Nothing yet");
  });

  it("writes clean files with the imports each page needs", () => {
    const files = handoffFiles(DESIGN);
    expect(Object.keys(files).sort()).toEqual([
      "components.tsx",
      "pages/p1-pricing-page.tsx",
      "theme.css",
      "tokens.json",
    ]);
    expect(files["components.tsx"]).toMatch(
      /^import React from "react";\n\nexport function Button/,
    );
    expect(files["pages/p1-pricing-page.tsx"]).toMatch(
      /^import React from "react";\nimport \{ Button \} from "\.\.\/components";\n\nexport default/,
    );
    expect(files["theme.css"]).toMatch(/^@import "tailwindcss";\n\n@theme \{/);
    expect(JSON.parse(files["tokens.json"])).toEqual(DEFAULT_TOKENS);
    expect(Object.values(files).join("")).not.toContain("data-node-id");
  });

  it("builds a Claude Code prompt that carries the brief and every file", () => {
    const prompt = claudeCodePrompt(DESIGN);
    expect(prompt).toMatch(/^Implement this wireframe/);
    expect(prompt).toContain("### pages/p1-pricing-page.tsx\n\n```tsx\nimport React");
    expect(prompt).toContain("### theme.css\n\n```css\n");
  });

  it("zips HANDOFF.md with the files", () => {
    const files = unzipSync(handoffZip(DESIGN));
    expect(Object.keys(files)).toContain("HANDOFF.md");
    expect(strFromU8(files["components.tsx"])).toContain("export function Card");
  });

  it("refuses a design that has no design system yet", () => {
    expect(() => handoffMarkdown({ ...DESIGN, system: [] })).toThrow("has no design system");
  });
});
