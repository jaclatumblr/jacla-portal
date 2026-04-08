import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 aria-invalid:border-destructive transition-[background-color,border-color,color,box-shadow]",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/10 text-primary [a&]:hover:bg-primary/14",
        secondary:
          "border-secondary/15 bg-secondary/10 text-secondary [a&]:hover:bg-secondary/14",
        destructive:
          "border-destructive/15 bg-destructive/10 text-destructive [a&]:hover:bg-destructive/14",
        outline: "border-border bg-card text-foreground [a&]:hover:bg-surface-hover",
        success: "border-success/15 bg-success/10 text-success [a&]:hover:bg-success/14",
        warning: "border-warning/20 bg-warning/18 text-warning-foreground [a&]:hover:bg-warning/22",
        info: "border-info/15 bg-info/10 text-info [a&]:hover:bg-info/14",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
