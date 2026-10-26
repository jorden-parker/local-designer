import {
  childElements,
  directText,
  tagName,
  topLevelElements,
  type JsxElement,
} from "@/lib/design/jsx-tree";

const LABEL_LENGTH = 50;

function line(element: JsxElement, depth: number): string {
  const text = directText(element).slice(0, LABEL_LENGTH);
  const label = text ? ` "${text}"` : "";
  return `${"  ".repeat(depth)}- \`${tagName(element) ?? "element"}\`${label}`;
}

function lines(element: JsxElement, depth: number): string[] {
  return [
    line(element, depth),
    ...childElements(element).flatMap((child) => lines(child, depth + 1)),
  ];
}

export function outline(code: string): string {
  return topLevelElements(code)
    .flatMap((element) => lines(element, 0))
    .join("\n");
}
