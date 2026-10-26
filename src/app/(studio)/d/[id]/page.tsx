import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { designsDirectory } from "@/lib/data-directory";
import { readDesign } from "@/lib/store/designs";

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const design = await readDesign(designsDirectory(), (await params).id);
  if (!design) notFound();
  return <Workspace initialDesign={design} />;
}
