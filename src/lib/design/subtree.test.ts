import { describe, expect, it } from "vitest";
import { annotate } from "./annotate";
import { elementSource, elementTag, replaceElement } from "./subtree";

const SOURCE = annotate(`export default function Page() {
  return (
    <main>
      <section className="grid">
        <div>One</div>
        <br />
      </section>
    </main>
  );
}`);

describe("subtree", () => {
  it("returns an element's JSX without ids", () => {
    expect(elementSource(SOURCE, "n2")).toBe(
      '<section className="grid">\n        <div>One</div>\n        <br />\n      </section>',
    );
    expect(elementSource(SOURCE, "n4")).toBe("<br />");
    expect(elementSource(SOURCE, "n99")).toBeNull();
  });

  it("names the selected element's tag", () => {
    expect(elementTag(SOURCE, "n3")).toBe("div");
    expect(elementTag(SOURCE, "n99")).toBeNull();
  });

  it("replaces only the selected element", () => {
    const replaced = replaceElement(SOURCE, "n3", '<div className="bold">Two</div>');
    expect(replaced).toContain('<div className="bold">Two</div>');
    expect(replaced).toContain('<main data-node-id="n1">');
    expect(replaced).toContain('<br data-node-id="n4" />');
    expect(replaced).not.toContain("One");
  });

  it("throws when the element is gone", () => {
    expect(() => replaceElement(SOURCE, "n99", "<p />")).toThrow("Element n99 was not found");
  });
});
