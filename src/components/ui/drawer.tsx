"use client";

import * as React from "react";
import { cn } from "cn";

type Side = "left" | "right";
type Breakpoint = "lg" | "xl";

const SIDE: Record<Side, string> = {
  left: "left-0 w-panel border-r",
  right: "right-0 w-inspector border-l",
};

const UNDOCKED: Record<Breakpoint, string> = {
  lg: "max-lg:fixed max-lg:inset-y-0 max-lg:z-30 max-lg:max-w-5/6 max-lg:shadow-menu max-lg:transition-transform",
  xl: "max-xl:fixed max-xl:inset-y-0 max-xl:z-30 max-xl:max-w-5/6 max-xl:shadow-menu max-xl:transition-transform",
};

const CLOSED: Record<Side, Record<Breakpoint, string>> = {
  left: {
    lg: "max-lg:invisible max-lg:-translate-x-full",
    xl: "max-xl:invisible max-xl:-translate-x-full",
  },
  right: {
    lg: "max-lg:invisible max-lg:translate-x-full",
    xl: "max-xl:invisible max-xl:translate-x-full",
  },
};

const BACKDROP: Record<Breakpoint, string> = {
  lg: "lg:hidden",
  xl: "xl:hidden",
};

type Props = {
  side: Side;
  dockAt: Breakpoint;
  open: boolean;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
};

function useCloseOnEscape(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, onClose]);
}

function Drawer({ side, dockAt, open, label, onClose, children }: Props) {
  useCloseOnEscape(open, onClose);
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close panel"
          className={cn("fixed inset-0 z-20 bg-overlay", BACKDROP[dockAt])}
          onClick={onClose}
        />
      )}
      <aside
        aria-label={label}
        className={cn(
          "flex min-h-0 flex-col border-gray-alpha-400 bg-background-100 duration-200 motion-reduce:transition-none",
          SIDE[side],
          UNDOCKED[dockAt],
          !open && CLOSED[side][dockAt],
        )}
      >
        {children}
      </aside>
    </>
  );
}

export { Drawer };
