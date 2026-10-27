import { useCallback, useEffect, useRef } from "react";
import { addPage, fetchDesign, restoreVersion } from "@/components/api";
import type { Design, Target } from "@/lib/types";
import { SYSTEM_TARGET } from "./target-view";
import { useChangeRunner } from "./use-change-runner";
import { useModels } from "./use-models";
import { useTargetView } from "./use-target-view";

const SYSTEM_REQUEST = "Design system";
const FIX_REQUEST = "Fix this error: ";
const FIX_MESSAGE_LIMIT = 200;

function fixRequest(message: string): string {
  const firstLine = message.split("\n", 1)[0];
  return `${FIX_REQUEST}${firstLine.slice(0, FIX_MESSAGE_LIMIT)}`;
}

function useFirstDrafts(
  design: Design,
  ready: boolean,
  draftSystem: () => void,
  createPage: (prompt: string) => void,
) {
  const started = useRef({ system: false, page: false });
  useEffect(() => {
    if (!ready) return;
    if (design.system.length === 0 && !started.current.system) {
      started.current.system = true;
      draftSystem();
    } else if (design.system.length > 0 && design.pages.length === 0 && !started.current.page) {
      started.current.page = true;
      createPage(design.brief);
    }
  }, [design, ready, draftSystem, createPage]);
}

export function useWorkspace(initialDesign: Design) {
  const state = useTargetView(initialDesign);
  const { design, showDesign, target, showTarget, view } = state;
  const { models, model, setModel } = useModels(view.latest?.model ?? null);

  const justDrafted = useRef(false);
  const reload = useCallback(async () => {
    showDesign(await fetchDesign(design.id));
    justDrafted.current = true;
  }, [design.id, showDesign]);
  const { run, start, stop } = useChangeRunner(design.id, reload);

  const draft = useCallback(
    (on: Target, request: string) => {
      if (model) start(on, { request, nodeId: null, baseVersion: null, model });
    },
    [model, start],
  );

  const requestChange = useCallback(
    (request: string, nodeId: string | null) => {
      if (!model) return;
      start(target, { request, nodeId, baseVersion: view.viewed?.number ?? null, model });
    },
    [model, start, target, view.viewed?.number],
  );

  const reportRenderError = useCallback(
    (message: string) => {
      const latest = view.latest;
      const viewingLatest = latest !== null && view.viewed?.number === latest.number;
      if (run.status !== "idle" || !justDrafted.current || !viewingLatest) return;
      justDrafted.current = false;
      if (latest.request.startsWith(FIX_REQUEST)) return;
      requestChange(fixRequest(message), null);
    },
    [view.latest, view.viewed?.number, run.status, requestChange],
  );

  const createPage = useCallback(
    async (prompt: string) => {
      const created = await addPage(design.id, prompt);
      showDesign(created.design);
      const page: Target = { kind: "page", pageId: created.pageId };
      showTarget(page);
      draft(page, prompt);
    },
    [design.id, draft, showDesign, showTarget],
  );

  const draftSystem = useCallback(() => draft(SYSTEM_TARGET, SYSTEM_REQUEST), [draft]);
  useFirstDrafts(design, model !== null && run.status === "idle", draftSystem, createPage);

  const restore = useCallback(
    async (number: number) => showDesign(await restoreVersion(design.id, target, number)),
    [design.id, target, showDesign],
  );

  return {
    ...state,
    models,
    model,
    setModel,
    run,
    stop,
    requestChange,
    reportRenderError,
    createPage,
    restore,
  };
}
