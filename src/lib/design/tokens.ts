import { z } from "zod";

export const COLOR_TOKENS = [
  "background",
  "surface",
  "border",
  "foreground",
  "muted",
  "primary",
  "primary-foreground",
  "accent",
] as const;

const CssColor = z.string().regex(/^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch)\([\d\s.,%/]+\))$/);
const CssLength = z.string().regex(/^\d+(\.\d+)?(px|rem)$/);

const ThemeSchema = z.object(
  Object.fromEntries(COLOR_TOKENS.map((token) => [token, CssColor])) as Record<
    (typeof COLOR_TOKENS)[number],
    typeof CssColor
  >,
);

const TokensSchema = z.object({
  light: ThemeSchema,
  dark: ThemeSchema,
  radius: z.object({ sm: CssLength, md: CssLength, lg: CssLength }),
  font: z.enum(["sans", "serif", "mono"]),
});

export type Tokens = z.infer<typeof TokensSchema>;

type Theme = Tokens["light"];

export const DEFAULT_TOKENS: Tokens = {
  light: {
    background: "#ffffff",
    surface: "#f5f5f5",
    border: "#e5e5e5",
    foreground: "#171717",
    muted: "#737373",
    primary: "#171717",
    "primary-foreground": "#ffffff",
    accent: "#2563eb",
  },
  dark: {
    background: "#0a0a0a",
    surface: "#171717",
    border: "#2e2e2e",
    foreground: "#ededed",
    muted: "#a1a1a1",
    primary: "#ededed",
    "primary-foreground": "#0a0a0a",
    accent: "#3b82f6",
  },
  radius: { sm: "4px", md: "8px", lg: "12px" },
  font: "sans",
};

const FONT_STACKS: Record<Tokens["font"], string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
};

export const TOKEN_CLASSES = COLOR_TOKENS.flatMap((token) => [
  `bg-${token}`,
  `text-${token}`,
  `border-${token}`,
]);

export function parseTokens(reply: string): Tokens {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in reply");
  return TokensSchema.parse(JSON.parse(reply.slice(start, end + 1)));
}

function colorVariables(theme: Theme): string[] {
  return COLOR_TOKENS.map((token) => `  --color-${token}: ${theme[token]};`);
}

export function themeCss(tokens: Tokens): string {
  return [
    "@theme {",
    "  --color-*: initial;",
    "  --color-white: #ffffff;",
    "  --color-black: #000000;",
    ...colorVariables(tokens.light),
    `  --radius-sm: ${tokens.radius.sm};`,
    `  --radius-md: ${tokens.radius.md};`,
    `  --radius-lg: ${tokens.radius.lg};`,
    `  --font-sans: ${FONT_STACKS[tokens.font]};`,
    "}",
    '[data-theme="dark"] {',
    ...colorVariables(tokens.dark),
    "}",
  ].join("\n");
}
