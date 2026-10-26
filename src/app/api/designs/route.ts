import { z } from "zod";
import { designsDirectory } from "@/lib/data-directory";
import { jsonError } from "@/lib/json-error";
import { createDesign, listDesigns } from "@/lib/store/designs";

const NewDesign = z.object({ prompt: z.string().trim().min(1).max(4000) });

export async function GET() {
  return Response.json(await listDesigns(designsDirectory()));
}

export async function POST(request: Request) {
  const parsed = NewDesign.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Describe the screen you want", 400);
  const design = await createDesign(designsDirectory(), parsed.data.prompt);
  return Response.json({ id: design.id }, { status: 201 });
}
