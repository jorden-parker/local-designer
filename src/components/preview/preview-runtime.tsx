"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadDesign } from "@/lib/design/load-design";
import { isToPreview, type FromPreviewMessage, type RenderMessage } from "@/lib/preview-protocol";
import { highlightCss } from "./highlight-css";
import { RenderBoundary } from "./render-boundary";
import { usePointerSelection } from "./use-pointer-selection";

const ANY_ORIGIN = "*";

function postToWorkspace(message: FromPreviewMessage) {
  window.parent.postMessage(message, ANY_ORIGIN);
}

const reportError = (message: string) => postToWorkspace({ type: "error", message });

export function PreviewRuntime() {
  const [design, setDesign] = useState<RenderMessage | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loaded = useMemo(() => (design === null ? null : loadDesign(design)), [design]);

  useEffect(() => {
    import("@tailwindcss/browser");
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!isToPreview(event.data)) return;
      if (event.data.type === "render") setDesign(event.data);
      if (event.data.type === "highlight") setSelectedId(event.data.nodeId);
      if (event.data.type === "connect") postToWorkspace({ type: "ready" });
    };
    window.addEventListener("message", receive);
    postToWorkspace({ type: "ready" });
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    if (design) document.documentElement.dataset.theme = design.mode;
  }, [design]);

  useEffect(() => {
    if (loaded && !loaded.ok) reportError(loaded.error);
  }, [loaded]);

  const select = useCallback((nodeId: string | null) => {
    setSelectedId(nodeId);
    postToWorkspace({ type: "select", nodeId });
  }, []);
  usePointerSelection(setHoveredId, select);

  return (
    <>
      <style>{highlightCss(hoveredId, selectedId)}</style>
      {design && <style type="text/tailwindcss">{design.theme}</style>}
      {loaded?.ok && (
        <RenderBoundary key={`${design?.components}${design?.code}`} onError={reportError}>
          <loaded.component />
        </RenderBoundary>
      )}
    </>
  );
}
