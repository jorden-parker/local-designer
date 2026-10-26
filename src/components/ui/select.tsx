import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        className="h-8 w-full appearance-none rounded-md bg-background-100 pr-8 pl-2.5 font-mono text-xs text-gray-1000 shadow-border-small outline-none hover:bg-gray-alpha-100 focus-visible:shadow-focus"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-2 right-2 size-4 text-gray-900" />
    </span>
  );
}

export { Select };
