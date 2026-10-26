import { transform } from "sucrase";

export type CompileResult = { ok: true; js: string } | { ok: false; error: string };

export const COMPONENTS_MODULE = "./components";

const REQUIRED_MODULE = /require\(['"]([^'"]+)['"]\)/g;

export function isReactModule(name: string): boolean {
  return name.toLowerCase() === "react";
}

export function importError(name: string): string {
  return `Only React and ${COMPONENTS_MODULE} can be imported, not "${name}".`;
}

function isAllowedModule(name: string): boolean {
  return isReactModule(name) || name === COMPONENTS_MODULE;
}

export function compile(source: string): CompileResult {
  try {
    const { code } = transform(source, {
      transforms: ["jsx", "typescript", "imports"],
      jsxRuntime: "classic",
      production: true,
    });
    const foreign = [...code.matchAll(REQUIRED_MODULE)].find((match) => !isAllowedModule(match[1]));
    return foreign ? { ok: false, error: importError(foreign[1]) } : { ok: true, js: code };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
