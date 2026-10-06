"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Plus, Search, Users } from "lucide-react"
import { useERP, customerBalance } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NewCustomerModal } from "@/components/customer-modal"
import { formatINR, relativeDay } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"

export default function CustomersPage() {
  const { state, addCustomer, notify } = useERP()
  const { t } = useLanguage()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | "DUE" | "OVERDUE">("ALL")
  const [showAdd, setShowAdd] = useState(false)

  const withBalance = useMemo(
    () =>
      state.customers.map((c) => {
        const balance = customerBalance(c.id, state.ledger)
        return {
          ...c,
          balance,
          /* Past-due bills only matter when the customer is net in arrears —
             an "advance" customer with one stale bill isn't the call to make. */
          hasOverdue:
            balance > 0.5 &&
            state.sales.some(
              (s) =>
                s.customerId === c.id &&
                s.paymentStatus === "OVERDUE" &&
                s.status !== "REFUNDED"
            ),
        }
      }),
    [state.customers, state.ledger, state.sales]
  )

  const stats = useMemo(() => {
    const dueCount = withBalance.filter((c) => c.balance > 0.5).length
    const dueTotal = withBalance.reduce((s, c) => s + Math.max(0, c.balance), 0)
    return { count: state.customers.length, dueCount, dueTotal }
  }, [withBalance, state.customers.length])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return withBalance
      .filter((c) => {
        if (filter === "DUE" && c.balance <= 0.5) return false
        if (filter === "OVERDUE" && !c.hasOverdue) return false
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          (c.companyName ?? "").toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.balance - a.balance)
  }, [withBalance, search, filter])

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">Relationships</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                {t("customers.title")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("customers.subtitle")}
              </p>
            </div>
            <Button size="lg" className="shadow-lg shadow-primary/25" onClick={() => setShowAdd(true)}>
              <Plus className="h-4.5 w-4.5" /> {t("customers.add")}
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 fade-in-up" style={{ animationDelay: "80ms" }}>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("customers.count")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums">{stats.count}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("customers.withDues")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff9f0a]">
                {stats.dueCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">{t("customers.totalUdhaar")}</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#ff9f0a]">
                {formatINR(stats.dueTotal)}
              </p>
            </div>
          </div>

          {/* Search + filter */}
          <div className="toolbar flex flex-wrap items-center gap-3 fade-in-up" style={{ animationDelay: "140ms" }}>
            <div className="flex min-w-[240px] flex-1 items-center gap-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("customers.searchPlaceholder")}
                className="h-9 border-0 bg-transparent px-0 hover:border-0 focus-visible:border-0 focus-visible:ring-0"
              />
            </div>
            <div className="segmented" role="tablist" aria-label="Filter customers">
              {([[ "ALL", t("customers.all")], ["DUE", t("customers.dues")], ["OVERDUE", t("customers.overdue")]] as const).map(([value, label]) => (
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
              ))}
            </div>
          </div>

          {/* List */}
          <div
            className="card-glow overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <Users className="h-6 w-6" />
                </span>
                <p className="text-[15px] font-semibold">{t("customers.noCustomers")}</p>
                <p className="mt-1 max-w-[360px] text-[13.5px] text-muted-foreground">
                  {search || filter !== "ALL"
                    ? "Try clearing the search or filter."
                    : "Add customers to track purchases and udhaar."}
                </p>
                {!search && filter === "ALL" && (
                  <Button className="mt-4" onClick={() => setShowAdd(true)}>
                    <Plus className="h-4 w-4" /> Add first customer
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/customers/${c.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                    >
                      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0a84ff] to-[#64d2ff] text-[13px] font-bold text-white">
                        {c.name
                          .split(" ")
                          .map((w) => w[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold">{c.name}</p>
                        <p className="truncate text-[12.5px] text-muted-foreground">
                          {c.city || "—"}
                          {c.phone ? ` · ${c.phone}` : ""}
                          {c.lastPurchase ? ` · ${t("customers.lastBought")} ${relativeDay(c.lastPurchase)}` : ""}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-[14px] font-bold tabular-nums">
                          {formatINR(c.totalPurchases)}
                        </p>
                        <p className="eyebrow">{t("customers.purchases")}</p>
                      </div>
                      <div className="w-[120px] text-right">
                        {c.balance > 0.5 ? (
                          <Badge
                            className={cn(
                              "font-bold tabular-nums",
                              c.hasOverdue ? "pill-down" : "pill-warn"
                            )}
                          >
                            {formatINR(c.balance)} {c.hasOverdue ? t("customers.overdueBadge") : t("customers.due")}
                          </Badge>
                        ) : c.balance < -0.5 ? (
                          <Badge className="pill-up font-bold tabular-nums">
                            {formatINR(-c.balance)} {t("customers.advance")}
                          </Badge>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">{t("customers.settled")}</span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <NewCustomerModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={(input) => {
          const c = addCustomer(input)
          notify(`${c.name} added`, "success")
          setShowAdd(false)
        }}
      />
    </main>
  )
}
