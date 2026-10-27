"use client";

import { FileText, Palette, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import type { Target } from "@/lib/types";
import { Composer } from "./composer";
import { SYSTEM_TARGET } from "./target-view";

type Props = {
  pages: { id: string; name: string }[];
  target: Target;
  canAddPage: boolean;
  onShow: (target: Target) => void;
  onAddPage: (prompt: string) => void;
};

function NavItem({
  current,
  icon: Icon,
  label,
  onClick,
}: {
  current: boolean;
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-1000",
        current ? "bg-gray-alpha-200 font-medium" : "hover:bg-gray-alpha-100",
      )}
    >
      <Icon className="size-4 shrink-0 text-gray-900" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ProjectNav({ pages, target, canAddPage, onShow, onAddPage }: Props) {
  const [adding, setAdding] = useState(false);
  const isPage = (id: string) => target.kind === "page" && target.pageId === id;

  return (
    <nav aria-label="Project" className="flex flex-col gap-1 border-b border-gray-alpha-400 p-3">
      <NavItem
        current={target.kind === "system"}
        icon={Palette}
        label="Design system"
        onClick={() => onShow(SYSTEM_TARGET)}
      />
      <div className="flex items-center justify-between px-1 pt-2 pb-1">
        <SectionLabel>Pages</SectionLabel>
        <Button
          variant="tertiary"
          size="icon"
          aria-label="New page"
          title={canAddPage ? "New page" : "Draft the design system first"}
          disabled={!canAddPage}
          onClick={() => setAdding((open) => !open)}
        >
          <Plus />
        </Button>
      </div>
      {pages.map((page) => (
        <NavItem
          key={page.id}
          current={isPage(page.id)}
          icon={FileText}
          label={page.name}
          onClick={() => onShow({ kind: "page", pageId: page.id })}
        />
      ))}
      {adding && (
        <Composer
          placeholder="Describe the page"
          disabled={!canAddPage}
          onSubmit={(prompt) => {
            setAdding(false);
            onAddPage(prompt);
          }}
        />
      )}
    </nav>
  );
}
