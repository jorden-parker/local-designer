import { describe, expect, it } from "vitest";
import { llmConfigFromEnv, streamModel } from "./client";

const CONFIG = { baseURL: "http://llm.test", model: "m", timeoutMs: 1000 };

describe("llmConfigFromEnv", () => {
  it("defaults to local Ollama and the 27b claude-ollama model", () => {
    expect(llmConfigFromEnv({})).toMatchObject({
      baseURL: "http://localhost:11434",
      model: "qwen3.8-27b-cc",
    });
  });

  it("reads the model and URL from the environment", () => {
    const env = { LOCAL_DESIGNER_MODEL: "granite4.2-3b-cc", OLLAMA_HOST: "http://o.test" };
    expect(llmConfigFromEnv(env)).toMatchObject({
      baseURL: "http://o.test",
      model: "granite4.2-3b-cc",
    });
  });
});

function sseEvent(type: string, data: object): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
}

function streamingFetch(chunks: string[]) {
  const bodies: unknown[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  };
  return { fetchImpl: fetchImpl as typeof fetch, bodies };
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const parts: string[] = [];
  for await (const part of stream) parts.push(part);
  return parts;
}

const REQUEST = {
  system: "sys",
  maxTokens: 10,
  messages: [{ role: "user" as const, content: "hi" }],
};

describe("streamModel", () => {
  it("yields text deltas, even when events are split across chunks", async () => {
    const events =
      sseEvent("message_start", { message: {} }) +
      sseEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Hel" } }) +
      sseEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text: "lo" } }) +
      sseEvent("message_stop", {});
    const { fetchImpl, bodies } = streamingFetch([events.slice(0, 70), events.slice(70)]);
    const parts = await collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST));
    expect(parts.join("")).toBe("Hello");
    expect(bodies[0]).toMatchObject({ stream: true, system: "sys", max_tokens: 10 });
  });

  it("gives up when the model does not start answering in time", async () => {
    const hanging = (async (_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      )) as unknown as typeof fetch;
    const config = { ...CONFIG, timeoutMs: 20 };
    await expect(collect(streamModel({ config, fetchImpl: hanging }, REQUEST))).rejects.toThrow(
      /timeout|too long/i,
    );
  });

  it("keeps streaming past the timeout once the answer has started", async () => {
    const encoder = new TextEncoder();
    const delta = (text: string) =>
      encoder.encode(sseEvent("content_block_delta", { delta: { type: "text_delta", text } }));
    const slowBody = (async (_url: unknown, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(delta("a"));
          await new Promise((resolve) => setTimeout(resolve, 60));
          if (init?.signal?.aborted) return controller.error(init.signal.reason);
          controller.enqueue(delta("b"));
          controller.close();
        },
      });
      return new Response(body);
    }) as unknown as typeof fetch;
    const config = { ...CONFIG, timeoutMs: 20 };
    const parts = await collect(streamModel({ config, fetchImpl: slowBody }, REQUEST));
    expect(parts.join("")).toBe("ab");
  });

  it("reports a missing model", async () => {
    const fetchImpl = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST))).rejects.toThrow(
      'Model "m" is not installed',
    );
  });

  it("raises an error event from the server", async () => {
    const { fetchImpl } = streamingFetch([sseEvent("error", { error: { message: "overloaded" } })]);
    await expect(collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST))).rejects.toThrow(
      "overloaded",
    );
  });
});
