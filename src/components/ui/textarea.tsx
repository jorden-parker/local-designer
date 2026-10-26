import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "field-sizing-content min-h-20 w-full resize-none rounded-md bg-background-100 px-3 py-2.5 text-copy text-gray-1000 shadow-border transition-shadow outline-none placeholder:text-gray-700 focus-visible:shadow-focus disabled:bg-gray-100 disabled:text-gray-700",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
