import { NODE_ID_ATTRIBUTE, stripIds } from "./annotate";
import { attributeValue, jsxElements, type JsxElement } from "./jsx-tree";

type Identified = { nodeId: string; element: JsxElement; source: string };

function normalised(code: string, element: JsxElement): string {
  return stripIds(code.slice(element.start, element.end))
    .replace(/\s+/g, " ")
    .replace(/\s*([<>{}])\s*/g, "$1");
}

function identified(code: string): Identified[] {
  return jsxElements(code).flatMap((element) => {
    const nodeId = attributeValue(element, NODE_ID_ATTRIBUTE);
    return nodeId ? [{ nodeId, element, source: normalised(code, element) }] : [];
  });
}

function encloses(outer: JsxElement, inner: JsxElement): boolean {
  return outer !== inner && outer.start <= inner.start && inner.end <= outer.end;
}

function innermost(changed: Identified[]): string[] {
  return changed
    .filter((candidate) => !changed.some((other) => encloses(candidate.element, other.element)))
    .map((candidate) => candidate.nodeId);
}

export function changedNodeIds(previous: string, current: string): string[] {
  try {
    const before = new Map(identified(previous).map((item) => [item.nodeId, item.source]));
    return innermost(identified(current).filter((item) => before.get(item.nodeId) !== item.source));
  } catch {
    return [];
  }
}
