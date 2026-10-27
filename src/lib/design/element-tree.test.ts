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
    const [root] = elementTree("export function Showcase() { return <Button>Go</Button>; }");
    expect(root).toEqual({
      nodeId: null,
      tag: "Button",
      text: "Go",
      children: [],
    });
  });

  it("is empty for code that does not parse", () => {
    expect(elementTree("export default function Page() { return <main>; }")).toEqual([]);
  });
});
