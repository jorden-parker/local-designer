import { describe, expect, it } from "vitest";
import { annotate } from "@/lib/design/annotate";
import { DEFAULT_TOKENS, themeCss } from "@/lib/design/tokens";
import type { Design } from "@/lib/types";
import { editedNodeId, initialTarget, targetView } from "./target-view";

const META = { request: "r", nodeId: null, model: "m", createdAt: "t" };
const COMPONENTS = annotate("export function Showcase() { return <section />; }");

const DESIGN: Design = {
  id: "d",
  title: "Shop",
  brief: "A shop",
  createdAt: "t",
  system: [{ ...META, number: 1, tokens: DEFAULT_TOKENS, components: COMPONENTS }],
  pages: [
    {
      id: "p1",
      name: "Pricing",
      prompt: "Pricing",
      versions: [
        { ...META, number: 1, code: "one" },
        { ...META, number: 2, code: "two" },
      ],
    },
  ],
};

describe("targetView", () => {
  it("shows the latest page version with the design system's components and theme", () => {
    const view = targetView(DESIGN, { kind: "page", pageId: "p1" }, null, "dark");
    expect(view).toMatchObject({ code: "two", tokens: null });
    expect(view.latest?.number).toBe(2);
    expect(view.render).toEqual({
      type: "render",
      code: "two",
      entry: "default",
      components: "export function Showcase() { return <section />; }",
      theme: themeCss(DEFAULT_TOKENS),
      mode: "dark",
    });
  });

  it("shows an older version when one is viewed", () => {
    const view = targetView(DESIGN, { kind: "page", pageId: "p1" }, 1, "light");
    expect(view.viewed?.number).toBe(1);
    expect(view.render?.code).toBe("one");
  });

  it("shows the design system's Showcase with its own tokens", () => {
    const view = targetView(DESIGN, { kind: "system" }, null, "light");
    expect(view).toMatchObject({ code: COMPONENTS, tokens: DEFAULT_TOKENS });
    expect(view.render).toMatchObject({ code: COMPONENTS, entry: "Showcase", components: null });
  });

  it("lists the elements the viewed version changed against the one before", () => {
    const first = annotate("export default function P() { return <main><h1>A</h1></main>; }");
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
      targetView(design, { kind: "page", pageId: "p1" }, null, "light").changedNodeIds,
    ).toEqual(["n2"]);
    expect(targetView(design, { kind: "page", pageId: "p1" }, 1, "light").changedNodeIds).toEqual(
      [],
    );
  });

  it("has nothing to render before anything is drafted", () => {
    const empty = { ...DESIGN, system: [], pages: [] };
    expect(targetView(empty, { kind: "system" }, null, "light").render).toBeNull();
    expect(targetView(empty, { kind: "page", pageId: "p9" }, null, "light")).toMatchObject({
      versions: [],
      render: null,
    });
  });
});

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

describe("initialTarget", () => {
  it("opens the first page once there is one, and the design system before that", () => {
    expect(initialTarget(DESIGN)).toEqual({ kind: "page", pageId: "p1" });
    expect(initialTarget({ ...DESIGN, pages: [] })).toEqual({ kind: "system" });
  });
});
