import { NODE_ID_ATTRIBUTE, stripIds } from "./annotate";
import { attributeValue, jsxElements, tagName, type JsxElement } from "./jsx-tree";

function findElement(source: string, nodeId: string): JsxElement | null {
  return (
    jsxElements(source).find((element) => attributeValue(element, NODE_ID_ATTRIBUTE) === nodeId) ??
    null
  );
}

export function elementSource(source: string, nodeId: string): string | null {
  const element = findElement(source, nodeId);
  return element ? stripIds(source.slice(element.start, element.end)) : null;
}

export function elementTag(source: string, nodeId: string): string | null {
  const element = findElement(source, nodeId);
  return element ? tagName(element) : null;
}

export function replaceElement(source: string, nodeId: string, replacement: string): string {
  const element = findElement(source, nodeId);
  if (!element) throw new Error(`Element ${nodeId} was not found`);
  return source.slice(0, element.start) + replacement + source.slice(element.end);
}
