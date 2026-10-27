import * as React from "react";
import { cn } from "cn";

function SectionLabel({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs font-medium tracking-wide text-gray-900 uppercase", className)}
      {...props}
    />
  );
}

export { SectionLabel };
