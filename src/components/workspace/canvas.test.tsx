import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RenderMessage } from "@/lib/preview-protocol";
import { Canvas } from "./canvas";

const RENDER: RenderMessage = {
  type: "render",
  code: "export default function D() {}",
  entry: "default",
  components: null,
  theme: "@theme {}",
  mode: "light",
};

function setup(design: RenderMessage | null = RENDER) {
  const onSelect = vi.fn();
  const onFixError = vi.fn();
  const view = render(
    <Canvas
      design={design}
      viewport="mobile"
      selectedNodeId="n2"
      running={false}
      onSelect={onSelect}
      onFixError={onFixError}
    />,
  );
  const frame = screen.getByTitle("Design preview") as HTMLIFrameElement;
  const preview = frame.contentWindow as Window;
  const posted = vi.spyOn(preview, "postMessage");
  const fromPreview = (data: unknown, source: Window | null = preview) =>
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data, source, origin: window.location.origin }),
      );
    });
  return { onSelect, onFixError, posted, fromPreview, frame, view };
}

describe("Canvas", () => {
  it("sends the code and the selection once the preview is ready", () => {
    const { posted, fromPreview } = setup();
    expect(posted).not.toHaveBeenCalled();
    fromPreview({ type: "ready" });
    expect(posted).toHaveBeenCalledWith(RENDER, window.location.origin);
    expect(posted).toHaveBeenCalledWith(
      { type: "highlight", nodeId: "n2" },
      window.location.origin,
    );
  });

  it("passes selections on and ignores messages from other windows", () => {
    const { onSelect, fromPreview } = setup();
    fromPreview({ type: "select", nodeId: "n7" });
    fromPreview({ type: "select", nodeId: "n8" }, window);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("n7");
  });

  it("shows a render error and asks the model to fix it", async () => {
    const { onFixError, fromPreview } = setup();
    fromPreview({ type: "error", message: "tiers is not defined" });
    expect(screen.getByRole("alert").textContent).toContain("tiers is not defined");
    await userEvent.click(screen.getByRole("button", { name: "Ask the model to fix it" }));
    expect(onFixError).toHaveBeenCalledWith("tiers is not defined");
  });

  it("sizes the frame to the viewport and says when there is nothing to show", () => {
    const { frame } = setup(null);
    expect(frame.parentElement?.style.width).toBe("390px");
    expect(screen.getByText("Nothing drafted yet")).toBeTruthy();
  });
});
