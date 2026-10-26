import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_TOKENS } from "@/lib/design/tokens";
import {
  addPage,
  addPageVersion,
  addSystemVersion,
  createDesign,
  listDesigns,
  readDesign,
  restoreVersion,
} from "./designs";

const PAGE_DRAFT = {
  code: "export default function A() {}",
  request: "home",
  nodeId: null,
  model: "m",
};
const SYSTEM_DRAFT = {
  tokens: DEFAULT_TOKENS,
  components: "c1",
  request: "brief",
  nodeId: null,
  model: "m",
};

describe("design store", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "designs-"));
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it("creates a design titled from its brief and reads it back", async () => {
    const design = await createDesign(directory, "A pricing page with three tiers\nand a FAQ");
    expect(design).toMatchObject({
      title: "A pricing page with three tiers",
      brief: "A pricing page with three tiers\nand a FAQ",
      system: [],
      pages: [],
    });
    expect(await readDesign(directory, design.id)).toEqual(design);
  });

  it("cuts a long title without a trailing space", async () => {
    const design = await createDesign(
      directory,
      "A plant shop: product listing page with filters and product cards",
    );
    expect(design.title).toBe("A plant shop: product listing page with filters and product");
  });

  it("versions the design system", async () => {
    const { id } = await createDesign(directory, "app");
    await addSystemVersion(directory, id, SYSTEM_DRAFT);
    const design = await addSystemVersion(directory, id, { ...SYSTEM_DRAFT, components: "c2" });
    expect(design.system.map((version) => [version.number, version.components])).toEqual([
      [1, "c1"],
      [2, "c2"],
    ]);
  });

  it("adds pages named from their prompt and versions each one", async () => {
    const { id } = await createDesign(directory, "app");
    const first = await addPage(directory, id, "Pricing page with tiers");
    const second = await addPage(directory, id, "Settings");
    await addPageVersion(directory, id, first.pageId, PAGE_DRAFT);
    const design = await addPageVersion(directory, id, first.pageId, {
      ...PAGE_DRAFT,
      nodeId: "n2",
    });
    expect(design.pages.map((page) => [page.id, page.name, page.versions.length])).toEqual([
      [first.pageId, "Pricing page with tiers", 2],
      [second.pageId, "Settings", 0],
    ]);
    expect(first.pageId).not.toBe(second.pageId);
  });

  it("restores an old system or page version as a new one", async () => {
    const { id } = await createDesign(directory, "app");
    await addSystemVersion(directory, id, SYSTEM_DRAFT);
    await addSystemVersion(directory, id, { ...SYSTEM_DRAFT, components: "c2" });
    const restoredSystem = await restoreVersion(directory, id, { kind: "system" }, 1);
    expect(restoredSystem.system[2]).toMatchObject({
      components: "c1",
      request: "Restored version 1",
    });
    const { pageId } = await addPage(directory, id, "home");
    await addPageVersion(directory, id, pageId, PAGE_DRAFT);
    await addPageVersion(directory, id, pageId, { ...PAGE_DRAFT, code: "changed" });
    const restoredPage = await restoreVersion(directory, id, { kind: "page", pageId }, 1);
    expect(restoredPage.pages[0].versions[2]).toMatchObject({
      code: PAGE_DRAFT.code,
      nodeId: null,
    });
  });

  it("refuses unknown ids, pages and versions", async () => {
    const { id } = await createDesign(directory, "app");
    expect(await readDesign(directory, "../../etc/passwd")).toBeNull();
    expect(await readDesign(directory, crypto.randomUUID())).toBeNull();
    await expect(addPageVersion(directory, id, "p9", PAGE_DRAFT)).rejects.toThrow(
      "Page p9 was not found",
    );
    await expect(restoreVersion(directory, id, { kind: "system" }, 4)).rejects.toThrow(
      "Version 4 was not found",
    );
    await expect(restoreVersion(directory, "nope", { kind: "system" }, 1)).rejects.toThrow(
      "Design nope was not found",
    );
  });

  it("lists designs, most recently changed first, and skips files in an older format", async () => {
    const older = await createDesign(directory, "older");
    await createDesign(directory, "newer");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await addSystemVersion(directory, older.id, SYSTEM_DRAFT);
    await addPage(directory, older.id, "home");
    fs.writeFileSync(
      path.join(directory, `${crypto.randomUUID()}.json`),
      JSON.stringify({ versions: [] }),
    );
    const summaries = await listDesigns(directory);
    expect(summaries.map((summary) => [summary.title, summary.pageCount])).toEqual([
      ["older", 1],
      ["newer", 0],
    ]);
  });

  it("lists nothing when the directory does not exist yet", async () => {
    expect(await listDesigns(path.join(directory, "missing"))).toEqual([]);
  });
});
