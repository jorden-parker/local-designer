import { designsDirectory } from "@/lib/data-directory";
import { pageChangeResponse } from "@/lib/design/change-service";
import type { PageRouteContext } from "@/lib/design-route";
import { llmConfigFromEnv } from "@/lib/llm/client";

export async function POST(request: Request, context: PageRouteContext) {
  const body = await request.json().catch(() => null);
  const { id, pageId } = await context.params;
  return pageChangeResponse(id, pageId, body, {
    directory: designsDirectory(),
    config: llmConfigFromEnv(),
    fetchImpl: fetch,
    signal: request.signal,
  });
}
