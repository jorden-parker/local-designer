import { afterEach, describe, expect, it, vi } from "vitest";
import { STREAM_ERROR_MARKER } from "@/lib/stream-protocol";
import { streamChange } from "./api";

const PAGE = { kind: "page", pageId: "p1" } as const;
const BODY = { request: "a page", nodeId: null, baseVersion: null, model: "m" };

function serveChunks(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function collect(): Promise<string[]> {
  const parts: string[] = [];
  await streamChange("d", PAGE, BODY, (text) => parts.push(text));
  return parts;
}

describe("streamChange", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the change as JSON and passes the streamed text on", async () => {
    const fetchMock = serveChunks(["Hel", "lo"]);
    expect(await collect()).toEqual(["Hel", "lo"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/designs/d/pages/p1/changes",
      expect.objectContaining({ method: "POST", body: JSON.stringify(BODY) }),
    );
  });

  it("posts design system changes to the system route", async () => {
    const fetchMock = serveChunks(["ok"]);
    await streamChange("d", { kind: "system" }, BODY, () => {});
    expect(fetchMock).toHaveBeenCalledWith("/api/designs/d/system", expect.anything());
  });

  it("throws the message that follows the error marker, even across chunks", async () => {
    serveChunks(["partial", `${STREAM_ERROR_MARKER}Model is`, " not installed"]);
    const parts: string[] = [];
    await expect(streamChange("d", PAGE, BODY, (text) => parts.push(text))).rejects.toThrow(
      "Model is not installed",
    );
    expect(parts).toEqual(["partial"]);
  });

  it("throws the server's error for a refused request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Invalid change request" }, { status: 400 })),
    );
    await expect(collect()).rejects.toThrow("Invalid change request");
  });
});
