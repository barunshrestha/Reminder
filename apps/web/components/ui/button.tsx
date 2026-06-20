import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary px-10 py-4 text-white hover:bg-opacity-90",
        destructive: "bg-meta-1 px-10 py-4 text-white hover:bg-opacity-90",
        outline:
          "border border-primary bg-transparent px-10 py-4 text-primary hover:bg-primary hover:text-white",
        secondary: "bg-secondary text-black hover:bg-gray-3 dark:text-white",
        ghost: "hover:bg-gray-3 dark:hover:bg-meta-4",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "",
        sm: "px-4 py-2 text-xs",
        lg: "px-12 py-4 text-sm",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
