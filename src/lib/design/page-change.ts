import { stripIds } from "./annotate";
import { codeDraft, elementDraft, FILE_MAX_TOKENS } from "./code-draft";
import { runDraft, type StreamText } from "./draft-runner";
import { newPageMessages, pageSystemPrompt, wholeChangeMessages } from "./prompts";
import { componentNames, reviewPage } from "./review";

export type PageChange = {
  brief: string;
  request: string;
  nodeId: string | null;
  baseCode: string | null;
  components: string;
};

export async function pageChange(
  stream: StreamText,
  change: PageChange,
  onText: (text: string) => void,
): Promise<string> {
  const { brief, request, nodeId, baseCode, components } = change;
  const names = componentNames(components);
  const rules = {
    review: (code: string) => reviewPage(code, names),
    kinds: "elements-and-components" as const,
  };
  if (baseCode && nodeId) {
    return runDraft(stream, elementDraft(baseCode, nodeId, request, names, rules), onText);
  }
  const messages = baseCode
    ? wholeChangeMessages(stripIds(baseCode), request)
    : newPageMessages(brief, request);
  const system = pageSystemPrompt(names, stripIds(components));
  return runDraft(
    stream,
    codeDraft({ system, maxTokens: FILE_MAX_TOKENS, messages }, rules),
    onText,
  );
}
