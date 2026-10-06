"use client"

import { cn } from "@/lib/utils"

export interface BadgeProps {
  variant?: "default" | "primary" | "secondary" | "destructive" | "outline"
  className?: string
  children?: React.ReactNode
}

export function Badge({ variant = "default", className, children }: BadgeProps) {
  const variants = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/12 text-primary",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive/12 text-destructive",
    outline: "border border-border text-foreground",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight tabular-nums transition-transform duration-200",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
