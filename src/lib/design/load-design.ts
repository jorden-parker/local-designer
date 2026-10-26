import * as React from "react";
import { compile, COMPONENTS_MODULE, importError, isReactModule } from "./compile";

export type DesignEntry = "default" | "Showcase";

export type LoadableDesign = { code: string; entry: DesignEntry; components: string | null };

type Loaded = { ok: true; component: React.ComponentType } | { ok: false; error: string };

type ModuleExports = Record<string, unknown>;

type Ran = { ok: true; exports: ModuleExports } | { ok: false; error: string };

const COMPONENT_NAME = /^[A-Z][\w$]*$/;

function scopeNames(scope: ModuleExports): string[] {
  return Object.keys(scope).filter((name) => COMPONENT_NAME.test(name) && name !== "React");
}

function moduleRequire(scope: ModuleExports) {
  return (name: string) => {
    if (isReactModule(name)) return React;
    if (name === COMPONENTS_MODULE) return scope;
    throw new Error(importError(name));
  };
}

function runModule(source: string, scope: ModuleExports): Ran {
  const compiled = compile(source);
  if (!compiled.ok) return compiled;
  const exports: ModuleExports = {};
  const names = scopeNames(scope);
  try {
    new Function("React", "exports", "require", ...names, `{\n${compiled.js}\n}`)(
      React,
      exports,
      moduleRequire(scope),
      ...names.map((name) => scope[name]),
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  return { ok: true, exports };
}

function systemExports(components: string | null): Ran {
  if (components === null) return { ok: true, exports: {} };
  const ran = runModule(components, {});
  return ran.ok ? ran : { ok: false, error: `The design system failed: ${ran.error}` };
}

export function loadDesign(design: LoadableDesign): Loaded {
  const system = systemExports(design.components);
  if (!system.ok) return system;
  const main = runModule(design.code, system.exports);
  if (!main.ok) return main;
  const component = main.exports[design.entry];
  return typeof component === "function"
    ? { ok: true, component: component as React.ComponentType }
    : { ok: false, error: `Nothing is exported as "${design.entry}".` };
}
