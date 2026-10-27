import { NODE_ID_ATTRIBUTE } from "./annotate";
import {
  attributeValue,
  childElements,
  directText,
  tagName,
  topLevelElements,
  type JsxElement,
} from "./jsx-tree";

export type ElementNode = {
  nodeId: string | null;
  tag: string;
  text: string;
  children: ElementNode[];
};

function elementNode(element: JsxElement): ElementNode {
  return {
    nodeId: attributeValue(element, NODE_ID_ATTRIBUTE),
    tag: tagName(element) ?? "element",
    text: directText(element),
    children: childElements(element).map(elementNode),
  };
}

export function elementTree(code: string): ElementNode[] {
  try {
    return topLevelElements(code).map(elementNode);
  } catch {
    return [];
  }
}
