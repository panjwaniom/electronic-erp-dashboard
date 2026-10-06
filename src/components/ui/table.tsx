"use client"

import { cn } from "@/lib/utils"

export interface TableProps {
  className?: string
  children: React.ReactNode
}

export function Table({ className, children }: TableProps) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)}>{children}</table>
    </div>
  )
}

export function TableHeader({ className, children }: TableProps) {
  return <thead className={cn("[&_tr]:border-b", className)}>{children}</thead>
}

export function TableBody({ className, children }: TableProps) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)}>{children}</tbody>
}

export function TableRow({ className, children }: TableProps) {
  return <tr className={cn("border-b transition-colors", className)}>{children}</tr>
}

export function TableCell({ className, children }: TableProps) {
  return (
    <td className={cn("align-middle [&:has([role=checkbox])]:pr-0", className)}>{children}</td>
  )
}

export function TableHeaderRow({ className, children }: TableProps) {
  return <tr className={cn("border-b", className)}>{children}</tr>
}
