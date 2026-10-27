"use client";

import { Check, Copy, Download, Moon, PanelLeft, PanelRight, PenTool, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { fetchHandoffPrompt, handoffZipUrl } from "@/components/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ThemeMode } from "@/lib/preview-protocol";
import { VIEWPORTS, type ViewportId } from "./viewport";

export type Panel = "project" | "inspector";

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
  openPanel: Panel | null;
  onTogglePanel: (panel: Panel) => void;
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
      aria-label="Copy prompt"
      title="Copy a Claude Code prompt with the brief and code"
      disabled={disabled}
      onClick={copy}
    >
      {copied ? <Check /> : <Copy />}
      <span className="hidden md:inline">{copied ? "Copied" : "Copy prompt"}</span>
    </Button>
  );
}

function HandoffLink({ designId, enabled }: { designId: string; enabled: boolean }) {
  return (
    <a
      href={enabled ? handoffZipUrl(designId) : undefined}
      aria-label="Handoff"
      aria-disabled={!enabled}
      title="Download the handoff zip"
      className={cn(buttonVariants(), !enabled && "pointer-events-none opacity-50")}
    >
      <Download />
      <span className="hidden md:inline">Handoff</span>
    </a>
  );
}

function ViewportToggle({ viewport, onViewport }: Pick<Props, "viewport" | "onViewport">) {
  return (
    <div
      role="group"
      aria-label="Viewport"
      className="hidden rounded-md p-0.5 shadow-border md:flex"
    >
      {VIEWPORTS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          aria-pressed={viewport === id}
          title={label}
          onClick={() => onViewport(id)}
          className="grid size-7 place-items-center rounded-sm text-gray-900 outline-none hover:text-gray-1000 focus-visible:shadow-focus aria-pressed:bg-gray-200 aria-pressed:text-gray-1000"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function PanelToggle({
  panel,
  label,
  className,
  openPanel,
  onTogglePanel,
}: Pick<Props, "openPanel" | "onTogglePanel"> & {
  panel: Panel;
  label: string;
  className: string;
}) {
  const Icon = panel === "project" ? PanelLeft : PanelRight;
  return (
    <Button
      variant="tertiary"
      size="icon"
      aria-label={label}
      aria-expanded={openPanel === panel}
      title={label}
      className={className}
      onClick={() => onTogglePanel(panel)}
    >
      <Icon />
    </Button>
  );
}

export function TopBar(props: Props) {
  const { designId, title, canHandOff, mode, onMode, models, model, onModel } = props;
  const dark = mode === "dark";
  return (
    <header className="flex h-14 items-center gap-1.5 border-b border-gray-alpha-400 bg-background-100 px-2 sm:gap-3 sm:px-4">
      <PanelToggle {...props} panel="project" label="Project" className="lg:hidden" />
      <Link
        href="/"
        aria-label="Local Designer"
        className="flex shrink-0 items-center gap-2 rounded-sm text-sm font-semibold outline-none focus-visible:shadow-focus"
      >
        <PenTool className="size-4" />
        <span className="hidden xl:inline">Local Designer</span>
      </Link>
      <span className="hidden text-gray-500 sm:inline">/</span>
      <h1 className="min-w-0 truncate text-sm text-gray-1000">{title}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <ViewportToggle viewport={props.viewport} onViewport={props.onViewport} />
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
          className="w-24 sm:w-44"
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
        <HandoffLink designId={designId} enabled={canHandOff} />
      </div>
      <PanelToggle {...props} panel="inspector" label="Inspector" className="xl:hidden" />
    </header>
  );
}
