import { describe, expect, it } from "vitest";
import { fakeModel } from "@/test/fake-model";
import { REPAIR_NOTICE, runDraft, type Draft } from "./draft-runner";

const CLEAN = { errors: [], warnings: [] };

function numberDraft(): Draft<number> {
  return {
    request: { system: "s", maxTokens: 10, messages: [{ role: "user", content: "go" }] },
    check: (reply) => {
      if (reply === "bad") throw new Error("not a number");
      if (reply === "warn") return { value: 1, review: { errors: [], warnings: ["too plain"] } };
      if (reply === "error") return { value: 2, review: { errors: ["wrong"], warnings: [] } };
      return { value: Number(reply), review: CLEAN };
    },
    repair: (problems) => ({ role: "user", content: problems.join("|") }),
  };
}

describe("runDraft", () => {
  it("returns a clean first reply and streams it", async () => {
    const { stream } = fakeModel(["123456"]);
    const streamed: string[] = [];
    await expect(runDraft(stream, numberDraft(), (text) => streamed.push(text))).resolves.toBe(
      123456,
    );
    expect(streamed.join("")).toBe("123456");
  });

  it("asks once for a repair with every problem", async () => {
    const { stream, requests } = fakeModel(["bad", "7"]);
    const streamed: string[] = [];
    await expect(runDraft(stream, numberDraft(), (text) => streamed.push(text))).resolves.toBe(7);
    expect(streamed).toContain(REPAIR_NOTICE);
    expect(requests[1].messages.map((message) => message.content)).toEqual([
      "go",
      "bad",
      "not a number",
    ]);
  });

  it("asks to fix warnings and accepts a repair that only has warnings", async () => {
    const { stream, requests } = fakeModel(["warn", "warn"]);
    await expect(runDraft(stream, numberDraft(), () => {})).resolves.toBe(1);
    expect(requests).toHaveLength(2);
  });

  it("falls back to a first reply that only had warnings", async () => {
    const { stream } = fakeModel(["warn", "error"]);
    await expect(runDraft(stream, numberDraft(), () => {})).resolves.toBe(1);
  });

  it("gives up when neither reply is usable", async () => {
    const { stream } = fakeModel(["bad", "error"]);
    await expect(runDraft(stream, numberDraft(), () => {})).rejects.toThrow(
      "The model's reply still had problems: wrong",
    );
  });
});
