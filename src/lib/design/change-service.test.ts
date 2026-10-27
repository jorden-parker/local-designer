import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fenced } from "@/test/fake-model";
import { addPage, addSystemVersion, createDesign, readDesign } from "@/lib/store/designs";
import { STREAM_ERROR_MARKER } from "@/lib/stream-protocol";
import { pageChangeResponse, systemChangeResponse } from "./change-service";
import { DEFAULT_TOKENS } from "./tokens";

const COMPONENTS =
  'export function Button({ className = "", ...props }) { return <button className={`bg-primary ${className}`} {...props} />; }\nexport function Showcase() { return <Button>Go</Button>; }';
const PAGE = "export default function Page() {\n  return <main><Button>Hi</Button></main>;\n}";
const CONFIG = { baseURL: "http://llm.test", model: "default-model", timeoutMs: 1000 };

function sse(text: string): string {
  const delta = { type: "content_block_delta", delta: { type: "text_delta", text } };
  return `event: content_block_delta\ndata: ${JSON.stringify(delta)}\n\n`;
}

function modelReplying(...replies: string[]) {
  const models: string[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    models.push(JSON.parse(String(init?.body)).model);
    return new Response(sse(replies[models.length - 1] ?? ""));
  }) as typeof fetch;
  return { fetchImpl, models };
}

function modelSeeing(reply: string) {
  const bodies: { messages: { content: string }[] }[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(sse(reply));
  }) as typeof fetch;
  return { fetchImpl, bodies };
}

const body = { request: "Design system", nodeId: null, baseVersion: null, model: "granite" };

describe("change service", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "changes-"));
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  async function designWithSystem() {
    const { id } = await createDesign(directory, "a shop");
    await addSystemVersion(directory, id, {
      tokens: DEFAULT_TOKENS,
      components: COMPONENTS,
      request: "Design system",
      nodeId: null,
      model: "m",
    });
    const { pageId } = await addPage(directory, id, "pricing");
    return { id, pageId };
  }

  it("streams a new design system and saves it with the chosen model", async () => {
    const { id } = await createDesign(directory, "a shop");
    const { fetchImpl, models } = modelReplying(JSON.stringify(DEFAULT_TOKENS), fenced(COMPONENTS));
    const response = await systemChangeResponse(id, body, { directory, config: CONFIG, fetchImpl });
    expect(await response.text()).toContain("export function Showcase()");
    expect(models).toEqual(["granite", "granite"]);
    const design = await readDesign(directory, id);
    expect(design?.system[0]).toMatchObject({
      number: 1,
      tokens: DEFAULT_TOKENS,
      model: "granite",
    });
    expect(design?.system[0].components).toContain('data-node-id="n1"');
  });

  it("names the design's other pages when drafting a page", async () => {
    const { id, pageId } = await designWithSystem();
    await addPage(directory, id, "checkout");
    const { fetchImpl, bodies } = modelSeeing(fenced(PAGE));
    await pageChangeResponse(id, pageId, body, { directory, config: CONFIG, fetchImpl }).then(
      (response) => response.text(),
    );
    expect(bodies[0].messages[0].content).toContain('Other pages: "checkout".');
    expect(bodies[0].messages[0].content).not.toContain("pricing");
  });

  it("drafts a page from the latest design system", async () => {
    const { id, pageId } = await designWithSystem();
    const { fetchImpl } = modelReplying(fenced(PAGE));
    const change = { ...body, request: "pricing" };
    const response = await pageChangeResponse(id, pageId, change, {
      directory,
      config: CONFIG,
      fetchImpl,
    });
    await response.text();
    const page = (await readDesign(directory, id))?.pages[0];
    expect(page?.versions[0]).toMatchObject({ number: 1, request: "pricing" });
    expect(page?.versions[0].code).toContain('<Button data-node-id="n2">Hi</Button>');
  });

  it("ends the stream with the error marker when the change fails", async () => {
    const { id, pageId } = await designWithSystem();
    const { fetchImpl } = modelReplying("<div>", "<div>");
    const deps = { directory, config: CONFIG, fetchImpl };
    const text = await (await pageChangeResponse(id, pageId, body, deps)).text();
    expect(text).toContain(`${STREAM_ERROR_MARKER}The model's reply still had problems`);
    expect((await readDesign(directory, id))?.pages[0].versions).toEqual([]);
  });

  it("refuses a page before the design system exists", async () => {
    const { id } = await createDesign(directory, "a shop");
    const { pageId } = await addPage(directory, id, "pricing");
    const deps = { directory, config: CONFIG, fetchImpl: modelReplying().fetchImpl };
    expect((await pageChangeResponse(id, pageId, body, deps)).status).toBe(409);
  });

  it("rejects bad bodies and unknown designs, pages and base versions", async () => {
    const { id, pageId } = await designWithSystem();
    const deps = { directory, config: CONFIG, fetchImpl: modelReplying().fetchImpl };
    expect((await systemChangeResponse(id, { ...body, request: " " }, deps)).status).toBe(400);
    expect((await systemChangeResponse(id, { ...body, nodeId: "../x" }, deps)).status).toBe(400);
    expect((await systemChangeResponse(crypto.randomUUID(), body, deps)).status).toBe(404);
    expect((await systemChangeResponse(id, { ...body, baseVersion: 3 }, deps)).status).toBe(400);
    expect((await pageChangeResponse(id, "p9", body, deps)).status).toBe(404);
    expect((await pageChangeResponse(id, pageId, { ...body, baseVersion: 1 }, deps)).status).toBe(
      400,
    );
  });
});
