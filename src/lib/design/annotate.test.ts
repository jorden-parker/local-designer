import { describe, expect, it } from "vitest";
import { annotate, NODE_ID_ATTRIBUTE, stripIds, withRootId } from "./annotate";

const SOURCE = `export default function Page() {
  return (
    <main className="p-4">
      <h1>Title</h1>
      <Card />
      <img src="x" />
    </main>
  );
}`;

describe("annotate", () => {
  it("gives every lowercase JSX element an id in document order and skips components", () => {
    const annotated = annotate(SOURCE);
    expect(annotated).toContain('<main data-node-id="n1" className="p-4">');
    expect(annotated).toContain('<h1 data-node-id="n2">');
    expect(annotated).toContain('<img data-node-id="n3" src="x" />');
    expect(annotated).toContain("<Card />");
  });

  it("also gives component usages an id when asked, so pages can select them", () => {
    const annotated = annotate(SOURCE, "elements-and-components");
    expect(annotated).toContain('<Card data-node-id="n3" />');
    expect(annotated).toContain('<img data-node-id="n4" src="x" />');
  });

  it("keeps existing ids and numbers new elements after the highest one", () => {
    const edited = annotate(SOURCE).replace("<h1", "<section><p>New</p></section><h1");
    const annotated = annotate(edited);
    expect(annotated).toContain('<main data-node-id="n1"');
    expect(annotated).toContain('<h1 data-node-id="n2">');
    expect(annotated).toContain('<section data-node-id="n4"><p data-node-id="n5">New</p>');
  });

  it("round-trips through stripIds", () => {
    expect(stripIds(annotate(SOURCE))).toBe(SOURCE);
    expect(NODE_ID_ATTRIBUTE).toBe("data-node-id");
  });

  it("gives a replacement element the id of the element it replaces", () => {
    expect(withRootId('<section className="a"><p>x</p></section>', "n7")).toBe(
      '<section data-node-id="n7" className="a"><p>x</p></section>',
    );
    expect(withRootId("<Card />", "n7")).toBe('<Card data-node-id="n7" />');
    expect(withRootId("<motion.div />", "n7")).toBe("<motion.div />");
    expect(withRootId('<div data-node-id="n2" />', "n7")).toBe('<div data-node-id="n2" />');
  });
});
