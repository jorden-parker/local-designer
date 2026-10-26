import { z } from "zod";

const NodeId = z.string().nullable();

const FromPreview = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("select"), nodeId: NodeId }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

const ToPreview = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("render"),
    code: z.string(),
    entry: z.enum(["default", "Showcase"]),
    components: z.string().nullable(),
    theme: z.string(),
    mode: z.enum(["light", "dark"]),
  }),
  z.object({ type: z.literal("highlight"), nodeId: NodeId }),
]);

export type FromPreviewMessage = z.infer<typeof FromPreview>;

export type ToPreviewMessage = z.infer<typeof ToPreview>;

export type RenderMessage = Extract<ToPreviewMessage, { type: "render" }>;

export type ThemeMode = RenderMessage["mode"];

export function isFromPreview(data: unknown): data is FromPreviewMessage {
  return FromPreview.safeParse(data).success;
}

export function isToPreview(data: unknown): data is ToPreviewMessage {
  return ToPreview.safeParse(data).success;
}
