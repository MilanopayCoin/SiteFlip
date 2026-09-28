import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "jiy-focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium transition-[color,background-color,border-color,box-shadow] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-ink hover:shadow-[0_0_24px_var(--glow-accent-hover)]",
        primary:
          "bg-accent text-accent-ink hover:shadow-[0_0_24px_var(--glow-accent-hover)]",
        secondary:
          "border border-border bg-transparent text-foreground hover:border-accent/40 hover:bg-surface-2",
        outline:
          "border border-border bg-surface text-foreground hover:border-accent/40 hover:bg-surface-2",
        ghost:
          "text-muted hover:bg-surface-2 hover:text-foreground",
        danger: "bg-danger text-white hover:opacity-90",
        success: "bg-success text-accent-ink hover:opacity-90",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        xl: "h-12 px-8 text-base font-semibold",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
