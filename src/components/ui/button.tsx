"use client"

import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "destructive" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
}

export function Button({
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    default: "bg-background text-foreground hover:bg-muted",
    primary:
      "btn-shine bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.97]",
    secondary: "bg-secondary text-secondary-foreground hover:opacity-90 active:scale-[0.97]",
    destructive:
      "btn-shine bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 hover:brightness-110 active:scale-[0.97]",
    outline:
      "border border-border bg-card/60 text-foreground hover:border-ring/40 hover:bg-card active:scale-[0.97]",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.97]",
  }

  const sizes = {
    default: "h-10 px-4 text-sm",
    sm: "h-8 px-3 text-[13px] rounded-lg",
    lg: "h-11 px-6",
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
