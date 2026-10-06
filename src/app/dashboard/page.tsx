"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  IndianRupee,
  Package,
  Plus,
  Receipt,
  Users,
  Wallet,
} from "lucide-react"
import { useERP, customerBalance, isLowStock } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui"
import {
  buildDayBook,
  daysAgoISO,
  formatINR,
  prettyDate,
  todayISO,
} from "@/lib/erp/utils"
import { cn } from "@/lib/utils"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const COLORS = ["#0a84ff", "#30d158", "#ff9f0a", "#ff375f", "#64d2ff"]

export default function DashboardPage() {
  const { state } = useERP()
  const { t, tx } = useLanguage()
  const today = todayISO()
  const yesterday = daysAgoISO(1)
  const month = today.slice(0, 7)

  /* ── live stats ── */
  const stats = useMemo(() => {
    const active = state.sales.filter((s) => s.status !== "REFUNDED")
    const todays = active.filter((s) => s.date === today)
    const yesterdays = active.filter((s) => s.date === yesterday)
    const salesToday = todays.reduce((sum, s) => sum + s.total, 0)
    const salesYesterday = yesterdays.reduce((sum, s) => sum + s.total, 0)

    const collectedToday =
      todays
        .filter((s) => s.paymentMethod !== "UDHARI")
        .reduce((sum, s) => sum + s.total, 0) +
      state.ledger
        .filter((l) => l.date === today && l.type === "PAYMENT")
        .reduce((sum, l) => sum + l.amount, 0)

    const debtors = state.customers
      .map((c) => ({ c, bal: customerBalance(c.id, state.ledger) }))
      .filter((x) => x.bal > 0.5)
    const udhariTotal = debtors.reduce((s, x) => s + x.bal, 0)

    const low = state.products.filter(isLowStock)
    const out = low.filter((p) => p.currentStock === 0)

    const trend =
      salesYesterday > 0
        ? Math.round(((salesToday - salesYesterday) / salesYesterday) * 100)
        : null

    return {
      salesToday,
      billsToday: todays.length,
      collectedToday,
      udhariTotal,
      debtorCount: debtors.length,
      topDebtors: debtors.sort((a, b) => b.bal - a.bal).slice(0, 3),
      low,
      out,
      trend,
    }
  }, [state, today, yesterday])

  /* ── today's activity (mini day book) ── */
  const activity = useMemo(
    () => buildDayBook(today, state.sales, state.ledger, state.expenses, state.stock).slice(0, 6),
    [today, state.sales, state.ledger, state.expenses, state.stock]
  )

  /* ── top products this month (by units) ── */
  const topProducts = useMemo(() => {
    const agg = new Map<string, { name: string; units: number }>()
    state.sales
      .filter((s) => s.date.startsWith(month) && s.status !== "REFUNDED")
      .forEach((s) =>
        s.items.forEach((i) => {
          const cur = agg.get(i.productId) ?? { name: i.productName, units: 0 }
          cur.units += i.quantity
          agg.set(i.productId, cur)
        })
      )
    return [...agg.values()].sort((a, b) => b.units - a.units).slice(0, 5)
  }, [state.sales, month])

  const recentCustomers = useMemo(
    () =>
      [...state.customers]
        .sort((a, b) => (b.lastPurchase ?? b.createdAt).localeCompare(a.lastPurchase ?? a.createdAt))
        .slice(0, 5),
    [state.customers]
  )

  const statCards = [
    {
      label: t("dash.salesToday"),
      value: formatINR(stats.salesToday),
      sub:
        stats.trend !== null
          ? `${stats.trend >= 0 ? "+" : ""}${stats.trend}% ${t("dash.vsYesterday")}`
          : `${stats.billsToday} bill${stats.billsToday === 1 ? "" : "s"} today`,
      trendUp: (stats.trend ?? 0) >= 0,
      href: "/billing",
      link: t("billing.title"),
      icon: IndianRupee,
      orb: "from-[#0a84ff] to-[#64d2ff]",
      glow: "shadow-[0_8px_24px_rgba(10,132,255,0.35)]",
    },
    {
      label: t("dash.collectedToday"),
      value: formatINR(stats.collectedToday),
      sub: t("dash.collectedSub"),
      href: "/daybook",
      link: t("daybook.title"),
      icon: Wallet,
      orb: "from-[#30d158] to-[#00c7be]",
      glow: "shadow-[0_8px_24px_rgba(48,209,88,0.32)]",
    },
    {
      label: t("dash.udhaarOut"),
      value: formatINR(stats.udhariTotal),
      sub:
        stats.debtorCount > 0
          ? `${stats.debtorCount} ${t("dash.oweYou")}`
          : t("dash.settled"),
      href: "/customers",
      link: t("dash.collectDues"),
      icon: Users,
      orb: "from-[#ff9f0a] to-[#ff375f]",
      glow: "shadow-[0_8px_24px_rgba(255,159,10,0.32)]",
      warn: stats.debtorCount > 0,
    },
    {
      label: t("dash.lowStock"),
      value: String(stats.low.length),
      sub:
        stats.low.length > 0
          ? `${stats.out.length} out of stock · ${t("dash.restockSoon")}`
          : t("dash.allHealthy"),
      href: "/stock",
      link: t("dash.manageStock"),
      icon: Package,
      orb: "from-[#ffcc00] to-[#ff9f0a]",
      glow: "shadow-[0_8px_24px_rgba(255,204,0,0.3)]",
      warn: stats.low.length > 0,
    },
  ]

  const pieData = topProducts.map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
    value: p.units,
  }))

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header + quick action */}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">{t("dash.overview")}</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                {t("dash.title")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {prettyDate(today)} — {t("dash.subtitle")}
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/daybook">
                <Button variant="outline" size="lg">
                  <BookOpen className="h-4.5 w-4.5" /> {t("daybook.title")}
                </Button>
              </Link>
              <Link href="/billing/new">
                <Button size="lg" className="shadow-lg shadow-primary/25">
                  <Plus className="h-4.5 w-4.5" /> {t("billing.newBill")}
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, i) => {
              const Icon = stat.icon
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="card-glow hover-lift rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
                  style={{ animationDelay: `${100 + i * 80}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br transition-transform duration-300",
                        stat.orb,
                        stat.glow
                      )}
                    >
                      <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
                    </span>
                    {stat.trendUp !== undefined && stats.trend !== null && (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
                          stat.trendUp ? "pill-up" : "pill-down"
                        )}
                      >
                        {stats.trend! >= 0 ? "▲" : "▼"} {Math.abs(stats.trend!)}%
                      </span>
                    )}
                    {stat.warn && (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff9f0a]/15 text-[#ff9f0a]">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <p className="mt-5 text-[13px] font-medium text-muted-foreground">{stat.label}</p>
                  <p className="stat-value mt-1 text-[30px] font-bold tracking-[-0.03em] tabular-nums">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{stat.sub}</p>
                  <span className="arrow-link mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ring)]">
                    {stat.link}
                    <span className="arr">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Low stock alert */}
          {stats.low.length > 0 && (
            <Link
              href="/stock"
              className="fade-in-up flex w-full items-center gap-3 rounded-2xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/[0.07] px-5 py-4 transition-all hover:bg-[#ff9f0a]/[0.12]"
              style={{ animationDelay: "380ms" }}
            >
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[#ff9f0a]/15 text-[#ff9f0a]">
                <AlertTriangle className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-[#ff9f0a]">
                  {tx("dash.restockBanner", { n: stats.low.length })}
                </span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {stats.low.slice(0, 4).map((p) => `${p.name} (${p.currentStock})`).join(" · ")}
                </span>
              </span>
              <span className="eyebrow flex-shrink-0">Review →</span>
            </Link>
          )}

          {/* Activity + Dues */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Today's activity */}
            <div
              className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
              style={{ animationDelay: "440ms" }}
            >
              <div className="mb-1 flex items-center justify-between border-b border-border/70 px-5 py-4">
                <h3 className="font-accent text-[19px]">{t("dash.activity")}</h3>
                <Link
                  href="/daybook"
                  className="arrow-link inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ring)]"
                >
                  {t("daybook.title")}
                  <span className="arr">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <Receipt className="h-5 w-5" />
                  </span>
                  <p className="text-[14.5px] font-semibold">Nothing yet today</p>
                  <p className="mt-1 max-w-[300px] text-[13px] text-muted-foreground">
                    Save your first bill — it will show up here instantly.
                  </p>
                  <Link href="/billing/new" className="mt-4">
                    <Button size="sm">
                      <Plus className="h-4 w-4" /> {t("billing.newBill")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold">{entry.title}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {entry.subtitle}
                        </p>
                      </div>
                      {entry.amount !== 0 &&
                        (() => {
                          const isRefunded = (entry.subtitle ?? "").includes("REFUNDED")
                        const amountText = isRefunded
                          ? `+${formatINR(Math.abs(entry.amount))}`
                          : entry.kind === "ADJUST"
                            ? formatINR(entry.amount)
                            : `${entry.kind === "EXPENSE" ? "-" : entry.kind === "CREDIT" ? "" : "+"}${formatINR(Math.abs(entry.amount))}`
                        const amountCls = isRefunded
                          ? "text-muted-foreground line-through decoration-[#ff453a]/70"
                          : entry.kind === "ADJUST"
                            ? "text-[#0a84ff]"
                            : entry.kind === "EXPENSE"
                              ? "text-[#ff453a]"
                              : entry.kind === "CREDIT"
                                ? "text-[#ff9f0a]"
                                : "text-[#30d158]"
                        return (
                          <p className={cn("text-[13.5px] font-bold tabular-nums", amountCls)}>
                            {amountText}
                          </p>
                        )
                      })()}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Udhari dues */}
            <div
              className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
              style={{ animationDelay: "520ms" }}
            >
              <div className="mb-1 flex items-center justify-between border-b border-border/70 px-5 py-4">
                <h3 className="font-accent text-[19px]">{t("dash.udhaarToCollect")}</h3>
                <Link
                  href="/customers"
                  className="arrow-link inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ring)]"
                >
                  {t("dash.allCustomers")}
                  <span className="arr">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
              {stats.topDebtors.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#30d158]/12 text-[#30d158]">
                    <Wallet className="h-5 w-5" />
                  </span>
                  <p className="text-[14.5px] font-semibold">No dues pending</p>
                  <p className="mt-1 max-w-[300px] text-[13px] text-muted-foreground">
                    Everyone&apos;s accounts are settled. Udhari bills land here automatically.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {stats.topDebtors.map((d, i) => (
                    <li key={d.c.id}>
                      <Link
                        href={`/customers/${d.c.id}`}
                        className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-muted/40"
                      >
                        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0a84ff] to-[#64d2ff] text-[12px] font-bold text-white">
                          {d.c.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold">{d.c.name}</p>
                          <p className="text-[12px] text-muted-foreground">{d.c.city || "—"}</p>
                        </div>
                        <Badge className="pill-warn font-bold tabular-nums">
                          {formatINR(d.bal)}
                        </Badge>
                        {i === 0 && stats.topDebtors.length > 1 && (
                          <span className="eyebrow hidden sm:block">{t("dash.highest")}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Top products + recent customers */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className="card-glow rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
              style={{ animationDelay: "580ms" }}
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-accent text-[19px]">Top products this month</h3>
                <span className="eyebrow">by units</span>
              </div>
              {pieData.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <p className="text-[14px] font-semibold">No sales this month yet</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Bill an item to see it charted here.
                  </p>
                </div>
              ) : (
                <div className="h-[280px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={96}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          color: "var(--card-foreground)",
                          fontSize: 13,
                          boxShadow: "var(--shadow-2)",
                        }}
                      />
                      <Legend iconType="circle" iconSize={9} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div
              className="card-glow rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
              style={{ animationDelay: "640ms" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-accent text-[19px]">{t("dash.recentCustomers")}</h3>
                <Link
                  href="/customers"
                  className="arrow-link inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ring)]"
                >
                  {t("dash.viewAll")}
                  <span className="arr">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
              <ul className="space-y-1">
                {recentCustomers.map((customer, i) => {
                  const bal = customerBalance(customer.id, state.ledger)
                  return (
                    <li key={customer.id}>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="group flex items-center gap-3.5 rounded-xl px-2 py-2.5 transition-all duration-200 hover:bg-muted/70 hover:translate-x-1"
                      >
                        <span
                          className={cn(
                            "grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white transition-transform duration-300 group-hover:scale-110",
                            [
                              "from-[#0a84ff] to-[#64d2ff]",
                              "from-[#30d158] to-[#00c7be]",
                              "from-[#ff9f0a] to-[#ff375f]",
                              "from-[#ffcc00] to-[#ff9f0a]",
                              "from-[#64d2ff] to-[#0a84ff]",
                            ][i % 5]
                          )}
                        >
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-[14px]">{customer.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {customer.city || customer.state || "—"}
                          </p>
                        </div>
                        {bal > 0.5 ? (
                          <Badge className="pill-warn text-[11px] font-bold tabular-nums">
                            {formatINR(bal)} {t("dash.due")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11.5px] tabular-nums">
                            {formatINR(customer.totalPurchases)}
                          </Badge>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
