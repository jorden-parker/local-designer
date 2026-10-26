import { designsDirectory } from "@/lib/data-directory";
import type { DesignRouteContext } from "@/lib/design-route";
import { claudeCodePrompt, handoffZip } from "@/lib/handoff/handoff";
import { jsonError } from "@/lib/json-error";
import { slug } from "@/lib/slug";
import { readDesign } from "@/lib/store/designs";

export async function GET(request: Request, context: DesignRouteContext) {
  const design = await readDesign(designsDirectory(), (await context.params).id);
  if (!design || design.system.length === 0) return jsonError("Nothing to hand off yet", 404);
  if (new URL(request.url).searchParams.get("format") === "prompt") {
    return new Response(claudeCodePrompt(design), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(new Blob([handoffZip(design) as BlobPart]), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug(design.title, "design")}-handoff.zip"`,
    },
  });
}
