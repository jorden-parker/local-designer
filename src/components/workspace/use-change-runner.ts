import { useCallback, useRef, useState } from "react";
import { streamChange, type ChangeBody } from "@/components/api";
import type { Target } from "@/lib/types";

export type RunState =
  | { status: "idle" }
  | { status: "running"; output: string; request: string }
  | { status: "failed"; output: string; request: string; error: string };

export function useChangeRunner(designId: string, onSaved: () => Promise<void>) {
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  const start = useCallback(
    async (target: Target, body: ChangeBody) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      let output = "";
      setRun({ status: "running", output, request: body.request });
      try {
        await streamChange(
          designId,
          target,
          body,
          (text) => {
            output += text;
            setRun({ status: "running", output, request: body.request });
          },
          current.signal,
        );
        await onSaved();
        setRun({ status: "idle" });
      } catch (error) {
        if (current.signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        setRun({ status: "failed", output, request: body.request, error: message });
      }
    },
    [designId, onSaved],
  );

  const stop = useCallback(() => {
    controller.current?.abort();
    setRun({ status: "idle" });
  }, []);

  return { run, start, stop };
}
