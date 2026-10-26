import { stripIds } from "@/lib/design/annotate";
import { themeCss, type Tokens } from "@/lib/design/tokens";
import type { RenderMessage, ThemeMode } from "@/lib/preview-protocol";
import type { Design, Target } from "@/lib/types";

export type VersionSummary = {
  number: number;
  request: string;
  nodeId: string | null;
  model: string;
};

export type TargetView = {
  versions: VersionSummary[];
  latest: VersionSummary | null;
  viewed: VersionSummary | null;
  code: string | null;
  tokens: Tokens | null;
  render: RenderMessage | null;
};

export const SYSTEM_TARGET: Target = { kind: "system" };

function pick<T extends VersionSummary>(versions: T[], viewedNumber: number | null) {
  const latest = versions.at(-1) ?? null;
  const viewed = versions.find((version) => version.number === viewedNumber) ?? latest;
  return { versions, latest, viewed };
}

function systemView(design: Design, viewedNumber: number | null, mode: ThemeMode): TargetView {
  const picked = pick(design.system, viewedNumber);
  const viewed = picked.viewed;
  return {
    ...picked,
    code: viewed?.components ?? null,
    tokens: viewed?.tokens ?? null,
    render: viewed && {
      type: "render",
      code: viewed.components,
      entry: "Showcase",
      components: null,
      theme: themeCss(viewed.tokens),
      mode,
    },
  };
}

function pageView(
  design: Design,
  pageId: string,
  viewedNumber: number | null,
  mode: ThemeMode,
): TargetView {
  const page = design.pages.find((candidate) => candidate.id === pageId);
  const picked = pick(page?.versions ?? [], viewedNumber);
  const viewed = picked.viewed;
  const system = design.system.at(-1);
  return {
    ...picked,
    code: viewed?.code ?? null,
    tokens: null,
    render:
      viewed && system
        ? {
            type: "render",
            code: viewed.code,
            entry: "default",
            components: stripIds(system.components),
            theme: themeCss(system.tokens),
            mode,
          }
        : null,
  };
}

export function targetView(
  design: Design,
  target: Target,
  viewedNumber: number | null,
  mode: ThemeMode,
): TargetView {
  return target.kind === "system"
    ? systemView(design, viewedNumber, mode)
    : pageView(design, target.pageId, viewedNumber, mode);
}

export function initialTarget(design: Design): Target {
  const first = design.pages[0];
  return design.system.length > 0 && first ? { kind: "page", pageId: first.id } : SYSTEM_TARGET;
}
