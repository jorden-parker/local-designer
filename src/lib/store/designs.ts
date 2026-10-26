import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type {
  Design,
  DesignSummary,
  Page,
  PageVersionInput,
  SystemVersionInput,
  Target,
} from "@/lib/types";

const DesignId = z.uuid();
const CurrentShape = z.object({ system: z.array(z.unknown()), pages: z.array(z.unknown()) });
const TITLE_LENGTH = 60;

function designPath(directory: string, id: string): string | null {
  return DesignId.safeParse(id).success ? path.join(directory, `${id}.json`) : null;
}

async function writeDesign(directory: string, design: Design): Promise<Design> {
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${design.id}.json`);
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(design, null, 2));
  await rename(temporary, file);
  return design;
}

function titleFrom(prompt: string): string {
  return (prompt.trim().split("\n")[0] ?? "").slice(0, TITLE_LENGTH).trim() || "Untitled";
}

function nextNumber(versions: unknown[]): { number: number; createdAt: string } {
  return { number: versions.length + 1, createdAt: new Date().toISOString() };
}

export async function createDesign(directory: string, brief: string): Promise<Design> {
  return writeDesign(directory, {
    id: crypto.randomUUID(),
    title: titleFrom(brief),
    brief: brief.trim(),
    createdAt: new Date().toISOString(),
    system: [],
    pages: [],
  });
}

export async function readDesign(directory: string, id: string): Promise<Design | null> {
  const file = designPath(directory, id);
  if (!file) return null;
  const text = await readFile(file, "utf8").catch(() => null);
  if (!text) return null;
  const design = JSON.parse(text) as unknown;
  return CurrentShape.safeParse(design).success ? (design as Design) : null;
}

async function existingDesign(directory: string, id: string): Promise<Design> {
  const design = await readDesign(directory, id);
  if (!design) throw new Error(`Design ${id} was not found`);
  return design;
}

function existingPage(design: Design, pageId: string): Page {
  const page = design.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`Page ${pageId} was not found`);
  return page;
}

export async function addSystemVersion(
  directory: string,
  id: string,
  input: SystemVersionInput,
): Promise<Design> {
  const design = await existingDesign(directory, id);
  const version = { ...input, ...nextNumber(design.system) };
  return writeDesign(directory, { ...design, system: [...design.system, version] });
}

export async function addPage(
  directory: string,
  id: string,
  prompt: string,
): Promise<{ design: Design; pageId: string }> {
  const design = await existingDesign(directory, id);
  const pageId = `p${design.pages.length + 1}`;
  const page = { id: pageId, name: titleFrom(prompt), prompt: prompt.trim(), versions: [] };
  return {
    design: await writeDesign(directory, { ...design, pages: [...design.pages, page] }),
    pageId,
  };
}

export async function addPageVersion(
  directory: string,
  id: string,
  pageId: string,
  input: PageVersionInput,
): Promise<Design> {
  const design = await existingDesign(directory, id);
  const page = existingPage(design, pageId);
  const updated = {
    ...page,
    versions: [...page.versions, { ...input, ...nextNumber(page.versions) }],
  };
  return writeDesign(directory, {
    ...design,
    pages: design.pages.map((candidate) => (candidate.id === pageId ? updated : candidate)),
  });
}

function findVersion<T extends { number: number }>(versions: T[], number: number): T {
  const version = versions.find((candidate) => candidate.number === number);
  if (!version) throw new Error(`Version ${number} was not found`);
  return version;
}

export async function restoreVersion(
  directory: string,
  id: string,
  target: Target,
  number: number,
): Promise<Design> {
  const design = await existingDesign(directory, id);
  const restored = { request: `Restored version ${number}`, nodeId: null };
  if (target.kind === "system") {
    const { tokens, components, model } = findVersion(design.system, number);
    return addSystemVersion(directory, id, { tokens, components, model, ...restored });
  }
  const { code, model } = findVersion(existingPage(design, target.pageId).versions, number);
  return addPageVersion(directory, id, target.pageId, { code, model, ...restored });
}

function updatedAt(design: Design): string {
  const times = [
    design.createdAt,
    ...design.system.map((version) => version.createdAt),
    ...design.pages.flatMap((page) => page.versions.map((version) => version.createdAt)),
  ];
  return times.reduce((latest, time) => (time > latest ? time : latest));
}

function summaryOf(design: Design): DesignSummary {
  return {
    id: design.id,
    title: design.title,
    updatedAt: updatedAt(design),
    pageCount: design.pages.length,
  };
}

export async function listDesigns(directory: string): Promise<DesignSummary[]> {
  const files = await readdir(directory).catch(() => []);
  const ids = files.filter((file) => file.endsWith(".json")).map((file) => file.slice(0, -5));
  const designs = await Promise.all(ids.map((id) => readDesign(directory, id)));
  return designs
    .filter((design): design is Design => design !== null)
    .map(summaryOf)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
