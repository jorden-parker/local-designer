import type { Message, ModelRequest } from "@/lib/llm/client";
import type { Review } from "./review";

export type StreamText = (request: ModelRequest) => AsyncIterable<string>;

export type Checked<T> = { value: T; review: Review };

export type Draft<T> = {
  request: ModelRequest;
  check: (reply: string) => Checked<T>;
  repair: (problems: string[]) => Message;
};

type Outcome<T> = Checked<T> | { value: null; review: Review };

export const REPAIR_NOTICE = "\n\n[Found problems. Asking the model to fix them.]\n\n";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function outcome<T>(draft: Draft<T>, reply: string): Outcome<T> {
  try {
    return draft.check(reply);
  } catch (error) {
    return { value: null, review: { errors: [errorMessage(error)], warnings: [] } };
  }
}

function isUsable<T>(result: Outcome<T>): result is Checked<T> {
  return result.value !== null && result.review.errors.length === 0;
}

async function collectReply(
  stream: StreamText,
  request: ModelRequest,
  onText: (text: string) => void,
): Promise<string> {
  let reply = "";
  for await (const text of stream(request)) {
    reply += text;
    onText(text);
  }
  return reply;
}

function repairRequest<T>(draft: Draft<T>, reply: string, review: Review): ModelRequest {
  return {
    ...draft.request,
    messages: [
      ...draft.request.messages,
      { role: "assistant", content: reply },
      draft.repair([...review.errors, ...review.warnings]),
    ],
  };
}

export async function runDraft<T>(
  stream: StreamText,
  draft: Draft<T>,
  onText: (text: string) => void,
): Promise<T> {
  const firstReply = await collectReply(stream, draft.request, onText);
  const first = outcome(draft, firstReply);
  if (isUsable(first) && first.review.warnings.length === 0) return first.value;
  onText(REPAIR_NOTICE);
  const secondReply = await collectReply(
    stream,
    repairRequest(draft, firstReply, first.review),
    onText,
  );
  const second = outcome(draft, secondReply);
  if (isUsable(second)) return second.value;
  if (isUsable(first)) return first.value;
  throw new Error(`The model's reply still had problems: ${second.review.errors.join(" ")}`);
}
