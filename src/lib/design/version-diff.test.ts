import { describe, expect, it } from "vitest";
import { annotate } from "./annotate";
import { replaceElement } from "./subtree";
import { changedNodeIds } from "./version-diff";

const PAGE = annotate(`export default function Page() {
  return (
    <main>
      <h1>Pricing</h1>
      <section>
        <p>Monthly</p>
        <p>Yearly</p>
      </section>
    </main>
  );
}`);

describe("changedNodeIds", () => {
  it("names the innermost elements whose source changed", () => {
    const next = replaceElement(PAGE, "n4", '<p data-node-id="n4">Per month</p>');
    expect(changedNodeIds(PAGE, next)).toEqual(["n4"]);
  });

  it("names a new element rather than its unchanged ancestors", () => {
    const next = PAGE.replace("</section>", '<p data-node-id="n6">Team</p></section>');
    expect(changedNodeIds(PAGE, next)).toEqual(["n6"]);
  });

  it("ignores whitespace-only differences", () => {
    const next = PAGE.replace(
      '<h1 data-node-id="n2">Pricing</h1>',
      '<h1 data-node-id="n2">\n  Pricing\n</h1>',
    );
    expect(changedNodeIds(PAGE, next)).toEqual([]);
  });

  it("reports nothing when a whole file is re-indented", () => {
    const reindented = PAGE.replaceAll("  ", "    ");
    expect(changedNodeIds(PAGE, reindented)).toEqual([]);
  });

  it("is empty when either version does not parse", () => {
    expect(changedNodeIds(PAGE, "<main>")).toEqual([]);
    expect(changedNodeIds("<main>", PAGE)).toEqual([]);
  });
});
