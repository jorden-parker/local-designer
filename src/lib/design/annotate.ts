import MagicString from "magic-string";
import { attributeValue, isHostElement, jsxElements, tagName, type JsxElement } from "./jsx-tree";

export const NODE_ID_ATTRIBUTE = "data-node-id";

const ID_ATTRIBUTE_PATTERN = new RegExp(`\\s+${NODE_ID_ATTRIBUTE}="[^"]*"`, "g");

function idNumber(id: string | null): number {
  return Number(id?.match(/^n(\d+)$/)?.[1] ?? 0);
}

export type AnnotatedKinds = "elements" | "elements-and-components";

const isNamedElement = (element: JsxElement) => tagName(element) !== null;

export function annotate(source: string, kinds: AnnotatedKinds = "elements"): string {
  const elements = jsxElements(source).filter(
    kinds === "elements" ? isHostElement : isNamedElement,
  );
  let lastId = Math.max(
    0,
    ...elements.map((element) => idNumber(attributeValue(element, NODE_ID_ATTRIBUTE))),
  );
  const output = new MagicString(source);
  for (const element of elements) {
    if (attributeValue(element, NODE_ID_ATTRIBUTE)) continue;
    lastId += 1;
    output.appendLeft(element.openingElement.name.end, ` ${NODE_ID_ATTRIBUTE}="n${lastId}"`);
  }
  return output.toString();
}

export function stripIds(source: string): string {
  return source.replace(ID_ATTRIBUTE_PATTERN, "");
}

export function withRootId(snippet: string, nodeId: string): string {
  const root = jsxElements(snippet)[0];
  if (!root || !isNamedElement(root) || attributeValue(root, NODE_ID_ATTRIBUTE)) return snippet;
  const end = root.openingElement.name.end;
  return `${snippet.slice(0, end)} ${NODE_ID_ATTRIBUTE}="${nodeId}"${snippet.slice(end)}`;
}
