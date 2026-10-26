const NODE_ID = /^n\d+$/;

const BASE_CSS = "[data-node-id]{cursor:default}";

function rule(nodeId: string | null, declaration: string): string {
  return nodeId && NODE_ID.test(nodeId) ? `[data-node-id="${nodeId}"]{${declaration}}` : "";
}

export function highlightCss(hoveredId: string | null, selectedId: string | null): string {
  return [
    BASE_CSS,
    rule(hoveredId, "outline:1px dashed #006bff;outline-offset:-1px"),
    rule(selectedId, "outline:2px solid #006bff;outline-offset:-2px"),
  ].join("");
}
