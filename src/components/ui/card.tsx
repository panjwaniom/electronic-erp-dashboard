"use client"

import { cn } from "@/lib/utils"

export interface CardProps {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function Card({ className, style, children, ...props }: CardProps & React.HTMLAttributes<HTMLDivElement>) {
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`)
  }

  return (
    <div
      style={style}
      onMouseMove={onMouseMove}
      className={cn(
        "card-glow bg-card text-card-foreground rounded-[20px] border border-border/70 p-6 shadow-[var(--shadow-1)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
