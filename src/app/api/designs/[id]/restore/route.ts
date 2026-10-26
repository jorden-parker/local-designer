import { z } from "zod";
import { designsDirectory } from "@/lib/data-directory";
import type { DesignRouteContext } from "@/lib/design-route";
import { jsonError } from "@/lib/json-error";
import { restoreVersion } from "@/lib/store/designs";

const Restore = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("system") }),
    z.object({ kind: z.literal("page"), pageId: z.string().regex(/^p\d+$/) }),
  ]),
  version: z.number().int().positive(),
});

export async function POST(request: Request, context: DesignRouteContext) {
  const parsed = Restore.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid version", 400);
  const { id } = await context.params;
  return restoreVersion(designsDirectory(), id, parsed.data.target, parsed.data.version)
    .then((design) => Response.json(design))
    .catch((error: Error) => jsonError(error.message, 404));
}
