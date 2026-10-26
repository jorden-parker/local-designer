import { describe, expect, it } from "vitest";
import { fakeModel, fenced } from "@/test/fake-model";
import { annotate } from "./annotate";
import { STARTER_COMPONENTS } from "./starter-components";
import { COMPONENTS_HEADING, STARTER_NOTICE, systemChange, TOKENS_HEADING } from "./system-change";
import { DEFAULT_TOKENS } from "./tokens";

const COMPONENTS =
  'export function Button({ className = "", ...props }) { return <button className={`bg-primary ${className}`} {...props} />; }\nexport function Showcase() { return <section><Button>Go</Button></section>; }';
const TOKENS_REPLY = JSON.stringify(DEFAULT_TOKENS);

describe("systemChange", () => {
  it("chooses tokens and then writes the components", async () => {
    const { stream, requests } = fakeModel([TOKENS_REPLY, fenced(COMPONENTS)]);
    const streamed: string[] = [];
    const system = await systemChange(
      stream,
      { brief: "a shop", request: "Design system", nodeId: null, base: null },
      (text) => streamed.push(text),
    );
    expect(system).toEqual({ tokens: DEFAULT_TOKENS, components: annotate(COMPONENTS) });
    expect(streamed[0]).toBe(TOKENS_HEADING);
    expect(streamed).toContain(COMPONENTS_HEADING);
    expect(requests[1].messages[0].content).toContain("a shop");
    expect(requests[1].messages[0].content).toContain("export function ImagePlaceholder");
  });

  it("keeps the starter components when the model cannot adapt them", async () => {
    const { stream } = fakeModel([TOKENS_REPLY, "<div>", "<div>"]);
    const streamed: string[] = [];
    const system = await systemChange(
      stream,
      { brief: "a shop", request: "Design system", nodeId: null, base: null },
      (text) => streamed.push(text),
    );
    expect(system.components).toBe(annotate(STARTER_COMPONENTS));
    expect(streamed).toContain(STARTER_NOTICE);
  });

  it("fails a whole-system change whose components do not work", async () => {
    const base = { tokens: DEFAULT_TOKENS, components: annotate(COMPONENTS) };
    const { stream } = fakeModel([TOKENS_REPLY, "<div>", "<div>"]);
    await expect(
      systemChange(stream, { brief: "a shop", request: "x", nodeId: null, base }, () => {}),
    ).rejects.toThrow("still had problems");
  });

  it("asks for a token repair when the JSON is invalid", async () => {
    const { stream, requests } = fakeModel(["not json", TOKENS_REPLY, fenced(COMPONENTS)]);
    const system = await systemChange(
      stream,
      { brief: "a shop", request: "Design system", nodeId: null, base: null },
      () => {},
    );
    expect(system.tokens).toEqual(DEFAULT_TOKENS);
    expect(requests[1].messages.at(-1)?.content).toContain("No JSON object in reply");
  });

  it("changes the current tokens and components for a whole-system request", async () => {
    const base = { tokens: DEFAULT_TOKENS, components: annotate(COMPONENTS) };
    const { stream, requests } = fakeModel([TOKENS_REPLY, fenced(COMPONENTS)]);
    await systemChange(
      stream,
      { brief: "a shop", request: "rounder", nodeId: null, base },
      () => {},
    );
    expect(requests[0].messages[0].content).toContain('"primary-foreground"');
    expect(requests[1].messages[0].content).toContain("rounder");
    expect(requests[1].messages[0].content).not.toContain("data-node-id");
  });

  it("edits one element of the components and keeps the tokens", async () => {
    const base = { tokens: DEFAULT_TOKENS, components: annotate(COMPONENTS) };
    const { stream, requests } = fakeModel([
      fenced('<section className="p-8"><Button>Go</Button></section>'),
    ]);
    const system = await systemChange(
      stream,
      { brief: "a shop", request: "more padding", nodeId: "n2", base },
      () => {},
    );
    expect(system.tokens).toBe(DEFAULT_TOKENS);
    expect(system.components).toContain('<section data-node-id="n2" className="p-8">');
    expect(requests).toHaveLength(1);
  });
});
