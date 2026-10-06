"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  ChevronRight,
  Receipt,
  Send,
  User,
  Wallet,
} from "lucide-react"
import { useERP, customerBalance } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import type { LedgerEntry } from "@/types"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Modal, Field } from "@/components/ui/modal"
import { formatINR, relativeDay } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"

const TYPE_META: Record<
  LedgerEntry["type"],
  { label: string; chip: string; sign: "up" | "down" | "flat" }
> = {
  CREDIT: { label: "Udhaar given", chip: "bg-[#ff9f0a]/14 text-[#ff9f0a]", sign: "up" },
  PAYMENT: { label: "Payment received", chip: "bg-[#30d158]/12 text-[#30d158]", sign: "down" },
  ADJUST: { label: "Adjustment", chip: "bg-[#0a84ff]/12 text-[#0a84ff]", sign: "flat" },
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const { state, notify } = useERP()
  const { t } = useLanguage()
  const [showReceive, setShowReceive] = useState(false)

  const customer = state.customers.find((c) => c.id === params.id) ?? null
  const balance = customer ? customerBalance(customer.id, state.ledger) : 0

  const bills = useMemo(
    () =>
      state.sales
        .filter((s) => s.customerId === params.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.sales, params.id]
  )

  /* Ledger with running balance (ascending compute, descending display).
     Keyed on the route param so the value stays memoizable. */
  const ledger = useMemo(() => {
    const rows = state.ledger
      .filter((l) => l.customerId === params.id)
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
    const withRunning = rows.reduce<Array<LedgerEntry & { running: number }>>(
      (acc, l) => {
        const delta =
          l.type === "CREDIT" ? l.amount : l.type === "PAYMENT" ? -l.amount : l.amount
        const previous = acc.length ? acc[acc.length - 1].running : 0
        acc.push({ ...l, running: previous + delta })
        return acc
      },
      []
    )
    return withRunning.reverse()
  }, [state.ledger, params.id])

  if (!customer) {
    return (
      <main className="min-h-screen bg-background antialiased">
        <section className="mx-auto max-w-[900px] px-5 py-16 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <User className="h-7 w-7" />
          </span>
          <h1 className="text-[26px] font-bold tracking-[-0.03em]">Customer not found</h1>
          <p className="mt-2 text-[14.5px] text-muted-foreground">
            This customer may have been removed.
          </p>
          <Link href="/customers" className="mt-5 inline-block">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Back to customers
            </Button>
          </Link>
        </section>
      </main>
    )
  }

  const due = balance > 0.5
  const stats = [
    { label: t("customer.totalPurchases"), value: formatINR(customer.totalPurchases) },
    { label: t("customer.bills"), value: String(bills.length) },
    {
      label: due ? "Udhaar balance" : balance < -0.5 ? t("customer.advanceWithUs") : "Udhaar balance",
      value: formatINR(Math.abs(balance)),
      cls: due ? "text-[#ff9f0a]" : balance < -0.5 ? "text-[#30d158]" : "",
    },
    {
      label: t("reports.lastPurchase"),
      value: customer.lastPurchase ? relativeDay(customer.lastPurchase) : "—",
    },
  ]

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1100px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="fade-in-up">
            <Link
              href="/customers"
              className="arrow-link mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ring)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("customers.title")}
            </Link>
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0a84ff] to-[#64d2ff] text-[18px] font-bold text-white">
                {customer.name
                  .split(" ")
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-1.5">{t("billing.customer")}</p>
                <h1 className="text-[30px] font-bold tracking-[-0.035em] md:text-[36px]">
                  {customer.name}
                </h1>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  {customer.city || "—"}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {customer.phone && (
                  <a
                    href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Chat on WhatsApp"
                    className="grid h-10 w-10 place-items-center rounded-xl border border-border/70 bg-card text-[#30d158] shadow-[var(--shadow-1)] transition-all hover:bg-[#30d158]/10 active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                  </a>
                )}
                {due && (
                  <Button size="lg" className="shadow-lg shadow-primary/25" onClick={() => setShowReceive(true)}>
                    <Wallet className="h-4.5 w-4.5" /> {t("customer.receive")} {formatINR(balance)}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 fade-in-up" style={{ animationDelay: "80ms" }}>
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                <p className="eyebrow">{s.label}</p>
                <p className={cn("mt-1 text-[21px] font-bold tabular-nums", s.cls)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Outstanding banner */}
          {due && (
            <div
              className="fade-in-up flex flex-wrap items-center gap-4 rounded-2xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/[0.07] px-5 py-4"
              style={{ animationDelay: "120ms" }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff9f0a]/15 text-[#ff9f0a]">
                <Wallet className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-bold text-[#ff9f0a]">
                  {formatINR(balance)} outstanding
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  Spread across {bills.filter((b) => b.paymentStatus !== "PAID" && b.status !== "REFUNDED").length}{" "}
                  unpaid bill(s)
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowReceive(true)}>
                <Wallet className="h-4 w-4" /> Receive payment
              </Button>
            </div>
          )}

          {/* Ledger */}
          <div
            className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Wallet className="h-4 w-4 text-[var(--ring)]" />
                Udhaar ledger
              </h2>
              <span className="eyebrow">{ledger.length} entries</span>
            </div>
            {ledger.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <p className="text-[14.5px] font-semibold">No udhaar transactions</p>
                <p className="mt-1 max-w-[340px] text-[13px] text-muted-foreground">
                  Bills saved on udhaar for {customer.name} appear here with running balance.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {ledger.map((entry) => {
                  const meta = TYPE_META[entry.type]
                  return (
                    <li key={entry.id} className="flex items-center gap-4 px-5 py-3.5">
                      <span className={cn("grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-[11px] font-bold", meta.chip)}>
                        {entry.type === "CREDIT" ? "+" : entry.type === "PAYMENT" ? "−" : "±"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{meta.label}</p>
                        <p className="truncate text-[12.5px] text-muted-foreground">
                          {relativeDay(entry.date)} · {entry.reference}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-[14.5px] font-bold tabular-nums",
                            meta.sign === "up" && "text-[#ff9f0a]",
                            meta.sign === "down" && "text-[#30d158]",
                            meta.sign === "flat" && "text-[#0a84ff]"
                          )}
                        >
                          {entry.type === "CREDIT"
                            ? "+"
                            : entry.type === "PAYMENT"
                              ? "−"
                              : entry.type === "ADJUST"
                                ? entry.amount < 0
                                  ? "−"
                                  : "+"
                                : ""}
                          {formatINR(Math.abs(entry.amount))}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground tabular-nums">
                          balance {formatINR(Math.abs(entry.running) < 0.5 ? 0 : entry.running)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Bills */}
          <div
            className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "220ms" }}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Receipt className="h-4 w-4 text-[var(--ring)]" />
                Bills
              </h2>
              <span className="eyebrow">{bills.length} bills</span>
            </div>
            {bills.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <p className="text-[14.5px] font-semibold">No bills yet</p>
                <p className="mt-1 max-w-[340px] text-[13px] text-muted-foreground">
                  Select {customer.name} at the counter to bill them.
                </p>
                <Link href="/billing/new" className="mt-4">
                  <Button size="sm">
                    <Receipt className="h-4 w-4" /> New bill
                  </Button>
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {bills.map((b) => (
                  <li key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold tabular-nums">
                        {b.invoiceNumber}
                      </p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {relativeDay(b.date)} · {b.items.length} item(s) · {b.paymentMethod}
                      </p>
                    </div>
                    <p className="text-[14.5px] font-bold tabular-nums">{formatINR(b.total)}</p>
                    {b.status === "REFUNDED" ? (
                      <Badge className="pill-down font-bold">REFUNDED</Badge>
                    ) : b.paymentStatus === "PAID" ? (
                      <Badge className="pill-up font-bold">PAID</Badge>
                    ) : b.paymentStatus === "OVERDUE" ? (
                      <Badge className="pill-down font-bold">OVERDUE</Badge>
                    ) : (
                      <Badge className="pill-warn font-bold">DUE</Badge>
                    )}
                    <Link
                      href="/sales"
                      title="Open in sales history"
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <ReceiveModal
        open={showReceive}
        balance={balance}
        customerName={customer.name}
        customerId={customer.id}
        onClose={() => setShowReceive(false)}
        onDone={(allocated) =>
          notify(`Received ${formatINR(allocated)} from ${customer.name}`, "success")
        }
      />
    </main>
  )
}

function ReceiveModal({
  open,
  balance,
  customerName,
  customerId,
  onClose,
  onDone,
}: {
  open: boolean
  balance: number
  customerName: string
  customerId: string
  onClose: () => void
  onDone: (allocated: number) => void
}) {
  const { collectPayment } = useERP()
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"CASH" | "UPI" | "CARD" | "TRANSFER">("CASH")

  const value = amount === "" ? balance : Math.min(Number(amount) || 0, balance)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive payment"
      subtitle={`${customerName} · outstanding ${formatINR(balance)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={value <= 0}
            className="shadow-lg shadow-primary/25"
            onClick={() => {
              const allocated = collectPayment({ customerId, amount: value, method })
              onDone(allocated)
              setAmount("")
              onClose()
            }}
          >
            <Wallet className="h-4 w-4" /> Receive {formatINR(value)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-background/60 p-4 text-center">
          <p className="eyebrow">Outstanding udhaar</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums text-[#ff9f0a]">
            {formatINR(balance)}
          </p>
        </div>
        <Field label="Amount received" hint={`Full ${formatINR(balance)} or a part payment`}>
          <Input
            type="number"
            min={1}
            max={balance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(Math.round(balance))}
            autoFocus
          />
        </Field>
        <Field label="Received via">
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
