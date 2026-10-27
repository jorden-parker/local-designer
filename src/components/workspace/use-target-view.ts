import { useCallback, useMemo, useState } from "react";
import type { ThemeMode } from "@/lib/preview-protocol";
import type { Design, Target } from "@/lib/types";
import { editedNodeId, initialTarget, targetView } from "./target-view";

export function useTargetView(initialDesign: Design) {
  const [design, setDesign] = useState(initialDesign);
  const [target, setTarget] = useState<Target>(() => initialTarget(initialDesign));
  const [viewedNumber, setViewedNumber] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>("light");
  const view = useMemo(
    () => targetView(design, target, viewedNumber, mode),
    [design, target, viewedNumber, mode],
  );

  const showTarget = useCallback((next: Target) => {
    setTarget(next);
    setViewedNumber(null);
    setSelectedNodeId(null);
  }, []);

  const showDesign = useCallback((next: Design) => {
    setDesign(next);
    setViewedNumber(null);
  }, []);

  const viewVersion = useCallback(
    (number: number) => {
      setViewedNumber(number);
      setSelectedNodeId(editedNodeId(design, target, number));
    },
    [design, target],
  );

  return {
    design,
    showDesign,
    target,
    showTarget,
    view,
    viewVersion,
    selectedNodeId,
    selectNode: setSelectedNodeId,
    mode,
    setMode,
  };
}
