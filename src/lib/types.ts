import type { Tokens } from "@/lib/design/tokens";

type VersionMeta = {
  number: number;
  request: string;
  nodeId: string | null;
  model: string;
  createdAt: string;
};

export type PageVersion = VersionMeta & { code: string };

export type SystemVersion = VersionMeta & { tokens: Tokens; components: string };

export type Page = { id: string; name: string; prompt: string; versions: PageVersion[] };

export type Design = {
  id: string;
  title: string;
  brief: string;
  createdAt: string;
  system: SystemVersion[];
  pages: Page[];
};

export type DesignSummary = { id: string; title: string; updatedAt: string; pageCount: number };

export type Target = { kind: "system" } | { kind: "page"; pageId: string };

export type PageVersionInput = Omit<PageVersion, "number" | "createdAt">;

export type SystemVersionInput = Omit<SystemVersion, "number" | "createdAt">;
