import type { Design, Target } from "@/lib/types";
import { STREAM_ERROR_MARKER } from "@/lib/stream-protocol";

export type ModelList = { models: string[]; defaultModel: string };

export type ChangeBody = {
  request: string;
  nodeId: string | null;
  baseVersion: number | null;
  model: string;
};

async function failure(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `Request failed (HTTP ${response.status})`);
}

async function postJson(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await failure(response);
  return response;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw await failure(response);
  return (await response.json()) as T;
}

export async function createDesign(prompt: string): Promise<string> {
  const response = await postJson("/api/designs", { prompt });
  return ((await response.json()) as { id: string }).id;
}

export function fetchDesign(id: string): Promise<Design> {
  return getJson<Design>(`/api/designs/${id}`);
}

export function fetchModels(): Promise<ModelList> {
  return getJson<ModelList>("/api/models");
}

export async function addPage(
  id: string,
  prompt: string,
): Promise<{ design: Design; pageId: string }> {
  return (await postJson(`/api/designs/${id}/pages`, { prompt })).json();
}

export async function restoreVersion(id: string, target: Target, version: number): Promise<Design> {
  return (await postJson(`/api/designs/${id}/restore`, { target, version })).json();
}

export async function fetchHandoffPrompt(id: string): Promise<string> {
  const response = await fetch(`/api/designs/${id}/handoff?format=prompt`);
  if (!response.ok) throw await failure(response);
  return response.text();
}

export function handoffZipUrl(id: string): string {
  return `/api/designs/${id}/handoff`;
}

function changeUrl(id: string, target: Target): string {
  return target.kind === "system"
    ? `/api/designs/${id}/system`
    : `/api/designs/${id}/pages/${target.pageId}/changes`;
}

export async function streamChange(
  id: string,
  target: Target,
  body: ChangeBody,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await postJson(changeUrl(id, target), body, signal);
  if (!response.body) return;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let failed: string | null = null;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    const text = decoder.decode(read.value, { stream: true });
    if (failed !== null) {
      failed += text;
      continue;
    }
    const [before, ...after] = text.split(STREAM_ERROR_MARKER);
    if (before) onText(before);
    if (after.length > 0) failed = after.join("");
  }
  if (failed !== null) throw new Error(failed);
}
