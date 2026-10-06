"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  Receipt,
  Scale,
  Wallet,
} from "lucide-react"
import { useERP } from "@/lib/store"
import type { DayBookEntry, DayBookKind } from "@/types"
import { buildDayBook, formatINR, prettyDate, relativeDay, todayISO, addDaysISO } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"

const KIND_META: Record<
  DayBookKind,
  { icon: typeof Receipt; chip: string; sign: "in" | "out" | "info" }
> = {
  BILL: { icon: Receipt, chip: "bg-[#30d158]/12 text-[#30d158]", sign: "in" },
  CREDIT: { icon: Wallet, chip: "bg-[#ff9f0a]/14 text-[#ff9f0a]", sign: "info" },
  PAYMENT: { icon: ArrowDownLeft, chip: "bg-[#30d158]/12 text-[#30d158]", sign: "in" },
  ADJUST: { icon: Scale, chip: "bg-[#0a84ff]/12 text-[#0a84ff]", sign: "info" },
  EXPENSE: { icon: ArrowUpRight, chip: "bg-[#ff453a]/12 text-[#ff453a]", sign: "out" },
  INCOME: { icon: ArrowDownLeft, chip: "bg-[#0a84ff]/12 text-[#0a84ff]", sign: "in" },
  STOCK_IN: { icon: PackagePlus, chip: "bg-muted text-muted-foreground", sign: "info" },
  STOCK_OUT: { icon: PackagePlus, chip: "bg-muted text-muted-foreground", sign: "info" },
}

const KIND_LABEL: Record<DayBookKind, string> = {
  BILL: "Sale",
  CREDIT: "Udhaar",
  PAYMENT: "Udhaar received",
  ADJUST: "Udhaar adjustment",
  EXPENSE: "Expense",
  INCOME: "Income",
  STOCK_IN: "Stock in",
  STOCK_OUT: "Stock out",
}

export default function DayBookPage() {
  const { state } = useERP()
  const [date, setDate] = useState(todayISO())

  const entries = useMemo<DayBookEntry[]>(
    () => buildDayBook(date, state.sales, state.ledger, state.expenses, state.stock),
    [date, state.sales, state.ledger, state.expenses, state.stock]
  )

  const summary = useMemo(() => {
    const bills = state.sales.filter((s) => s.date === date && s.status !== "REFUNDED")
    const cashIn = bills
      .filter((s) => s.paymentMethod !== "UDHARI")
      .reduce((sum, s) => sum + s.total, 0)
    const udhaarGiven = bills
      .filter((s) => s.paymentMethod === "UDHARI")
      .reduce((sum, s) => sum + s.total, 0)
    const paymentsIn = state.ledger
      .filter((l) => l.date === date && l.type === "PAYMENT")
      .reduce((sum, l) => sum + l.amount, 0)
    const expensesOut = state.expenses
      .filter((e) => e.date === date && e.type === "EXPENSE")
      .reduce((sum, e) => sum + e.amount, 0)
    const incomeIn = state.expenses
      .filter((e) => e.date === date && e.type === "INCOME")
      .reduce((sum, e) => sum + e.amount, 0)
    const net = cashIn + paymentsIn + incomeIn - expensesOut
    return { cashIn, udhaarGiven, paymentsIn, expensesOut, incomeIn, net }
  }, [date, state.sales, state.ledger, state.expenses])

  const isToday = date === todayISO()

  const cards = [
    { label: "Cash in (bills)", value: summary.cashIn, cls: "text-[#30d158]" },
    { label: "Udhaar given", value: summary.udhaarGiven, cls: "text-[#ff9f0a]" },
    { label: "Payments received", value: summary.paymentsIn, cls: "text-[#30d158]" },
    { label: "Expenses out", value: summary.expensesOut, cls: "text-[#ff453a]" },
  ]

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header + date nav */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">Daily register</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                Day Book
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Every bill, payment and expense — one page
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous day"
                onClick={() => setDate((d) => addDaysISO(d, -1))}
                className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-[var(--shadow-1)] transition-all hover:text-foreground active:scale-90"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-2 text-center shadow-[var(--shadow-1)]">
                <p className="text-[14px] font-bold leading-tight">{relativeDay(date)}</p>
                <p className="text-[11.5px] text-muted-foreground tabular-nums">
                  {prettyDate(date)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Next day"
                disabled={date >= todayISO()}
                onClick={() => setDate((d) => addDaysISO(d, 1))}
                className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-[var(--shadow-1)] transition-all hover:text-foreground active:scale-90 disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setDate(todayISO())}
                  className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-95"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 fade-in-up" style={{ animationDelay: "80ms" }}>
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]"
              >
                <p className="eyebrow">{c.label}</p>
                <p className={cn("mt-1 text-[21px] font-bold tabular-nums", c.cls)}>
                  {formatINR(c.value)}
                </p>
              </div>
            ))}
            <div className="rounded-2xl border border-border/70 bg-background/70 px-5 py-4 shadow-[var(--shadow-1)] ring-1 ring-border/60">
              <p className="eyebrow">Net position</p>
              <p
                className={cn(
                  "mt-1 text-[21px] font-bold tabular-nums",
                  summary.net >= 0 ? "text-[#30d158]" : "text-[#ff453a]"
                )}
              >
                {formatINR(summary.net)}
              </p>
            </div>
          </div>

          {/* Entries */}
          <div
            className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <BookOpen className="h-4 w-4 text-[var(--ring)]" />
                Register
              </h2>
              <span className="eyebrow">{entries.length} entries</span>
            </div>

            {entries.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <BookOpen className="h-6 w-6" />
                </span>
                <p className="text-[15px] font-semibold">Quiet day</p>
                <p className="mt-1 max-w-[340px] text-[13.5px] text-muted-foreground">
                  No bills or transactions on {prettyDate(date)}. Bills saved at the counter
                  appear here instantly.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {entries.map((entry) => {
                  const meta = KIND_META[entry.kind]
                  const Icon = meta.icon
                  const isRefunded = entry.subtitle?.includes("REFUNDED") ?? false
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl",
                          meta.chip
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{entry.title}</p>
                        <p className="truncate text-[12.5px] text-muted-foreground">
                          {KIND_LABEL[entry.kind]}
                          {entry.subtitle ? ` · ${entry.subtitle}` : ""}
                        </p>
                      </div>
                      {entry.amount !== 0 && (
                        <p
                          className={cn(
                            "text-[15px] font-bold tabular-nums",
                            isRefunded
                              ? "text-muted-foreground line-through decoration-[#ff453a]/70"
                              : entry.kind === "ADJUST"
                                ? "text-[#0a84ff]"
                                : meta.sign === "in" && "text-[#30d158]",
                            !isRefunded &&
                              entry.kind !== "ADJUST" &&
                              meta.sign === "out" &&
                              "text-[#ff453a]",
                            !isRefunded &&
                              entry.kind !== "ADJUST" &&
                              meta.sign === "info" &&
                              "text-[#ff9f0a]"
                          )}
                        >
                          {isRefunded
                            ? `+${formatINR(Math.abs(entry.amount))}`
                            : entry.kind === "ADJUST"
                              ? formatINR(entry.amount)
                              : `${meta.sign === "out" ? "-" : meta.sign === "info" ? "" : "+"}${formatINR(Math.abs(entry.amount))}`}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
