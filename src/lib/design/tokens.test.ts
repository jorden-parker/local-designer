import { describe, expect, it } from "vitest";
import { DEFAULT_TOKENS, parseTokens, themeCss, TOKEN_CLASSES } from "./tokens";

describe("tokens", () => {
  it("parses the JSON object in a model reply", () => {
    const reply = `Here you go:\n\`\`\`json\n${JSON.stringify(DEFAULT_TOKENS)}\n\`\`\``;
    expect(parseTokens(reply)).toEqual(DEFAULT_TOKENS);
  });

  it("rejects missing colors and values that are not colors", () => {
    const missing = { ...DEFAULT_TOKENS, light: { background: "#fff" } };
    expect(() => parseTokens(JSON.stringify(missing))).toThrow();
    const unsafe = { ...DEFAULT_TOKENS, light: { ...DEFAULT_TOKENS.light, accent: "red; }" } };
    expect(() => parseTokens(JSON.stringify(unsafe))).toThrow();
    expect(() => parseTokens("no json here")).toThrow("No JSON object in reply");
  });

  it("turns tokens into a Tailwind theme with a dark override and no default colors", () => {
    const css = themeCss(DEFAULT_TOKENS);
    expect(css).toContain("@theme {");
    expect(css).toContain("--color-*: initial;");
    expect(css).toContain(`--color-surface: ${DEFAULT_TOKENS.light.surface};`);
    expect(css).toContain(`--radius-md: ${DEFAULT_TOKENS.radius.md};`);
    expect(css).toContain(
      `[data-theme="dark"] {\n  --color-background: ${DEFAULT_TOKENS.dark.background};`,
    );
  });

  it("lists the classes a model may use for color", () => {
    expect(TOKEN_CLASSES).toContain("bg-surface");
    expect(TOKEN_CLASSES).toContain("text-primary-foreground");
    expect(TOKEN_CLASSES).toContain("border-border");
  });
});
