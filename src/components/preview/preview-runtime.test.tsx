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

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function offerChannel(source: Window = window) {
  const channel = new MessageChannel();
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "connect" },
        source,
        ports: [channel.port2],
      }),
    );
  });
  return channel.port1;
}

async function connectWorkspace() {
  const port = offerChannel();
  const received: unknown[] = [];
  port.onmessage = (event) => received.push(event.data);
  await flush();
  const send = async (data: unknown) => {
    port.postMessage(data);
    await flush();
  };
  return { received, send };
}

describe("PreviewRuntime", () => {
  afterEach(() => vi.restoreAllMocks());

  it("announces itself to the workspace window", () => {
    const posted = vi.spyOn(window, "postMessage");
    render(<PreviewRuntime />);
    expect(posted).toHaveBeenCalledWith({ type: "ready" }, "*");
  });

  it("accepts the offered channel, renders the design and reports clicked elements", async () => {
    render(<PreviewRuntime />);
    const workspace = await connectWorkspace();
    expect(workspace.received).toEqual([{ type: "ready" }]);
    await workspace.send(RENDER);
    await userEvent.click(screen.getByRole("button", { name: "Buy" }));
    await flush();
    expect(workspace.received).toContainEqual({ type: "select", nodeId: "n2" });
  });

  it("keeps the first channel and ignores later offers", async () => {
    render(<PreviewRuntime />);
    const workspace = await connectWorkspace();
    const intruder = await connectWorkspace();
    await intruder.send(RENDER);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
    expect(intruder.received).toEqual([]);
    await workspace.send(RENDER);
    expect(screen.getByRole("button", { name: "Buy" })).toBeTruthy();
  });

  it("applies the design system's theme and mode", async () => {
    const { container } = render(<PreviewRuntime />);
    const workspace = await connectWorkspace();
    await workspace.send(RENDER);
    expect(container.querySelector('style[type="text/tailwindcss"]')?.textContent).toBe(
      RENDER.theme,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("outlines the element the workspace highlights", async () => {
    const { container } = render(<PreviewRuntime />);
    const workspace = await connectWorkspace();
    await workspace.send({ type: "highlight", nodeId: "n1" });
    expect(container.querySelector("style")?.textContent).toContain('[data-node-id="n1"]');
  });

  it("reports code that cannot run", async () => {
    render(<PreviewRuntime />);
    const workspace = await connectWorkspace();
    await workspace.send({ ...RENDER, code: "export default function D() { return <p>; }" });
    await flush();
    expect(workspace.received).toContainEqual(expect.objectContaining({ type: "error" }));
  });
});
