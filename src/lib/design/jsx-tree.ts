import { parse, parseExpression } from "@babel/parser";

export type SyntaxNode = { type: string; start: number; end: number; [key: string]: unknown };

export type JsxElement = SyntaxNode & {
  openingElement: SyntaxNode & { name: SyntaxNode & { name?: string }; attributes: SyntaxNode[] };
  children: SyntaxNode[];
};

const SKIPPED_KEYS = new Set([
  "loc",
  "extra",
  "leadingComments",
  "trailingComments",
  "innerComments",
]);

function isNode(value: unknown): value is SyntaxNode {
  return typeof value === "object" && value !== null && "type" in value && "start" in value;
}

function* walk(value: unknown): Generator<SyntaxNode> {
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item);
    return;
  }
  if (!isNode(value)) return;
  yield value;
  for (const [key, child] of Object.entries(value)) {
    if (!SKIPPED_KEYS.has(key)) yield* walk(child);
  }
}

function parseModule(source: string): SyntaxNode {
  return parse(source, { sourceType: "module", plugins: ["jsx", "typescript"] }).program as never;
}

export function isSingleExpression(source: string): boolean {
  try {
    parseExpression(source, { plugins: ["jsx", "typescript"] });
    return true;
  } catch {
    return false;
  }
}

export function jsxElements(source: string): JsxElement[] {
  return [...walk(parseModule(source))].filter(
    (node): node is JsxElement => node.type === "JSXElement",
  );
}

export function tagName(element: JsxElement): string | null {
  const name = element.openingElement.name;
  return name.type === "JSXIdentifier" ? (name.name ?? null) : null;
}

export function isHostElement(element: JsxElement): boolean {
  return /^[a-z]/.test(tagName(element) ?? "");
}

export function attributeValue(element: JsxElement, attribute: string): string | null {
  const found = element.openingElement.attributes.find(
    (node) => (node.name as { name?: string } | undefined)?.name === attribute,
  );
  const value = found?.value as { type: string; value?: string } | null | undefined;
  return value?.type === "StringLiteral" ? (value.value ?? null) : null;
}

function* outermostElements(value: unknown): Generator<JsxElement> {
  if (Array.isArray(value)) {
    for (const item of value) yield* outermostElements(item);
    return;
  }
  if (!isNode(value)) return;
  if (value.type === "JSXElement") {
    yield value as JsxElement;
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (!SKIPPED_KEYS.has(key)) yield* outermostElements(child);
  }
}

export function topLevelElements(source: string): JsxElement[] {
  return [...outermostElements(parseModule(source))];
}

export function childElements(element: JsxElement): JsxElement[] {
  return [...outermostElements(element.children)];
}

export function directText(element: JsxElement): string {
  return element.children
    .filter((child) => child.type === "JSXText")
    .map((child) => String(child.value))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

type NamedNode = SyntaxNode & { id?: { type: string; name?: string } | null };

function identifierName(node: NamedNode["id"]): string | null {
  return node?.type === "Identifier" ? (node.name ?? null) : null;
}

const DECLARATIONS = new Set(["FunctionDeclaration", "ClassDeclaration", "VariableDeclarator"]);
const IMPORT_SPECIFIERS = new Set([
  "ImportSpecifier",
  "ImportDefaultSpecifier",
  "ImportNamespaceSpecifier",
]);

export function declaredNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const node of walk(parseModule(source)) as Generator<NamedNode>) {
    const name = DECLARATIONS.has(node.type)
      ? identifierName(node.id)
      : IMPORT_SPECIFIERS.has(node.type)
        ? identifierName(node.local as NamedNode["id"])
        : null;
    if (name) names.add(name);
  }
  return names;
}

export function componentTags(source: string): Set<string> {
  return new Set(
    jsxElements(source)
      .map(tagName)
      .filter((name): name is string => /^[A-Z]/.test(name ?? "")),
  );
}

export function exportedNames(source: string): string[] {
  const program = parseModule(source) as SyntaxNode & { body: SyntaxNode[] };
  return program.body
    .filter((node) => node.type === "ExportNamedDeclaration")
    .flatMap((node) => {
      const declaration = node.declaration as (NamedNode & { declarations?: NamedNode[] }) | null;
      const declared = declaration?.declarations ?? (declaration ? [declaration] : []);
      return declared.map((item) => identifierName(item.id));
    })
    .filter((name): name is string => name !== null);
}
