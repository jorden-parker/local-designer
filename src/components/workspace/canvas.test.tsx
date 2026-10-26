import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function offeredPorts(posted: ReturnType<typeof vi.fn>): MessagePort[] {
  return posted.mock.calls
    .filter(([message]) => (message as { type: string }).type === "connect")
    .map(([, , transfer]) => (transfer as MessagePort[])[0]);
}

async function connectPreview(posted: ReturnType<typeof vi.fn>) {
  const port = offeredPorts(posted).at(-1) as MessagePort;
  const received: unknown[] = [];
  port.onmessage = (event) => received.push(event.data);
  port.postMessage({ type: "ready" });
  await flush();
  const send = async (data: unknown) => {
    port.postMessage(data);
    await flush();
  };
  return { received, send };
}

function setup(design: RenderMessage | null = RENDER) {
  const onSelect = vi.fn();
  const onFixError = vi.fn();
  const posted = vi.fn();
  vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue({
    postMessage: posted,
  } as unknown as Window);
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
  const announce = (source: unknown = preview) =>
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ready" },
          source: source as Window,
          origin: "null",
        }),
      );
    });
  return { onSelect, onFixError, posted, announce, frame, view };
}

describe("Canvas", () => {
  afterEach(() => vi.restoreAllMocks());

  it("offers the preview a private channel and sends the design over it", async () => {
    const { posted } = setup();
    expect(posted).toHaveBeenCalledWith({ type: "connect" }, "*", [expect.any(MessagePort)]);
    const preview = await connectPreview(posted);
    expect(preview.received).toEqual([RENDER, { type: "highlight", nodeId: "n2" }]);
  });

  it("offers a new channel when a preview that missed the first one says it is ready", () => {
    const { posted, announce } = setup();
    announce(window);
    expect(offeredPorts(posted)).toHaveLength(1);
    announce();
    expect(offeredPorts(posted)).toHaveLength(2);
  });

  it("stops offering channels once the preview has connected", async () => {
    const { posted, announce } = setup();
    await connectPreview(posted);
    announce();
    expect(offeredPorts(posted)).toHaveLength(1);
  });

  it("passes selections from the preview on", async () => {
    const { onSelect, posted } = setup();
    const preview = await connectPreview(posted);
    await preview.send({ type: "select", nodeId: "n7" });
    expect(onSelect).toHaveBeenCalledWith("n7");
  });

  it("shows a render error and asks the model to fix it", async () => {
    const { onFixError, posted } = setup();
    const preview = await connectPreview(posted);
    await preview.send({ type: "error", message: "tiers is not defined" });
    expect(screen.getByRole("alert").textContent).toContain("tiers is not defined");
    await userEvent.click(screen.getByRole("button", { name: "Ask the model to fix it" }));
    expect(onFixError).toHaveBeenCalledWith("tiers is not defined");
  });

  it("sizes the frame to the viewport and says when there is nothing to show", () => {
    const { frame } = setup(null);
    expect(frame.parentElement?.style.width).toBe("390px");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(screen.getByText("Nothing drafted yet")).toBeTruthy();
  });
});
