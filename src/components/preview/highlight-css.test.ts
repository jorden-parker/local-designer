import { describe, expect, it } from "vitest";
import { highlightCss } from "./highlight-css";

describe("highlightCss", () => {
  it("outlines the hovered element and the selected one", () => {
    const css = highlightCss("n2", "n5");
    expect(css).toContain('[data-node-id="n2"]');
    expect(css).toContain('[data-node-id="n5"]');
  });

  it("ignores ids that are not node ids, so nothing can be injected", () => {
    expect(highlightCss('"]{}body{display:none', null)).not.toContain("display:none");
    expect(highlightCss(null, null)).not.toContain("[data-node-id=");
  });
});
