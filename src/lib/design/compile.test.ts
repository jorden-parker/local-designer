import { describe, expect, it } from "vitest";
import { compile } from "./compile";

describe("compile", () => {
  it("turns a default-export component into CommonJS that uses React.createElement", () => {
    const result = compile(
      "export default function Page() { return <div className='a'>hi</div>; }",
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.js).toContain("React.createElement");
    expect(result.ok && result.js).toContain("exports.default");
  });

  it("accepts TypeScript annotations", () => {
    const source =
      "type P = { n: number };\nexport default function Page({ n }: P) { return <b>{n}</b>; }";
    expect(compile(source).ok).toBe(true);
  });

  it("reports syntax errors with a position", () => {
    const result = compile("export default function Page() { return <div>; }");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/\(\d+:\d+\)/);
  });

  it("rejects imports of anything but React, so the model is asked to repair them", () => {
    const source =
      'import { motion } from "framer-motion";\nexport default function Page() { return <motion.div />; }';
    expect(compile(source)).toEqual({
      ok: false,
      error: 'Only React and ./components can be imported, not "framer-motion".',
    });
  });

  it("accepts React imported in any letter case", () => {
    const source = 'import React from "React";\nexport default function Page() { return <div />; }';
    expect(compile(source).ok).toBe(true);
  });

  it("allows the shared components module", () => {
    const source =
      'import { Card } from "./components";\nexport default function Page() { return <Card />; }';
    expect(compile(source).ok).toBe(true);
  });
});
