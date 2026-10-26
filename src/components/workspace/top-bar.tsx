"use client";

import { Check, Copy, Download, Moon, PenTool, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { fetchHandoffPrompt, handoffZipUrl } from "@/components/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ThemeMode } from "@/lib/preview-protocol";
import { VIEWPORTS, type ViewportId } from "./viewport";

type Props = {
  designId: string;
  title: string;
  canHandOff: boolean;
  viewport: ViewportId;
  onViewport: (viewport: ViewportId) => void;
  mode: ThemeMode;
  onMode: (mode: ThemeMode) => void;
  models: string[];
  model: string | null;
  onModel: (model: string) => void;
};

function CopyPromptButton({ designId, disabled }: { designId: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(await fetchHandoffPrompt(designId));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button
      variant="secondary"
      title="Copy a Claude Code prompt with the brief and code"
      disabled={disabled}
      onClick={copy}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy prompt"}
    </Button>
  );
}

export function TopBar(props: Props) {
  const { designId, title, canHandOff, viewport, onViewport, mode, onMode } = props;
  const { models, model, onModel } = props;
  const dark = mode === "dark";
  return (
    <header className="flex h-14 items-center gap-3 border-b border-gray-alpha-400 bg-background-100 px-4">
      <Link
        href="/"
        aria-label="Local Designer"
        className="flex shrink-0 items-center gap-2 text-sm font-semibold"
      >
        <PenTool className="size-4" />
        <span className="hidden xl:inline">Local Designer</span>
      </Link>
      <span className="text-gray-500">/</span>
      <h1 className="min-w-0 truncate text-sm text-gray-1000">{title}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div role="group" aria-label="Viewport" className="flex rounded-md p-0.5 shadow-border">
          {VIEWPORTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={viewport === id}
              title={label}
              onClick={() => onViewport(id)}
              className="grid size-7 place-items-center rounded-sm text-gray-900 hover:text-gray-1000 aria-pressed:bg-gray-200 aria-pressed:text-gray-1000"
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Dark theme"
          aria-pressed={dark}
          title={dark ? "Preview the light theme" : "Preview the dark theme"}
          onClick={() => onMode(dark ? "light" : "dark")}
        >
          {dark ? <Moon /> : <Sun />}
        </Button>
        <Select
          aria-label="Model"
          className="w-44"
          value={model ?? ""}
          onChange={(event) => onModel(event.target.value)}
        >
          {models.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <CopyPromptButton designId={designId} disabled={!canHandOff} />
        <a
          href={canHandOff ? handoffZipUrl(designId) : undefined}
          aria-disabled={!canHandOff}
          className={cn(buttonVariants(), !canHandOff && "pointer-events-none opacity-50")}
        >
          <Download />
          Handoff
        </a>
      </div>
    </header>
  );
}
