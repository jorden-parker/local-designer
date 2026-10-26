import { annotate, stripIds } from "./annotate";
import { codeDraft, elementDraft, FILE_MAX_TOKENS } from "./code-draft";
import { runDraft, type Draft, type StreamText } from "./draft-runner";
import {
  COMPONENTS_SYSTEM_PROMPT,
  starterComponentsMessages,
  TOKENS_SYSTEM_PROMPT,
  tokensMessages,
  tokensRepairMessage,
  wholeChangeMessages,
} from "./prompts";
import { reviewComponents } from "./review";
import { STARTER_COMPONENTS } from "./starter-components";
import { parseTokens, type Tokens } from "./tokens";

export type DesignSystem = { tokens: Tokens; components: string };

export type SystemChange = {
  brief: string;
  request: string;
  nodeId: string | null;
  base: DesignSystem | null;
};

export const TOKENS_HEADING = "[Design tokens]\n\n";
export const COMPONENTS_HEADING = "\n\n[Components]\n\n";
export const STARTER_NOTICE =
  "\n\n[The model's components did not work, so the starter components are kept. Ask for changes to adapt them.]\n\n";

const TOKENS_MAX_TOKENS = 1024;

const COMPONENT_RULES = { review: reviewComponents, kinds: "elements" } as const;

function tokensDraft(change: SystemChange): Draft<Tokens> {
  return {
    request: {
      system: TOKENS_SYSTEM_PROMPT,
      maxTokens: TOKENS_MAX_TOKENS,
      messages: tokensMessages(change.brief, change.request, change.base?.tokens ?? null),
    },
    check: (reply) => ({ value: parseTokens(reply), review: { errors: [], warnings: [] } }),
    repair: tokensRepairMessage,
  };
}

function componentsDraft(change: SystemChange): Draft<string> {
  const messages = change.base
    ? wholeChangeMessages(stripIds(change.base.components), change.request)
    : starterComponentsMessages(change.brief, STARTER_COMPONENTS);
  return codeDraft(
    { system: COMPONENTS_SYSTEM_PROMPT, maxTokens: FILE_MAX_TOKENS, messages },
    COMPONENT_RULES,
  );
}

async function editComponentElement(
  stream: StreamText,
  base: DesignSystem,
  change: SystemChange & { nodeId: string },
  onText: (text: string) => void,
): Promise<DesignSystem> {
  const draft = elementDraft(base.components, change.nodeId, change.request, [], COMPONENT_RULES);
  return { tokens: base.tokens, components: await runDraft(stream, draft, onText) };
}

async function draftComponents(
  stream: StreamText,
  change: SystemChange,
  onText: (text: string) => void,
): Promise<string> {
  const drafted = runDraft(stream, componentsDraft(change), onText);
  if (change.base) return drafted;
  return drafted.catch(() => {
    onText(STARTER_NOTICE);
    return annotate(STARTER_COMPONENTS);
  });
}

export async function systemChange(
  stream: StreamText,
  change: SystemChange,
  onText: (text: string) => void,
): Promise<DesignSystem> {
  const { base, nodeId } = change;
  if (base && nodeId) return editComponentElement(stream, base, { ...change, nodeId }, onText);
  onText(TOKENS_HEADING);
  const tokens = await runDraft(stream, tokensDraft(change), onText);
  onText(COMPONENTS_HEADING);
  return { tokens, components: await draftComponents(stream, change, onText) };
}
