"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Headphones,
  Home,
  Megaphone,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  Truck,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react"
import { useERP } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import type { ExpenseCategory, PaymentMethod } from "@/types"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Modal, Field } from "@/components/ui/modal"
import { currentMonth, formatINR, relativeDay, todayISO } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent",
  "Electricity",
  "Salary",
  "Transport",
  "Marketing",
  "Repairs",
  "Supplies",
  "Purchase",
  "Other",
]

const INCOME_CATEGORIES: ExpenseCategory[] = [
  "Service Income",
  "Accessories Income",
  "Other",
]

const CATEGORY_META: Record<string, { icon: typeof Zap; chip: string }> = {
  Rent: { icon: Home, chip: "bg-[#0a84ff]/12 text-[#0a84ff]" },
  Electricity: { icon: Zap, chip: "bg-[#ffd60a]/15 text-[#ffd60a]" },
  Salary: { icon: Wallet, chip: "bg-[#bf5af2]/14 text-[#bf5af2]" },
  Transport: { icon: Truck, chip: "bg-[#64d2ff]/14 text-[#64d2ff]" },
  Marketing: { icon: Megaphone, chip: "bg-[#ff375f]/12 text-[#ff375f]" },
  Repairs: { icon: Wrench, chip: "bg-[#ff9f0a]/14 text-[#ff9f0a]" },
  Supplies: { icon: Package, chip: "bg-muted text-muted-foreground" },
  Purchase: { icon: ShoppingCart, chip: "bg-[#30d158]/12 text-[#30d158]" },
  "Service Income": { icon: Wrench, chip: "bg-[#30d158]/12 text-[#30d158]" },
  "Accessories Income": { icon: Headphones, chip: "bg-[#30d158]/12 text-[#30d158]" },
  Other: { icon: Receipt, chip: "bg-muted text-muted-foreground" },
}

