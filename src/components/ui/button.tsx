import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-700 disabled:shadow-border [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gray-1000 text-background-100 hover:bg-gray-1000/85",
        secondary: "bg-background-100 text-gray-1000 shadow-border-small hover:bg-gray-alpha-100",
        tertiary: "bg-transparent text-gray-1000 hover:bg-gray-alpha-100",
      },
      size: {
        small: "h-8 px-2.5 text-sm",
        medium: "h-10 px-3 text-sm",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "small" },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
