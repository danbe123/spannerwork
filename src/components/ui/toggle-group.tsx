"use client";
import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

interface ToggleGroupContextValue {
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  size: "default",
  variant: "default",
})

type ToggleGroupProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & 
  VariantProps<typeof toggleVariants> & {
  className?: string;
  children?: React.ReactNode;
}

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupProps
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}>
    <ToggleGroupContext.Provider value={{ variant: variant ?? undefined, size: size ?? undefined }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

interface ToggleGroupItemProps 
  extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>,
    VariantProps<typeof toggleVariants> {
  className?: string;
  children?: React.ReactNode;
}

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  ToggleGroupItemProps
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(toggleVariants({
        variant: context.variant || variant || undefined,
        size: context.size || size || undefined,
      }), className)}
      {...props}>
      {children}
    </ToggleGroupPrimitive.Item>
  );
})

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
