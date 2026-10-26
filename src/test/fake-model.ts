import type { ModelRequest } from "@/lib/llm/client";

export function fakeModel(replies: string[]) {
  const requests: ModelRequest[] = [];
  const stream = async function* (request: ModelRequest) {
    requests.push(request);
    const reply = replies[requests.length - 1] ?? "";
    yield reply.slice(0, 5);
    yield reply.slice(5);
  };
  return { stream, requests };
}

export const fenced = (code: string) => `\`\`\`tsx\n${code}\n\`\`\``;
