"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadDesign } from "@/lib/design/load-design";
import { isToPreview, type FromPreviewMessage, type RenderMessage } from "@/lib/preview-protocol";
import { highlightCss } from "./highlight-css";
import { RenderBoundary } from "./render-boundary";
import { usePointerSelection } from "./use-pointer-selection";

const ANY_ORIGIN = "*";

function useWorkspacePort(): MessagePort | null {
  const [port, setPort] = useState<MessagePort | null>(null);

  useEffect(() => {
    const accept = (event: MessageEvent) => {
      if (event.source !== window.parent || !isToPreview(event.data)) return;
      const [offered] = event.ports;
      if (event.data.type === "connect" && offered) setPort((current) => current ?? offered);
    };
    window.addEventListener("message", accept);
    window.parent.postMessage({ type: "ready" } satisfies FromPreviewMessage, ANY_ORIGIN);
    return () => window.removeEventListener("message", accept);
  }, []);

  return port;
}

export function PreviewRuntime() {
  const port = useWorkspacePort();
  const [design, setDesign] = useState<RenderMessage | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loaded = useMemo(() => (design === null ? null : loadDesign(design)), [design]);

  const postToWorkspace = useCallback(
    (message: FromPreviewMessage) => port?.postMessage(message),
    [port],
  );
  const reportError = useCallback(
    (message: string) => postToWorkspace({ type: "error", message }),
    [postToWorkspace],
  );

  useEffect(() => {
    import("@tailwindcss/browser");
  }, []);

  useEffect(() => {
    if (!port) return;
    const receive = (event: MessageEvent) => {
      if (!isToPreview(event.data)) return;
      if (event.data.type === "render") setDesign(event.data);
      if (event.data.type === "highlight") setSelectedId(event.data.nodeId);
    };
    port.addEventListener("message", receive);
    port.start();
    port.postMessage({ type: "ready" } satisfies FromPreviewMessage);
    return () => port.removeEventListener("message", receive);
  }, [port]);

  useEffect(() => {
    if (design) document.documentElement.dataset.theme = design.mode;
  }, [design]);

  useEffect(() => {
    if (loaded && !loaded.ok) reportError(loaded.error);
  }, [loaded, reportError]);

  const select = useCallback(
    (nodeId: string | null) => {
      setSelectedId(nodeId);
      postToWorkspace({ type: "select", nodeId });
    },
    [postToWorkspace],
  );
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
