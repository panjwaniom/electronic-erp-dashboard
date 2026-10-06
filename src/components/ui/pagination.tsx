"use client"

import { cn } from "@/lib/utils"

export interface PaginationProps {
  className?: string
  children: React.ReactNode
}

export function Pagination({ className, children }: PaginationProps) {
  return (
    <nav
      className={cn("mx-auto flex w-full justify-center", className)}
      role="navigation"
      aria-label="pagination"
    >
      {children}
    </nav>
  )
}