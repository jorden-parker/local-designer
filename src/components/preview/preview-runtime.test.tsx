import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { annotate } from "@/lib/design/annotate";
import { PreviewRuntime } from "./preview-runtime";

vi.mock("@tailwindcss/browser", () => ({}));

const CODE = annotate(
  "export default function Design() {\n  return <main><button>Buy</button></main>;\n}",
);

const RENDER = {
  type: "render",
  code: CODE,
  entry: "default",
  components: null,
  theme: "@theme { --color-primary: #ff0000; }",
  mode: "dark",
};

function fromWorkspace(data: unknown) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", { data, source: window, origin: window.location.origin }),
    );
  });
}

describe("PreviewRuntime", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says it is ready, renders the design and reports clicked elements", async () => {
    const posted = vi.spyOn(window, "postMessage");
    render(<PreviewRuntime />);
    expect(posted).toHaveBeenCalledWith({ type: "ready" }, window.location.origin);
    fromWorkspace(RENDER);
    await userEvent.click(screen.getByRole("button", { name: "Buy" }));
    expect(posted).toHaveBeenCalledWith({ type: "select", nodeId: "n2" }, window.location.origin);
  });

  it("applies the design system's theme and mode", () => {
    const { container } = render(<PreviewRuntime />);
    fromWorkspace(RENDER);
    expect(container.querySelector('style[type="text/tailwindcss"]')?.textContent).toBe(
      RENDER.theme,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("outlines the element the workspace highlights", () => {
    const { container } = render(<PreviewRuntime />);
    fromWorkspace({ type: "highlight", nodeId: "n1" });
    expect(container.querySelector("style")?.textContent).toContain('[data-node-id="n1"]');
  });

  it("reports code that cannot run", () => {
    const posted = vi.spyOn(window, "postMessage");
    render(<PreviewRuntime />);
    fromWorkspace({ ...RENDER, code: "export default function D() { return <p>; }" });
    expect(posted).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
      window.location.origin,
    );
  });
});
