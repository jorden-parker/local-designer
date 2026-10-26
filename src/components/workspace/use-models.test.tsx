import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModels } from "./use-models";

function serveModels(models: string[], defaultModel: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ models, defaultModel })),
  );
}

describe("useModels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to the configured model", async () => {
    serveModels(["granite4.2-3b-cc", "qwen3:8b"], "granite4.2-3b-cc");
    const { result } = renderHook(() => useModels(null));
    await waitFor(() => expect(result.current.model).toBe("granite4.2-3b-cc"));
    expect(result.current.models).toEqual(["granite4.2-3b-cc", "qwen3:8b"]);
  });

  it("keeps the design's own model, even when it is no longer installed", async () => {
    serveModels(["qwen3:8b"], "qwen3:8b");
    const { result } = renderHook(() => useModels("qwen3.8-27b-cc"));
    await waitFor(() => expect(result.current.models).toEqual(["qwen3.8-27b-cc", "qwen3:8b"]));
    expect(result.current.model).toBe("qwen3.8-27b-cc");
  });
});
