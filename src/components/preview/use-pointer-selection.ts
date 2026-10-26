import { useEffect } from "react";

function nodeIdAt(target: EventTarget | null): string | null {
  const element = target instanceof Element ? target.closest("[data-node-id]") : null;
  return element?.getAttribute("data-node-id") ?? null;
}

export function usePointerSelection(
  onHover: (nodeId: string | null) => void,
  onSelect: (nodeId: string | null) => void,
) {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(nodeIdAt(event.target));
    };
    const hover = (event: MouseEvent) => onHover(nodeIdAt(event.target));
    const leave = () => onHover(null);
    const submit = (event: Event) => event.preventDefault();
    document.addEventListener("click", click, true);
    document.addEventListener("mouseover", hover);
    document.addEventListener("mouseleave", leave);
    document.addEventListener("submit", submit, true);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("mouseover", hover);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("submit", submit, true);
    };
  }, [onHover, onSelect]);
}
