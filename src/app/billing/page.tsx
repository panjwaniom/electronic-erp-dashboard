"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Send,
  Wallet,
  Printer,
  Receipt,
} from "lucide-react"
import { useERP, saleOutstanding, customerBalance } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import type { PaymentMethod, Sale } from "@/types"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Modal, Field } from "@/components/ui/modal"
import { ReceiptBody } from "@/components/receipt"
import {
  billWhatsappText,
  formatINR,
  prettyDate,
  relativeDay,
  todayISO,
  waLink,
} from "@/lib/erp/utils"

function StatusPill({ sale }: { sale: Sale }) {
  const { t } = useLanguage()
  if (sale.status === "REFUNDED")
    return <Badge className="bg-muted font-bold text-muted-foreground">{t("billing.refunded")}</Badge>
  switch (sale.paymentStatus) {
    case "PAID":
      return <Badge className="pill-up font-bold">{t("billing.paid")}</Badge>
    case "PENDING":
      return <Badge className="pill-warn font-bold">{t("billing.due")}</Badge>
    case "OVERDUE":
      return <Badge className="pill-down font-bold">{t("dash.overdue")}</Badge>
    default:
      return <Badge>{sale.paymentStatus}</Badge>
  }
}

/* Shared receipt lives in @/components/receipt (also used by Sales) */

