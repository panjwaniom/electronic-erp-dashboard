"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
  ShoppingBag,
} from "lucide-react"
import { useERP } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import type { Sale } from "@/types"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { ReceiptBody } from "@/components/receipt"
import {
  billWhatsappText,
  currentMonth,
  formatINR,
  prettyDate,
  relativeDay,
  waLink,
} from "@/lib/erp/utils"

type Period = "ALL" | "MONTH" | "7D"

export default function SalesPage() {
  const { state, refundSale, notify } = useERP()
  const { t } = useLanguage()
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<Period>("ALL")
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Sale | null>(null)
  const [confirmRefund, setConfirmRefund] = useState<Sale | null>(null)
  const pageSize = 12

  const month = currentMonth()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const cutoff7 = new Date()
    cutoff7.setDate(cutoff7.getDate() - 7)
    const cutoff7iso = cutoff7.toISOString().slice(0, 10)
    return state.sales.filter((s) => {
      if (period === "MONTH" && !s.date.startsWith(month)) return false
      if (period === "7D" && s.date < cutoff7iso) return false
      if (!q) return true
      return (
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.customerName ?? "").toLowerCase().includes(q) ||
        s.items.some((i) => i.productName.toLowerCase().includes(q))
      )
    })
  }, [state.sales, search, period, month])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const stats = useMemo(() => {
    const scope =
      period === "MONTH"
        ? state.sales.filter((s) => s.date.startsWith(month))
        : state.sales
    const completed = scope.filter((s) => s.status !== "REFUNDED")
    const revenue = completed.reduce((sum, s) => sum + s.total, 0)
    const units = completed.reduce(
      (sum, s) => sum + s.items.reduce((n, i) => n + i.quantity, 0),
      0
    )
    const avg = completed.length > 0 ? revenue / completed.length : 0
    const refunded = scope.filter((s) => s.status === "REFUNDED").length
    return { revenue, count: completed.length, avg, units, refunded }
  }, [state.sales, period, month])

  const statCards = [
    { label: period === "MONTH" ? "Revenue this month" : "Revenue (all time)", value: formatINR(stats.revenue), cls: "text-[#30d158]" },
    { label: t("reports.bills"), value: String(stats.count), cls: "" },
    { label: "Average bill", value: formatINR(stats.avg), cls: "" },
    { label: "Units sold", value: String(stats.units), cls: "" },
  ]

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
              <p className="eyebrow mb-3">Transactions</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                {t("sales.title")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("sales.subtitle")}
              </p>
            </div>
            <Link href="/billing/new">
              <Button size="lg" className="shadow-lg shadow-primary/25">
                <Plus className="h-4.5 w-4.5" /> {t("billing.newBill")}
              </Button>
            </Link>
          </div>

          {/* Period stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 fade-in-up" style={{ animationDelay: "80ms" }}>
            {statCards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                <p className="eyebrow">{c.label}</p>
                <p className={`mt-1 text-[24px] font-bold tabular-nums ${c.cls}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Search + period */}
          <div className="toolbar flex flex-wrap items-center gap-3 fade-in-up" style={{ animationDelay: "140ms" }}>
            <div className="flex min-w-[240px] flex-1 items-center gap-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder={t("billing.searchPlaceholder")}
                className="h-9 border-0 bg-transparent px-0 hover:border-0 focus-visible:border-0 focus-visible:ring-0"
              />
            </div>
            <div className="segmented" role="tablist" aria-label="Filter period">
              {([["ALL", "All time"], ["MONTH", "This month"], ["7D", "Last 7 days"]] as const).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={period === value}
                    data-active={period === value}
                    onClick={() => {
                      setPeriod(value)
                      setPage(1)
                    }}
                  >
                    {label}
                  </button>
                )
              )}
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
                  <ShoppingBag className="h-6 w-6" />
                </span>
                <p className="text-[15px] font-semibold">No sales found</p>
                <p className="mt-1 max-w-[360px] text-[13.5px] text-muted-foreground">
                  {search || period !== "ALL"
                    ? "Try a different search or period."
                    : "Bills you save appear here with receipts."}
                </p>
                {!search && period === "ALL" && (
                  <Link href="/billing/new" className="mt-4">
                    <Button>
                      <Plus className="h-4 w-4" /> Create first bill
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b">
                      <th>{t("billing.invoice")}</th>
                      <th>{t("billing.customer")}</th>
                      <th>{t("billing.items")}</th>
                      <th>{t("billing.total")}</th>
                      <th>{t("billing.payment")}</th>
                      <th>{t("billing.status")}</th>
                      <th className="text-right">{t("billing.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((sale) => (
                      <tr
                        key={sale.id}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => setDetail(sale)}
                      >
                        <td>
                          <p className="font-semibold tabular-nums">{sale.invoiceNumber}</p>
                          <p className="text-[11.5px] text-muted-foreground">
                            {relativeDay(sale.date)}
                          </p>
                        </td>
                        <td>{sale.customerName ?? "Walk-in"}</td>
                        <td className="tabular-nums">{sale.items.length}</td>
                        <td className="font-semibold tabular-nums">{formatINR(sale.total)}</td>
                        <td>
                          <Badge variant="outline" className="font-semibold">
                            {sale.paymentMethod}
                          </Badge>
                        </td>
                        <td>
                          {sale.status === "REFUNDED" ? (
                            <Badge className="pill-down font-bold">REFUNDED</Badge>
                          ) : sale.paymentStatus === "PAID" ? (
                            <Badge className="pill-up font-bold">PAID</Badge>
                          ) : sale.paymentStatus === "OVERDUE" ? (
                            <Badge className="pill-down font-bold">OVERDUE</Badge>
                          ) : (
                            <Badge className="pill-warn font-bold">DUE</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              title="Share on WhatsApp"
                              onClick={() => share(sale)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-[#30d158]/12 hover:text-[#30d158] active:scale-90"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                            {sale.status !== "REFUNDED" && (
                              <button
                                type="button"
                                title="Refund (restocks inventory)"
                                onClick={() => setConfirmRefund(sale)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-[#ff453a]/12 hover:text-[#ff453a] active:scale-90"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
                    <span className="eyebrow">
                      {t("billing.showing")} {(safePage - 1) * pageSize + 1}–
                      {Math.min(safePage * pageSize, filtered.length)} {t("billing.of")} {filtered.length}
                      {stats.refunded > 0 ? ` · ${stats.refunded} ${t("billing.refunded")}` : ""}
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
              </>
            )}
          </div>
        </div>
      </section>

      {/* Receipt modal */}
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
              {detail.status !== "REFUNDED" && (
                <Button variant="outline" className="text-[#ff453a]" onClick={() => setConfirmRefund(detail)}>
                  <RotateCcw className="h-4 w-4" /> {t("sales.refund")}
                </Button>
              )}
            </>
          )
        }
      >
        {detail && <ReceiptBody sale={detail} business={state.business} />}
      </Modal>

      {/* Refund confirm */}
      <Modal
        open={!!confirmRefund}
        onClose={() => setConfirmRefund(null)}
        title="Refund this bill?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRefund(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-[#ff453a] text-white hover:bg-[#ff453a]/90"
              onClick={() => {
                if (!confirmRefund) return
                refundSale(confirmRefund.id)
                notify(`${confirmRefund.invoiceNumber} refunded — stock restored`, "info")
                setConfirmRefund(null)
                setDetail(null)
              }}
            >
              <RotateCcw className="h-4 w-4" /> {t("sales.refund")}
            </Button>
          </>
        }
      >
        {confirmRefund && (
          <div className="space-y-3 text-[14px]">
            <p>
              <span className="font-semibold">{confirmRefund.invoiceNumber}</span> ·{" "}
              {formatINR(confirmRefund.total)} · {confirmRefund.customerName ?? "Walk-in"}
            </p>
            <ul className="list-inside list-disc space-y-1 text-[13.5px] text-muted-foreground">
              <li>{confirmRefund.items.length} item(s) return to stock</li>
              <li>Udhaar credit on this bill is reversed</li>
              <li>Bill stays in history marked REFUNDED</li>
            </ul>
          </div>
        )}
      </Modal>
    </main>
  )
}
