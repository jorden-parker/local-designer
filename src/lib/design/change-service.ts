import { z } from "zod";
import { jsonError } from "@/lib/json-error";
import { streamModel, type LlmConfig } from "@/lib/llm/client";
import { addPageVersion, addSystemVersion, readDesign } from "@/lib/store/designs";
import { STREAM_ERROR_MARKER } from "@/lib/stream-protocol";
import type { Design } from "@/lib/types";
import type { StreamText } from "./draft-runner";
import { pageChange } from "./page-change";
import { systemChange } from "./system-change";

export type ChangeDeps = {
  directory: string;
  config: LlmConfig;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
};

const ChangeBody = z.object({
  request: z.string().trim().min(1).max(4000),
  nodeId: z
    .string()
    .regex(/^n\d+$/)
    .nullable(),
  baseVersion: z.number().int().positive().nullable(),
  model: z.string().trim().min(1).max(200),
});

type ChangeInput = z.infer<typeof ChangeBody>;

type Emit = (text: string) => void;

function textStream(run: (emit: Emit) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (text: string) =>
        controller.enqueue(encoder.encode(text.replaceAll(STREAM_ERROR_MARKER, "")));
      run(emit)
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          controller.enqueue(encoder.encode(`${STREAM_ERROR_MARKER}${message}`));
        })
        .finally(() => controller.close());
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

function modelStream(deps: ChangeDeps, model: string): StreamText {
  const client = { config: { ...deps.config, model }, fetchImpl: deps.fetchImpl };
  return (request) => streamModel(client, request, deps.signal);
}

type Loaded = { input: ChangeInput; design: Design } | { failure: Response };

async function loadChange(designId: string, body: unknown, deps: ChangeDeps): Promise<Loaded> {
  const parsed = ChangeBody.safeParse(body);
  if (!parsed.success) return { failure: jsonError("Invalid change request", 400) };
  const design = await readDesign(deps.directory, designId);
  if (!design) return { failure: jsonError("Design not found", 404) };
  return { input: parsed.data, design };
}

function baseVersion<T extends { number: number }>(versions: T[], number: number | null) {
  return number === null ? null : (versions.find((version) => version.number === number) ?? false);
}

export async function systemChangeResponse(
  designId: string,
  body: unknown,
  deps: ChangeDeps,
): Promise<Response> {
  const loaded = await loadChange(designId, body, deps);
  if ("failure" in loaded) return loaded.failure;
  const { input, design } = loaded;
  const base = baseVersion(design.system, input.baseVersion);
  if (base === false) return jsonError("Version not found", 400);
  const nodeId = base ? input.nodeId : null;
  return textStream(async (emit) => {
    const system = await systemChange(
      modelStream(deps, input.model),
      { brief: design.brief, request: input.request, nodeId, base },
      emit,
    );
    await addSystemVersion(deps.directory, designId, {
      ...system,
      request: input.request,
      nodeId,
      model: input.model,
    });
  });
}

export async function pageChangeResponse(
  designId: string,
  pageId: string,
  body: unknown,
  deps: ChangeDeps,
): Promise<Response> {
  const loaded = await loadChange(designId, body, deps);
  if ("failure" in loaded) return loaded.failure;
  const { input, design } = loaded;
  const page = design.pages.find((candidate) => candidate.id === pageId);
  if (!page) return jsonError("Page not found", 404);
  const system = design.system.at(-1);
  if (!system) return jsonError("Create the design system first", 409);
  const base = baseVersion(page.versions, input.baseVersion);
  if (base === false) return jsonError("Version not found", 400);
  const nodeId = base ? input.nodeId : null;
  return textStream(async (emit) => {
    const code = await pageChange(
      modelStream(deps, input.model),
      {
        brief: design.brief,
        request: input.request,
        nodeId,
        baseCode: base ? base.code : null,
        components: system.components,
      },
      emit,
    );
    await addPageVersion(deps.directory, designId, pageId, {
      code,
      request: input.request,
      nodeId,
      model: input.model,
    });
  });
}
