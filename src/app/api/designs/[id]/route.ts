import { designsDirectory } from "@/lib/data-directory";
import type { DesignRouteContext } from "@/lib/design-route";
import { jsonError } from "@/lib/json-error";
import { readDesign } from "@/lib/store/designs";

export async function GET(_request: Request, context: DesignRouteContext) {
  const design = await readDesign(designsDirectory(), (await context.params).id);
  return design ? Response.json(design) : jsonError("Design not found", 404);
}
