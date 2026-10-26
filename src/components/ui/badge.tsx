import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        gray: "bg-gray-200 text-gray-1000",
        blue: "bg-blue-100 text-blue-900",
        red: "bg-red-100 text-red-900",
      },
    },
    defaultVariants: { variant: "gray" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge };
