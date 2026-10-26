import { describe, expect, it } from "vitest";
import { isFromPreview, isToPreview } from "./preview-protocol";

const RENDER = {
  type: "render",
  code: "x",
  entry: "default",
  components: "y",
  theme: "@theme {}",
  mode: "dark",
};

describe("preview protocol", () => {
  it("accepts the messages the preview sends", () => {
    expect(isFromPreview({ type: "ready" })).toBe(true);
    expect(isFromPreview({ type: "select", nodeId: "n3" })).toBe(true);
    expect(isFromPreview({ type: "select", nodeId: null })).toBe(true);
    expect(isFromPreview({ type: "error", message: "boom" })).toBe(true);
  });

  it("accepts the messages the workspace sends", () => {
    expect(isToPreview(RENDER)).toBe(true);
    expect(isToPreview({ ...RENDER, entry: "Showcase", components: null })).toBe(true);
    expect(isToPreview({ type: "highlight", nodeId: null })).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isFromPreview({ type: "select", nodeId: 3 })).toBe(false);
    expect(isFromPreview("ready")).toBe(false);
    expect(isToPreview({ type: "render", code: "x" })).toBe(false);
    expect(isToPreview({ ...RENDER, mode: "sepia" })).toBe(false);
    expect(isToPreview(null)).toBe(false);
  });
});
