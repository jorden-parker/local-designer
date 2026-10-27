"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { isFromPreview, type RenderMessage, type ToPreviewMessage } from "@/lib/preview-protocol";
import { VIEWPORTS, type ViewportId } from "./viewport";

type Props = {
  design: RenderMessage | null;
  viewport: ViewportId;
  selectedNodeId: string | null;
  running: boolean;
  onSelect: (nodeId: string | null) => void;
  onFixError: (message: string) => void;
  onRenderError: (message: string) => void;
};

const OPAQUE_FRAME_ORIGIN = "*";
export const NAVIGATION_BLOCKED =
  "The design tried to open another page in the preview, so the preview was reset.";

function isReady(data: unknown): boolean {
  return isFromPreview(data) && data.type === "ready";
}

function offerChannel(frame: HTMLIFrameElement | null, onReady: (port: MessagePort) => void) {
  const channel = new MessageChannel();
  channel.port1.onmessage = (event) => {
    if (isReady(event.data)) onReady(channel.port1);
  };
  frame?.contentWindow?.postMessage(
    { type: "connect" } satisfies ToPreviewMessage,
    OPAQUE_FRAME_ORIGIN,
    [channel.port2],
  );
}

function subscribeToNothing() {
  return () => {};
}

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

function usePreviewPort() {
  const frame = useRef<HTMLIFrameElement>(null);
  const loads = useRef(0);
  const [port, setPort] = useState<MessagePort | null>(null);
  const [generation, setGeneration] = useState(0);

  const replaceFrame = useCallback(() => {
    loads.current = 0;
    setPort(null);
    setGeneration((current) => current + 1);
  }, []);

  const isNavigationLoad = useCallback(() => {
    loads.current += 1;
    return loads.current > 1;
  }, []);

  useEffect(() => {
    let connected = false;
    const connect = (accepted: MessagePort) => {
      if (connected) return;
      connected = true;
      setPort(accepted);
    };
    const announce = (event: MessageEvent) => {
      if (connected || event.source !== frame.current?.contentWindow) return;
      if (isReady(event.data)) offerChannel(frame.current, connect);
    };
    window.addEventListener("message", announce);
    offerChannel(frame.current, connect);
    return () => window.removeEventListener("message", announce);
  }, [generation]);

  return { frame, port, generation, replaceFrame, isNavigationLoad };
}

function usePreviewFrame(
  design: RenderMessage | null,
  selectedNodeId: string | null,
  onSelect: Props["onSelect"],
  onRenderError: Props["onRenderError"],
) {
  const { frame, port, generation, replaceFrame, isNavigationLoad } = usePreviewPort();
  const [error, setError] = useState<{ design: RenderMessage | null; message: string } | null>(
    null,
  );
  const [blocked, setBlocked] = useState<RenderMessage | null>(null);

  const onFrameLoad = () => {
    if (!isNavigationLoad()) return;
    setBlocked(design);
    setError({ design, message: NAVIGATION_BLOCKED });
    onRenderError(NAVIGATION_BLOCKED);
    replaceFrame();
  };

  useEffect(() => {
    if (!port) return;
    const receive = (event: MessageEvent) => {
      if (!isFromPreview(event.data)) return;
      if (event.data.type === "select") onSelect(event.data.nodeId);
      if (event.data.type === "error") {
        setError({ design, message: event.data.message });
        onRenderError(event.data.message);
      }
    };
    port.addEventListener("message", receive);
    return () => port.removeEventListener("message", receive);
  }, [port, design, onSelect, onRenderError]);

  useEffect(() => {
    if (design !== null && design !== blocked) port?.postMessage(design);
  }, [port, design, blocked]);

  useEffect(() => {
    port?.postMessage({ type: "highlight", nodeId: selectedNodeId } satisfies ToPreviewMessage);
  }, [port, selectedNodeId]);

  return {
    frame,
    generation,
    onFrameLoad,
    error: error?.design === design ? error.message : null,
  };
}

export function Canvas({
  design,
  viewport,
  selectedNodeId,
  running,
  onSelect,
  onFixError,
  onRenderError,
}: Props) {
  const { frame, generation, onFrameLoad, error } = usePreviewFrame(
    design,
    selectedNodeId,
    onSelect,
    onRenderError,
  );
  const hydrated = useHydrated();
  const width = VIEWPORTS.find((option) => option.id === viewport)?.width ?? "100%";

  return (
    <main className="relative flex min-h-0 min-w-0 flex-col items-center overflow-auto dot-grid p-3 sm:p-6">
      <div
        className="relative h-full max-w-full overflow-hidden rounded-xl bg-background-100 shadow-menu transition-[width] duration-300"
        style={{ width }}
      >
        {hydrated && (
          <iframe
            key={generation}
            ref={frame}
            title="Design preview"
            src="/preview/index.html"
            sandbox="allow-scripts"
            className="size-full"
            onLoad={onFrameLoad}
          />
        )}
        {design === null && (
          <div className="absolute inset-0 grid place-items-center bg-background-100 text-copy text-gray-900">
            <span className="flex items-center gap-2">
              {running && <Loader2 className="size-4 animate-spin" />}
              {running ? "Drafting" : "Nothing drafted yet"}
            </span>
          </div>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="absolute inset-x-3 bottom-3 mx-auto flex max-w-xl flex-col items-end gap-3 rounded-md bg-red-100 p-3 text-copy text-red-900 shadow-border sm:inset-x-6 sm:bottom-6 sm:flex-row sm:items-start"
        >
          <p className="flex min-w-0 flex-1 items-start gap-3">
            <AlertTriangle className="mt-1 size-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{error}</span>
          </p>
          <Button variant="secondary" disabled={running} onClick={() => onFixError(error)}>
            Ask the model to fix it
          </Button>
        </div>
      )}
    </main>
  );
}
