import { annotate, stripIds, withRootId, type AnnotatedKinds } from "./annotate";
import type { Draft } from "./draft-runner";
import { extractCode } from "./extract-code";
import { elementChangeMessages, elementSystemPrompt, repairMessage } from "./prompts";
import type { Review } from "./review";
import type { Message } from "@/lib/llm/client";
import { isSingleExpression } from "./jsx-tree";
import { elementSource, replaceElement } from "./subtree";

export type CodeRules = { review: (code: string) => Review; kinds: AnnotatedKinds };

export const FILE_MAX_TOKENS = 6000;
const ELEMENT_MAX_TOKENS = 2048;

const MODULE_STATEMENT = /^\s*(import|export)\s/m;

function singleRoot(snippet: string): string {
  return isSingleExpression(snippet) ? snippet : `<>\n${snippet}\n</>`;
}

function elementReply(baseCode: string, nodeId: string) {
  return (reply: string) => {
    const code = extractCode(reply);
    if (!code) throw new Error("The reply has no element");
    if (MODULE_STATEMENT.test(code)) return code;
    return replaceElement(baseCode, nodeId, withRootId(singleRoot(code), nodeId));
  };
}

type CodeRequest = { system: string; maxTokens: number; messages: Message[] };

export function codeDraft(
  request: CodeRequest,
  rules: CodeRules,
  assemble: (reply: string) => string = extractCode,
): Draft<string> {
  return {
    request,
    check: (reply) => {
      const code = assemble(reply);
      const review = rules.review(code);
      return { value: review.errors.length ? code : annotate(code, rules.kinds), review };
    },
    repair: repairMessage,
  };
}

export function elementDraft(
  baseCode: string,
  nodeId: string,
  request: string,
  components: string[],
  rules: CodeRules,
): Draft<string> {
  const element = elementSource(baseCode, nodeId);
  if (!element) throw new Error("The selected element is no longer in this version");
  return codeDraft(
    {
      system: elementSystemPrompt(components),
      maxTokens: ELEMENT_MAX_TOKENS,
      messages: elementChangeMessages(stripIds(baseCode), element, request),
    },
    rules,
    elementReply(baseCode, nodeId),
  );
}