export default function ExpensesPage() {
  const { state, deleteExpense, notify } = useERP()
  const { t } = useLanguage()
  const [filter, setFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL")
  const [showAdd, setShowAdd] = useState(false)

  const month = currentMonth()

  const monthStats = useMemo(() => {
    let income = 0
    let expense = 0
    state.expenses
      .filter((e) => e.date.startsWith(month))
      .forEach((e) => {
        if (e.type === "INCOME") income += e.amount
        else expense += e.amount
      })
    return { income, expense, net: income - expense }
  }, [state.expenses, month])

  const entries = useMemo(() => {
    return [...state.expenses]
      .filter((e) => filter === "ALL" || e.type === filter)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [state.expenses, filter])

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">Money</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                {t("expenses.title")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("expenses.subtitle")}
              </p>
            </div>
            <Button size="lg" className="shadow-lg shadow-primary/25" onClick={() => setShowAdd(true)}>
              <Plus className="h-4.5 w-4.5" /> {t("expenses.add")}
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 fade-in-up" style={{ animationDelay: "80ms" }}>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("expenses.otherIncome")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#30d158]">
                {formatINR(monthStats.income)}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                service &amp; counter income
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("expenses.thisMonth")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff453a]">
                {formatINR(monthStats.expense)}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                rent, salary, utilities &amp; running costs
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-5 py-4 shadow-[var(--shadow-1)] ring-1 ring-border/60">
              <p className="eyebrow">{t("expenses.net")}</p>
              <p
                className={cn(
                  "mt-1 text-[24px] font-bold tabular-nums",
                  monthStats.net >= 0 ? "text-[#30d158]" : "text-[#ff453a]"
                )}
              >
                {formatINR(monthStats.net)}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                billed sales live in{" "}
                <Link href="/reports" className="text-foreground underline underline-offset-2">
                  Reports
                </Link>
              </p>
            </div>
          </div>

          {/* Filter */}
          <div className="toolbar flex flex-wrap items-center gap-3 fade-in-up" style={{ animationDelay: "140ms" }}>
            <div className="segmented" role="tablist" aria-label="Filter entries">
              {([["ALL", t("expenses.all")], ["INCOME", t("expenses.income")], ["EXPENSE", t("expenses.expenses")]] as const).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    data-active={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
            <span className="eyebrow ml-auto">{entries.length} {t("expenses.entries")}</span>
          </div>

          {/* List */}
          <div
            className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {entries.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <Receipt className="h-6 w-6" />
                </span>
                <p className="text-[15px] font-semibold">No entries yet</p>
                <p className="mt-1 max-w-[360px] text-[13.5px] text-muted-foreground">
                  Add rent, electricity or a service charge — reports pick it up instantly.
                </p>
                <Button className="mt-4" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4" /> Add first entry
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {entries.map((entry) => {
                  const meta = CATEGORY_META[entry.category] ?? CATEGORY_META.Other
                  const Icon = meta.icon
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <span className={cn("grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl", meta.chip)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">
                          {entry.note || entry.category}
                        </p>
                        <p className="truncate text-[12.5px] text-muted-foreground">
                          {entry.category} · {relativeDay(entry.date)} · {entry.method}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-[15px] font-bold tabular-nums",
                          entry.type === "INCOME" ? "text-[#30d158]" : "text-[#ff453a]"
                        )}
                      >
                        {entry.type === "INCOME" ? "+" : "-"}
                        {formatINR(entry.amount)}
                      </p>
                      <button
                        type="button"
                        aria-label="Delete entry"
                        title="Delete entry"
                        onClick={() => {
                          if (window.confirm(`Delete "${entry.note || entry.category}" (${formatINR(entry.amount)})?`)) {
                            deleteExpense(entry.id)
                            notify(t("expenses.deleted"), "info")
                          }
                        }}
                        className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-[#ff453a] active:scale-90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      <AddEntryModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={(input) => {
          setShowAdd(false)
          notify(
            `${input.type === "INCOME" ? "Income" : "Expense"} of ${formatINR(input.amount)} added`,
            "success"
          )
        }}
      />
    </main>
  )
}

function AddEntryModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: {
    type: "INCOME" | "EXPENSE"
    category: ExpenseCategory
    amount: number
    date: string
    note: string
    method: Exclude<PaymentMethod, "UDHARI">
  }) => void
}) {
  const { addExpense } = useERP()
  const { t } = useLanguage()
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE")
  const [category, setCategory] = useState<ExpenseCategory>("Electricity")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState("")
  const [method, setMethod] = useState<Exclude<PaymentMethod, "UDHARI">>("CASH")

  const categories = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function switchType(next: "INCOME" | "EXPENSE") {
    setType(next)
    const list = next === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!list.includes(category)) setCategory(list[0])
  }

  function submit() {
    const value = Number(amount)
    if (!value || value <= 0) return
    addExpense({ type, category, amount: value, date, note: note.trim(), method })
    onSubmit({ type, category, amount: value, date, note: note.trim(), method })
    setAmount("")
    setNote("")
    setDate(todayISO())
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("expenses.addTitle")}
      subtitle="Shows up in Day Book and reports instantly"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("expenses.cancel")}
          </Button>
          <Button onClick={submit} disabled={!Number(amount) || Number(amount) <= 0}>
            <Plus className="h-4 w-4" /> {t("expenses.add")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="segmented" role="radiogroup" aria-label={t("expenses.type")}>
          <button
            type="button"
            role="radio"
            aria-checked={type === "EXPENSE"}
            data-active={type === "EXPENSE"}
            onClick={() => switchType("EXPENSE")}
            className="flex-1"
          >
            {t("expenses.expenseType")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={type === "INCOME"}
            data-active={type === "INCOME"}
            onClick={() => switchType("INCOME")}
            className="flex-1"
          >
            {t("expenses.incomeType")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("expenses.amount")}>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="2500"
              autoFocus
            />
          </Field>
          <Field label={t("expenses.date")}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label={t("expenses.category")}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="h-10 w-full appearance-none rounded-xl border border-input/70 bg-background px-3 text-[14px] text-foreground outline-none transition-all hover:border-input focus-visible:border-ring"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("expenses.note")}>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={type === "INCOME" ? "e.g. AC repair service" : "e.g. July electricity bill"}
          />
        </Field>

        <Field label={t("expenses.method")}>
          <div className="segmented" role="radiogroup" aria-label="Payment method">
            {(["CASH", "UPI", "CARD", "TRANSFER"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                data-active={method === m}
                onClick={() => setMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}
