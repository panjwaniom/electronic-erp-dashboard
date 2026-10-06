"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { FileText, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { useERP, customerBalance } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { computeGstSummary, computePnl, formatINR, prettyDate } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const axisTick = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
  fontFamily: "var(--font-geist-mono), monospace",
} as const

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--card-foreground)",
  fontSize: 13,
  boxShadow: "var(--shadow-2)",
} as const

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function monthLabel(prefix: string): string {
  const [y, m] = prefix.split("-")
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`
}

export default function ReportsPage() {
  const { state } = useERP()
  const { t } = useLanguage()
  const today = new Date()
  const thisYear = String(today.getFullYear())
  const [period, setPeriod] = useState<string>(thisYear)
  const [tab, setTab] = useState<"PNL" | "GST">("PNL")

  /* period options: this year + last 7 months */
  const periodOptions = useMemo(() => {
    const opts = [{ value: thisYear, label: `${t("reports.thisYear")} · ${thisYear}` }]
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      opts.push({ value: prefix, label: monthLabel(prefix) })
    }
    return opts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thisYear, t])

  const isYear = period.length === 4
  const periodLabel = isYear ? period : monthLabel(period)

  /* ── P&L ── */
  const pnl = useMemo(
    () => computePnl(state.sales, state.expenses, period),
    [state.sales, state.expenses, period]
  )

  const grossMargin =
    pnl.netRevenue > 0 ? (pnl.grossProfit / pnl.netRevenue) * 100 : 0
  const netMargin = pnl.netRevenue > 0 ? (pnl.netProfit / pnl.netRevenue) * 100 : 0

  /* ── GST ── */
  const gst = useMemo(
    () => computeGstSummary(state.sales, period),
    [state.sales, period]
  )

  /* ── 6-month trend (independent of period) ── */
  const trend = useMemo(() => {
    const rows: { month: string; revenue: number; bills: number; tax: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const inMonth = state.sales.filter((s) => s.date.startsWith(prefix) && s.status !== "REFUNDED")
      rows.push({
        month: MONTH_NAMES[d.getMonth()],
        revenue: inMonth.reduce((s, x) => s + x.total, 0),
        bills: inMonth.length,
        tax: inMonth.reduce((s, x) => s + x.tax, 0),
      })
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sales])

  /* ── Top customers ── */
  const topCustomers = useMemo(
    () =>
      state.customers
        .map((c) => ({ ...c, balance: customerBalance(c.id, state.ledger) }))
        .sort((a, b) => b.totalPurchases - a.totalPurchases)
        .slice(0, 5),
    [state.customers, state.ledger]
  )

  const expensesByCat = pnl.byCategory.filter((r) => r.type === "EXPENSE")
  const maxCat = Math.max(1, ...expensesByCat.map((r) => r.amount))

  const pnlRows = [
    { label: t("reports.grossSales"), value: pnl.grossSales },
    { label: t("reports.refunds"), value: -pnl.refunded, muted: pnl.refunded > 0 },
    { label: t("reports.netRevenue"), value: pnl.netRevenue, strong: true },
    { label: t("reports.cogs"), value: -pnl.cogs, muted: pnl.cogs > 0 },
    { label: t("reports.grossProfit"), value: pnl.grossProfit, strong: true, sub: `${grossMargin.toFixed(1)}% ${t("reports.margin")}` },
    { label: t("reports.opex"), value: -pnl.expenses, muted: pnl.expenses > 0 },
    { label: t("reports.otherIncome"), value: pnl.income, muted: pnl.income > 0 },
    {
      label: t("reports.netProfit"),
      value: pnl.netProfit,
      strong: true,
      final: true,
      sub: `${netMargin.toFixed(1)}% ${t("reports.margin")}`,
    },
  ]

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">Analytics</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">{t("reports.title")}</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("reports.subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="segmented" role="tablist" aria-label="Report type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "PNL"}
                  data-active={tab === "PNL"}
                  onClick={() => setTab("PNL")}
                >
                  {t("reports.pnl")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "GST"}
                  data-active={tab === "GST"}
                  onClick={() => setTab("GST")}
                >
                  {t("reports.gst")}
                </button>
              </div>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                aria-label="Report period"
                className="h-10 appearance-none rounded-xl border border-input/70 bg-card px-4 text-[13.5px] font-semibold text-foreground shadow-[var(--shadow-1)] outline-none transition-all hover:border-input focus-visible:border-ring"
              >
                {periodOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tab === "PNL" ? (
            <>
              {/* P&L stat cards */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 fade-in-up" style={{ animationDelay: "80ms" }}>
                <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                  <p className="eyebrow">{t("reports.netRevenue")}</p>
                  <p className="mt-1 text-[24px] font-bold tabular-nums">{formatINR(pnl.netRevenue)}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{periodLabel}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                  <p className="eyebrow">{t("reports.grossProfit")}</p>
                  <p className="mt-1 text-[24px] font-bold tabular-nums text-[#30d158]">
                    {formatINR(pnl.grossProfit)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {grossMargin.toFixed(1)}% {t("reports.margin")}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                  <p className="eyebrow">{t("reports.expenses")}</p>
                  <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff453a]">
                    {formatINR(pnl.expenses)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {expensesByCat.length} categories
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-2xl border px-5 py-4 shadow-[var(--shadow-1)]",
                    pnl.netProfit >= 0
                      ? "border-[#30d158]/40 bg-[#30d158]/[0.06]"
                      : "border-[#ff453a]/40 bg-[#ff453a]/[0.06]"
                  )}
                >
                  <p className="eyebrow">{t("reports.netProfit")}</p>
                  <p
                    className={cn(
                      "mt-1 flex items-center gap-1.5 text-[24px] font-bold tabular-nums",
                      pnl.netProfit >= 0 ? "text-[#30d158]" : "text-[#ff453a]"
                    )}
                  >
                    {pnl.netProfit >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatINR(pnl.netProfit)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {netMargin.toFixed(1)}% {t("reports.margin")}
                  </p>
                </div>
              </div>

              {/* Statement + expense breakdown */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div
                  className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
                  style={{ animationDelay: "160ms" }}
                >
                  <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                    <h3 className="font-accent text-[19px]">{t("reports.statement")}</h3>
                    <span className="eyebrow">{periodLabel}</span>
                  </div>
                  <ul className="px-5 py-2">
                    {pnlRows.map((row) => (
                      <li
                        key={row.label}
                        className={cn(
                          "flex items-baseline justify-between gap-3 border-b border-border/50 py-2.5 last:border-0",
                          row.strong && "border-t border-border pt-3"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[13.5px]",
                            row.strong ? "font-bold text-foreground" : "text-muted-foreground",
                            row.final && "text-[15px]"
                          )}
                        >
                          {row.label}
                          {row.sub && (
                            <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">
                              {row.sub}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "tabular-nums",
                            row.strong ? "font-bold" : "font-medium",
                            row.final
                              ? row.value >= 0
                                ? "text-[17px] text-[#30d158]"
                                : "text-[17px] text-[#ff453a]"
                              : row.value < 0
                                ? "text-[#ff453a]"
                                : ""
                          )}
                        >
                          {formatINR(row.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
                  style={{ animationDelay: "220ms" }}
                >
                  <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                    <h3 className="font-accent text-[19px]">{t("reports.whereMoneyWent")}</h3>
                    <span className="eyebrow">{t("reports.byCategory")}</span>
                  </div>
                  {expensesByCat.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-12 text-center">
                      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
                        <Wallet className="h-5 w-5" />
                      </span>
                      <p className="text-[14.5px] font-semibold">No expenses in {periodLabel}</p>
                      <Link href="/expenses" className="mt-3 arrow-link text-[12.5px] font-semibold text-[var(--ring)]">
                        Add an expense →
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-3.5 px-5 py-5">
                      {expensesByCat.map((row) => (
                        <li key={row.category}>
                          <div className="mb-1 flex items-baseline justify-between text-[13px]">
                            <span className="font-medium">{row.category}</span>
                            <span className="font-bold tabular-nums">{formatINR(row.amount)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#ff9f0a] to-[#ff375f] transition-all duration-700"
                              style={{ width: `${Math.max(4, (row.amount / maxCat) * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 6-month trend */}
              <div
                className="card-glow rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
                style={{ animationDelay: "280ms" }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-accent text-[19px]">{t("reports.revenueTrend")}</h3>
                  <span className="flex items-center gap-4 text-[12.5px] font-medium text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#0a84ff]" /> {t("reports.revenue")}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#30d158]" /> {t("reports.bills")}
                    </span>
                  </span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0a84ff" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#0a84ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} width={54} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0a84ff"
                        strokeWidth={2.5}
                        fill="url(#areaRev)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="bills"
                        stroke="#30d158"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top customers */}
              <div
                className="card-glow overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
                style={{ animationDelay: "340ms" }}
              >
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                  <h3 className="font-accent text-[19px]">{t("reports.topCustomers")}</h3>
                  <Link
                    href="/customers"
                    className="arrow-link text-[12.5px] font-semibold text-[var(--ring)]"
                  >
                    {t("reports.allCustomers")}
                  </Link>
                </div>
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b">
                        <th>{t("reports.customer")}</th>
                        <th>{t("reports.city")}</th>
                        <th>{t("reports.purchases")}</th>
                        <th>{t("reports.udhaar")}</th>
                        <th>{t("reports.lastPurchase")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((c) => (
                        <tr key={c.id} className="transition-colors hover:bg-muted/50">
                          <td className="font-semibold">{c.name}</td>
                          <td className="text-muted-foreground">{c.city || "—"}</td>
                          <td className="font-semibold tabular-nums">
                            {formatINR(c.totalPurchases)}
                          </td>
                          <td>
                            {c.balance > 0.5 ? (
                              <Badge className="pill-warn font-bold tabular-nums">
                                {formatINR(c.balance)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="text-muted-foreground">
                            {c.lastPurchase ? prettyDate(c.lastPurchase) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* GST summary cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 fade-in-up" style={{ animationDelay: "80ms" }}>
                <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                  <p className="eyebrow">{t("reports.taxable")}</p>
                  <p className="mt-1 text-[24px] font-bold tabular-nums">{formatINR(gst.totalTaxable)}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{periodLabel}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                  <p className="eyebrow">{t("reports.cgstSgst")}</p>
                  <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff9f0a]">
                    {formatINR(gst.totalTax)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {t("reports.cgst")} {formatINR(Math.round(gst.totalTax / 2))} · {t("reports.sgst")}{" "}
                    {formatINR(gst.totalTax - Math.round(gst.totalTax / 2))}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
                  <p className="eyebrow">{t("reports.invoices")}</p>
                  <p className="mt-1 text-[24px] font-bold tabular-nums">{gst.invoices}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{t("reports.taxInvoices")}</p>
                </div>
              </div>

              {/* Slab table */}
              <div
                className="card-glow overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
                style={{ animationDelay: "160ms" }}
              >
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                  <h3 className="font-accent flex items-center gap-2 text-[19px]">
                    <Receipt className="h-4.5 w-4.5 text-[var(--ring)]" />
                    {t("reports.bySlab")}
                  </h3>
                  <span className="eyebrow">{periodLabel}</span>
                </div>
                {gst.slabs.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                      <FileText className="h-6 w-6" />
                    </span>
                    <p className="text-[15px] font-semibold">No taxable sales</p>
                    <p className="mt-1 max-w-[340px] text-[13.5px] text-muted-foreground">
                      Bills saved in {periodLabel} will populate this GST summary.
                    </p>
                  </div>
                ) : (
                  <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead>
                        <tr className="border-b">
                          <th>{t("reports.rate")}</th>
                          <th>{t("reports.taxable")}</th>
                          <th>{t("reports.cgst")}</th>
                          <th>{t("reports.sgst")}</th>
                          <th>{t("reports.totalTax")}</th>
                          <th>{t("reports.invoices")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gst.slabs.map((s) => (
                          <tr key={s.rate} className="transition-colors hover:bg-muted/50">
                            <td>
                              <Badge variant="outline" className="font-bold tabular-nums">
                                {s.rate}%
                              </Badge>
                            </td>
                            <td className="font-semibold tabular-nums">{formatINR(s.taxable)}</td>
                            <td className="tabular-nums">{formatINR(s.cgst)}</td>
                            <td className="tabular-nums">{formatINR(s.sgst)}</td>
                            <td className="font-semibold tabular-nums text-[#ff9f0a]">
                              {formatINR(s.cgst + s.sgst)}
                            </td>
                            <td className="tabular-nums text-muted-foreground">{s.invoices}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-border bg-background/50 font-bold">
                          <td>Total</td>
                          <td className="tabular-nums">{formatINR(gst.totalTaxable)}</td>
                          <td className="tabular-nums">{formatINR(Math.round(gst.totalTax / 2))}</td>
                          <td className="tabular-nums">
                            {formatINR(gst.totalTax - Math.round(gst.totalTax / 2))}
                          </td>
                          <td className="tabular-nums text-[#ff9f0a]">{formatINR(gst.totalTax)}</td>
                          <td className="tabular-nums">{gst.invoices}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="border-t border-border/70 px-5 py-3 text-[12px] text-muted-foreground">
                  {t("reports.intraState")}
                </p>
              </div>

              {/* GST monthly chart */}
              <div
                className="card-glow rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
                style={{ animationDelay: "220ms" }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-accent text-[19px]">{t("reports.taxByMonth")}</h3>
                  <span className="eyebrow">{t("reports.last6")}</span>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="taxGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ff9f0a" stopOpacity={1} />
                          <stop offset="100%" stopColor="#ff375f" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} width={54} />
                      <Tooltip
                        cursor={{ fill: "color-mix(in srgb, var(--muted) 60%, transparent)" }}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="tax" fill="url(#taxGrad)" radius={[8, 8, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
