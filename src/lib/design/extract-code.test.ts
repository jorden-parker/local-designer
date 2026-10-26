import { describe, expect, it } from "vitest";
import { extractCode } from "./extract-code";

describe("extractCode", () => {
  it("takes the code out of a fenced block and drops the chatter around it", () => {
    const reply = "Here you go:\n```tsx\nexport default function A() {}\n```\nEnjoy!";
    expect(extractCode(reply)).toBe("export default function A() {}");
  });

  it("picks the longest block when the reply has several", () => {
    const reply = "```\nshort\n```\n```jsx\nexport default function Page() { return null; }\n```";
    expect(extractCode(reply)).toBe("export default function Page() { return null; }");
  });

  it("keeps a reply that has no fences", () => {
    expect(extractCode("  <div>hi</div>\n")).toBe("<div>hi</div>");
  });

  it("handles a fence that was never closed", () => {
    expect(extractCode("```tsx\nexport default function A() {}")).toBe(
      "export default function A() {}",
    );
  });
});
