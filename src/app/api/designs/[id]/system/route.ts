import { designsDirectory } from "@/lib/data-directory";
import { systemChangeResponse } from "@/lib/design/change-service";
import type { DesignRouteContext } from "@/lib/design-route";
import { llmConfigFromEnv } from "@/lib/llm/client";

export async function POST(request: Request, context: DesignRouteContext) {
  const body = await request.json().catch(() => null);
  return systemChangeResponse((await context.params).id, body, {
    directory: designsDirectory(),
    config: llmConfigFromEnv(),
    fetchImpl: fetch,
    signal: request.signal,
  });
}
