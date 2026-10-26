import { z } from "zod";
import { designsDirectory } from "@/lib/data-directory";
import type { DesignRouteContext } from "@/lib/design-route";
import { jsonError } from "@/lib/json-error";
import { addPage } from "@/lib/store/designs";

const NewPage = z.object({ prompt: z.string().trim().min(1).max(4000) });

export async function POST(request: Request, context: DesignRouteContext) {
  const parsed = NewPage.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Describe the page you want", 400);
  return addPage(designsDirectory(), (await context.params).id, parsed.data.prompt)
    .then(({ design, pageId }) => Response.json({ design, pageId }, { status: 201 }))
    .catch((error: Error) => jsonError(error.message, 404));
}
