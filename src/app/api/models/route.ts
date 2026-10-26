import { chatModels, llmConfig } from "@/lib/llm/model-choice";

export async function GET() {
  const config = await llmConfig();
  return Response.json({ models: await chatModels(config.baseURL), defaultModel: config.model });
}
