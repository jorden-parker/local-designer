import type { Message } from "@/lib/llm/client";
import { COLOR_TOKENS, TOKEN_CLASSES, type Tokens } from "./tokens";

const EFFICIENCY_RULES = `- Be brief. Keep the file under 150 lines.
- Put repeated items such as cards, rows, links and FAQ entries in an array and render them with .map().
- No comments, no TypeScript types or interfaces, and no explanations outside the code block.`;

const TOKEN_RULES = `- No import statements. React is a global, so use React.useState for state.
- Color only with these design token classes: ${TOKEN_CLASSES.join(", ")}. Never use other color classes such as bg-gray-100 or text-blue-600, hex colors or inline styles.
- Round corners only with rounded-sm, rounded-md, rounded-lg or rounded-full. Use Tailwind for layout, spacing and type size.
- For an image, use a bg-surface <div> with a fixed height and a centered text-muted label such as "Image".
- Close every JSX tag. An element whose children come from {...props} is self-closing, like <div {...props} />.
- Use short, realistic placeholder copy and make layouts responsive with sm:, md: and lg: prefixes.`;

const CODE_REPLY = "- Reply with one ```tsx code block and nothing else.";

const PLACEHOLDER_THEME = Object.fromEntries(COLOR_TOKENS.map((token) => [token, "<hex>"]));

const TOKENS_SHAPE = JSON.stringify(
  {
    light: PLACEHOLDER_THEME,
    dark: PLACEHOLDER_THEME,
    radius: { sm: "<px>", md: "<px>", lg: "<px>" },
    font: "<sans|serif|mono>",
  },
  null,
  2,
);

export const TOKENS_SYSTEM_PROMPT = `You are a design-system designer. You choose design tokens for a product's wireframes.
Reply with one JSON object and nothing else, in exactly this shape, replacing every <placeholder> with a real value:
${TOKENS_SHAPE}
Rules:
- Colors are hex values like "#1f6f43". "light" is a light theme with dark text; "dark" is a dark theme with light text.
- Pick a "primary" and "accent" from the product's world: a coffee shop might use warm browns, a bank deep navy, a kids' app bright orange.
- Keep background, surface and border mostly neutral. "primary-foreground" must be readable on "primary".
- Radius values are px, like "6px". font is "sans", "serif" or "mono".`;

export const COMPONENTS_SYSTEM_PROMPT = `You are a design-system engineer. You write a product's shared UI components as one TSX file.
Rules:
- Export every component as export function Name({ className = "", ...props }) and spread ...props on its root element, joining className onto its classes.
- Always include Button (variant "primary" or "secondary"), Card, Input, Badge, Heading (level 1 to 3), Text and ImagePlaceholder, plus up to four components this product needs.
- Also export function Showcase() that renders every component once, with example content, in labelled sections.
${TOKEN_RULES}
${EFFICIENCY_RULES}
${CODE_REPLY}`;

function componentsList(components: string[]): string {
  return components.join(", ");
}

export function pageSystemPrompt(components: string[], componentsSource: string): string {
  return `You are a product designer who drafts one page of a product as a React component in TSX, built from its design system.
The design system's components are already in scope, so use them without importing: ${componentsList(components)}.
This is their source, for reference only:
\`\`\`tsx
${componentsSource}
\`\`\`
Rules:
- Write exactly one page: export default function Page() { ... }.
- Build with the design system's components wherever one fits. Do not restyle or redefine them.
${TOKEN_RULES}
${EFFICIENCY_RULES}
${CODE_REPLY}`;
}

export function elementSystemPrompt(components: string[]): string {
  const available = components.length
    ? `\n- These design-system components are in scope: ${componentsList(components)}.`
    : "";
  return `You are a product designer editing one JSX element of a React and TSX file.
Rules:
- Reply with only the replacement element, as a single root JSX element. Wrap siblings in a <div> if you need more than one.
- Change as little as possible. Keep the element's existing structure, copy and classes unless the request needs them changed.${available}
${TOKEN_RULES}
${CODE_REPLY}`;
}

function fenced(language: string, code: string): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

export function tokensMessages(brief: string, request: string, current: Tokens | null): Message[] {
  const base = current
    ? `These are the current tokens:\n${fenced("json", JSON.stringify(current, null, 2))}\n\nChange request: ${request}\nChange only what the request needs.`
    : "Choose the tokens.";
  return [{ role: "user", content: `Product: ${brief}\n\n${base}` }];
}

export function starterComponentsMessages(brief: string, starter: string): Message[] {
  return wholeChangeMessages(
    starter,
    `Adapt these components to this product: ${brief}. Keep every component and the Showcase, and add up to three components this product needs.`,
  );
}

export function newPageMessages(brief: string, request: string): Message[] {
  return [{ role: "user", content: `Product: ${brief}\n\nDesign this page: ${request}` }];
}

export function wholeChangeMessages(code: string, request: string): Message[] {
  return [
    {
      role: "user",
      content: `This is the current file:\n${fenced("tsx", code)}\n\nChange request: ${request}\n\nChange only what the request asks for and keep everything else as it is. Reply with the full updated file.`,
    },
  ];
}

export function elementChangeMessages(code: string, element: string, request: string): Message[] {
  return [
    {
      role: "user",
      content: `This is the whole file, for context:\n${fenced("tsx", code)}\n\nChange only this element:\n${fenced("tsx", element)}\n\nChange request: ${request}\n\nReply with the replacement element only.`,
    },
  ];
}

export function repairMessage(problems: string[]): Message {
  return {
    role: "user",
    content: `Fix these problems and reply with the corrected code in one \`\`\`tsx block:\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
  };
}

export function tokensRepairMessage(problems: string[]): Message {
  return {
    role: "user",
    content: `That JSON did not fit the token shape: ${problems.join(" ")}\nReply with only the corrected JSON object.`,
  };
}
