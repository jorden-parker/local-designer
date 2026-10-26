"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDesign } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "A pricing page with three tiers and a FAQ",
  "A mobile sign-up flow with email and social login",
  "An analytics dashboard with a sidebar, KPI cards and a table",
];

export function NewDesignForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      router.push(`/d/${await createDesign(prompt)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="rounded-xl bg-background-100 p-2 shadow-menu">
        <Textarea
          autoFocus
          value={prompt}
          aria-label="Describe a screen"
          placeholder="Describe a screen to wireframe"
          className="min-h-28 text-base shadow-none focus-visible:shadow-none"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <span className="text-xs text-gray-900">⌘ Enter to start</span>
          <Button type="submit" disabled={!prompt.trim() || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            Start designing
          </Button>
        </div>
      </div>
      {error && <p className="text-label text-red-900">{error}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="rounded-full bg-background-100 px-3 py-1 text-xs text-gray-900 shadow-border hover:text-gray-1000"
            onClick={() => setPrompt(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}