export default function BillingPage() {
  const { state, collectPayment, notify } = useERP()
  const { t } = useLanguage()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"ALL" | "PAID" | "DUE">("ALL")
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Sale | null>(null)
  const [collectFor, setCollectFor] = useState<Sale | null>(null)
  const pageSize = 15

  /* ⌘B / Ctrl+B — jump straight to the counter */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        router.push("/billing/new")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  const sales = state.sales

  const totals = useMemo(() => {
    const todayStr = todayISO()
    const today = sales.filter((s) => s.date === todayStr)
    const collectedToday =
      today
        .filter((s) => s.paymentMethod !== "UDHARI" && s.status !== "REFUNDED")
        .reduce((sum, s) => sum + s.total, 0) +
      state.ledger
        .filter((l) => l.date === todayStr && l.type === "PAYMENT")
        .reduce((sum, l) => sum + l.amount, 0)
    /* Net of advances, so this matches "Udhaar out" on Dashboard and the
       Customers list — one receivables figure across the whole product. */
    const outstanding = state.customers.reduce(
      (sum, c) => sum + Math.max(0, customerBalance(c.id, state.ledger)),
      0
    )
    return { billsToday: today.length, collectedToday, outstanding }
  }, [sales, state.ledger, state.customers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sales.filter((s) => {
      if (filter === "PAID" && (s.paymentStatus !== "PAID" || s.status === "REFUNDED"))
        return false
      if (
        filter === "DUE" &&
        (s.status === "REFUNDED" ||
          (s.paymentStatus !== "PENDING" && s.paymentStatus !== "OVERDUE"))
      )
        return false
      if (!q) return true
      return (
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.customerName ?? "").toLowerCase().includes(q) ||
        s.items.some((i) => i.productName.toLowerCase().includes(q))
      )
    })
  }, [sales, query, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function share(sale: Sale) {
    const text = billWhatsappText(sale, state.business)
    const link = sale.customerPhone ? waLink(sale.customerPhone, text) : null
    if (link) window.open(link, "_blank", "noopener")
    else {
      try {
        await navigator.clipboard.writeText(text)
        notify("No phone on this customer — bill text copied", "info")
      } catch {
        notify("Could not copy bill text", "error")
      }
    }
  }

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">{t("billing.finance")}</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                {t("billing.title")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("billing.subtitle")}
              </p>
            </div>
            <Link href="/billing/new">
              <Button size="lg" className="shadow-lg shadow-primary/25">
                <Plus className="h-4.5 w-4.5" /> {t("billing.newBill")}
                <kbd className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold">
                  ⌘B
                </kbd>
              </Button>
            </Link>
          </div>

          {/* Summary chips */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 fade-in-up" style={{ animationDelay: "80ms" }}>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("billing.billsToday")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums">{totals.billsToday}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("billing.collectedToday")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#30d158]">
                {formatINR(totals.collectedToday)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("billing.outstanding")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff9f0a]">
                {formatINR(totals.outstanding)}
              </p>
            </div>
          </div>

          {/* Search + filters */}
          <div className="toolbar flex flex-wrap items-center gap-3 fade-in-up" style={{ animationDelay: "140ms" }}>
            <div className="flex min-w-[240px] flex-1 items-center gap-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder={t("billing.searchPlaceholder")}
                className="h-9 border-0 bg-transparent px-0 hover:border-0 focus-visible:border-0 focus-visible:ring-0"
              />
            </div>
            <div className="segmented" role="tablist" aria-label="Filter bills">
              {(["ALL", "PAID", "DUE"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  data-active={filter === f}
                  onClick={() => {
                    setFilter(f)
                    setPage(1)
                  }}
                >
                  {f === "ALL" ? t("billing.all") : f === "PAID" ? t("billing.paid") : t("billing.due")}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div
            className="card-glow overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <Receipt className="h-6 w-6" />
                </span>
                <p className="text-[15px] font-semibold">{t("billing.noBills")}</p>
                <p className="mt-1 max-w-[360px] text-[13.5px] text-muted-foreground">
                  {query || filter !== "ALL"
                    ? t("billing.noBillsHint")
                    : "Bills you save will appear here instantly."}
                </p>
                {!query && filter === "ALL" && (
                  <Link href="/billing/new" className="mt-4">
                    <Button>
                      <Plus className="h-4 w-4" /> Create first bill
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b">
                      <th>{t("billing.invoice")}</th>
                      <th>{t("billing.customer")}</th>
                      <th>{t("billing.items")}</th>
                      <th>{t("billing.total")}</th>
                      <th>{t("billing.status")}</th>
                      <th>{t("billing.payment")}</th>
                      <th className="text-right">{t("billing.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s) => {
                      const due = saleOutstanding(s, state.ledger)
                      return (
                        <tr
                          key={s.id}
                          className="cursor-pointer"
                          onClick={() => setDetail(s)}
                        >
                          <td>
                            <p className="font-semibold tabular-nums">{s.invoiceNumber}</p>
                            <p className="text-[11.5px] text-muted-foreground">
                              {relativeDay(s.date)}
                            </p>
                          </td>
                          <td>{s.customerName ?? "Walk-in"}</td>
                          <td className="tabular-nums">{s.items.length}</td>
                          <td className="font-semibold tabular-nums">
                            {formatINR(s.total)}
                            {due > 0 && (
                              <p className="text-[11.5px] font-medium text-[#ff9f0a]">
                                {formatINR(due)} {t("billing.due")}
                              </p>
                            )}
                          </td>
                          <td>
                            <StatusPill sale={s} />
                          </td>
                          <td>
                            <Badge variant="outline" className="font-semibold">
                              {s.paymentMethod}
                            </Badge>
                          </td>
                          <td>
                            <div
                              className="flex justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {due > 0 && (
                                <button
                                  type="button"
                                  title={t("customer.collect")}
                                  onClick={() => setCollectFor(s)}
                                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-[#30d158]/12 hover:text-[#30d158] active:scale-90"
                                >
                                  <Wallet className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                title={t("newbill.shareWhatsapp")}
                                onClick={() => share(s)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-[#30d158]/12 hover:text-[#30d158] active:scale-90"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title={t("newbill.print")}
                                onClick={() => setDetail(s)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
                <span className="eyebrow">
                  {t("billing.showing")} {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, filtered.length)} {t("billing.of")} {filtered.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                  >
                    {t("common.prev")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
                  >
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Detail / receipt modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.invoiceNumber ?? ""}
        subtitle={detail ? `${prettyDate(detail.date)} · ${detail.paymentMethod}` : undefined}
        size="wide"
        footer={
          detail && (
            <>
              <Button variant="ghost" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> {t("sales.print")}
              </Button>
              <Button variant="outline" onClick={() => share(detail)}>
                <Send className="h-4 w-4" /> WhatsApp
              </Button>
              {saleOutstanding(detail, state.ledger) > 0 && (
                <Button onClick={() => setCollectFor(detail)}>
                  <Wallet className="h-4 w-4" /> {t("customer.collect")} {formatINR(saleOutstanding(detail, state.ledger))}
                </Button>
              )}
            </>
          )
        }
      >
        {detail && <ReceiptBody sale={detail} business={state.business} />}
      </Modal>

      {/* Collect payment modal */}
      <CollectModal
        sale={collectFor}
        onClose={() => setCollectFor(null)}
        onCollect={(amount, method) => {
          if (!collectFor) return
          const allocated = collectPayment({
            customerId: collectFor.customerId!,
            amount,
            method,
            saleId: collectFor.id,
          })
          notify(`Received ${formatINR(allocated)} against ${collectFor.invoiceNumber}`, "success")
          setCollectFor(null)
          setDetail(null)
        }}
      />
    </main>
  )
}

function CollectModal({
  sale,
  onClose,
  onCollect,
}: {
  sale: Sale | null
  onClose: () => void
  onCollect: (amount: number, method: Exclude<PaymentMethod, "UDHARI">) => void
}) {
  const { state } = useERP()
  const { t } = useLanguage()
  const due = sale ? saleOutstanding(sale, state.ledger) : 0
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<Exclude<PaymentMethod, "UDHARI">>("CASH")

  const value = amount === "" ? due : Math.min(Number(amount) || 0, due)

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={t("customer.collect")}
      subtitle={sale ? `${sale.customerName ?? "Customer"} · ${sale.invoiceNumber}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={value <= 0}
            onClick={() => onCollect(value, method)}
            className="shadow-lg shadow-primary/25"
          >
            <Wallet className="h-4 w-4" /> {t("customer.receive")} {formatINR(value)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-background/60 p-4 text-center">
          <p className="eyebrow">Outstanding</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums text-[#ff9f0a]">
            {formatINR(due)}
          </p>
        </div>
        <Field label="Amount received" hint={`Full ${formatINR(due)} or a part payment`}>
          <Input
            type="number"
            min={1}
            max={due}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(due)}
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
