import { PenTool } from "lucide-react";
import { connection } from "next/server";
import { DesignList } from "@/components/gallery/design-list";
import { NewDesignForm } from "@/components/gallery/new-design-form";
import { designsDirectory } from "@/lib/data-directory";
import { listDesigns } from "@/lib/store/designs";

export default async function HomePage() {
  await connection();
  const designs = await listDesigns(designsDirectory());
  return (
    <div className="min-h-screen bg-background-200">
      <header className="flex h-14 items-center gap-2 border-b border-gray-alpha-400 bg-background-100 px-6 text-sm font-semibold">
        <PenTool className="size-4" />
        Local Designer
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16">
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 text-center">
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-semibold tracking-tight">What should we wireframe?</h1>
            <p className="text-copy text-gray-900">
              A local model drafts it. Click any element to change it, then hand it off.
            </p>
          </div>
          <NewDesignForm />
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-gray-900">Recent designs</h2>
          <DesignList designs={designs} />
        </section>
      </main>
    </div>
  );
}
