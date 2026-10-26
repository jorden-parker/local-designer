import { compile } from "./compile";
import { componentTags, declaredNames, exportedNames } from "./jsx-tree";
import { TOKEN_CLASSES } from "./tokens";

export type Review = { errors: string[]; warnings: string[] };

const PALETTE_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|placeholder|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

const DEFAULT_EXPORT = /exports\.default\s*=/;

function colorWarnings(source: string): string[] {
  const classes = [...new Set(source.match(PALETTE_CLASS) ?? [])];
  if (classes.length === 0) return [];
  return [`Replace ${classes.join(", ")} with design token classes: ${TOKEN_CLASSES.join(", ")}.`];
}

function unknownComponentErrors(source: string, components: string[]): string[] {
  const declared = declaredNames(source);
  const unknown = [...componentTags(source)].filter(
    (name) => !declared.has(name) && !components.includes(name),
  );
  if (unknown.length === 0) return [];
  const allowed = [...components, "plain HTML elements", "components you define in this file"];
  return [`These components do not exist: ${unknown.join(", ")}. Use only ${allowed.join(", ")}.`];
}

export function componentNames(source: string): string[] {
  return exportedNames(source).filter((name) => name !== "Showcase");
}

export function reviewPage(source: string, components: string[]): Review {
  const compiled = compile(source);
  if (!compiled.ok) return { errors: [compiled.error], warnings: [] };
  if (!DEFAULT_EXPORT.test(compiled.js)) {
    return { errors: ["The page must be the default export."], warnings: [] };
  }
  return {
    errors: unknownComponentErrors(source, components),
    warnings: colorWarnings(source),
  };
}

export function reviewComponents(source: string): Review {
  const compiled = compile(source);
  if (!compiled.ok) return { errors: [compiled.error], warnings: [] };
  if (!exportedNames(source).includes("Showcase")) {
    return {
      errors: ["The file must export a Showcase component that renders every component."],
      warnings: [],
    };
  }
  return { errors: unknownComponentErrors(source, []), warnings: colorWarnings(source) };
}
