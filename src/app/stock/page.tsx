"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Minus,
  PackagePlus,
  Plus,
  Search,
} from "lucide-react"
import { useERP, isLowStock } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Modal, Field } from "@/components/ui/modal"
import { formatINR, relativeDay } from "@/lib/erp/utils"

const ADJUST_REASONS = [
  "Purchase received",
  "Stock count correction",
  "Damaged / broken",
  "Returned to vendor",
  "Demo / display unit",
] as const

export default function StockPage() {
  const { state, adjustStock, notify } = useERP()
  const { t } = useLanguage()
  const [tab, setTab] = useState<"LEVELS" | "MOVEMENTS">("LEVELS")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | "LOW" | "OUT">("ALL")
  const [showAdjust, setShowAdjust] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 8

  const lowProducts = state.products.filter(isLowStock)

  const levels = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.products
      .filter((p) => {
        if (filter === "LOW" && !(isLowStock(p) && p.currentStock > 0)) return false
        if (filter === "OUT" && p.currentStock > 0) return false
        if (!q) return true
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q)
        )
      })
      .sort((a, b) => a.currentStock - b.currentStock)
  }, [state.products, search, filter])

  const movements = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.stock.filter(
      (t) =>
        !q ||
        t.productName.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.reason.toLowerCase().includes(q)
    )
  }, [state.stock, search])

  const totalPages = Math.max(1, Math.ceil(movements.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedMovements = movements.slice((safePage - 1) * pageSize, safePage * pageSize)

  function quickAdjust(productId: string, delta: number) {
    const product = state.products.find((p) => p.id === productId)
    if (!product) return
    const clamped = delta > 0 ? delta : -Math.min(-delta, product.currentStock)
    if (clamped === 0) return
    adjustStock(productId, clamped, "Stock count correction")
    notify(
      `${product.name}: ${clamped > 0 ? "+" : ""}${clamped} → ${product.currentStock + clamped} left`,
      "success"
    )
  }

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">Inventory</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">{t("stock.title")}</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("stock.subtitle")}
              </p>
            </div>
            <Button size="lg" className="shadow-lg shadow-primary/25" onClick={() => setShowAdjust(true)}>
              <PackagePlus className="h-4.5 w-4.5" /> {t("stock.adjust")}
            </Button>
          </div>

          {/* Low-stock alert */}
          {lowProducts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTab("LEVELS")
                setFilter("LOW")
                setSearch("")
              }}
              className="fade-in-up flex w-full items-center gap-3 rounded-2xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/[0.07] px-5 py-4 text-left transition-all hover:bg-[#ff9f0a]/[0.12]"
              style={{ animationDelay: "60ms" }}
            >
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[#ff9f0a]/15 text-[#ff9f0a]">
                <AlertTriangle className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-[#ff9f0a]">
                  {lowProducts.length} product{lowProducts.length > 1 ? "s" : ""} need restock
                </span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {lowProducts
                    .slice(0, 3)
                    .map((p) => `${p.name} (${p.currentStock})`)
                    .join(" · ")}
                  {lowProducts.length > 3 ? " …" : ""}
                </span>
              </span>
              <span className="eyebrow flex-shrink-0">Review →</span>
            </button>
          )}

          {/* Tabs */}
          <div className="toolbar flex flex-wrap items-center gap-3 fade-in-up" style={{ animationDelay: "120ms" }}>
            <div className="segmented" role="tablist" aria-label="Stock views">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "LEVELS"}
                data-active={tab === "LEVELS"}
                onClick={() => {
                  setTab("LEVELS")
                  setPage(1)
                }}
              >
                {t("stock.levels")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "MOVEMENTS"}
                data-active={tab === "MOVEMENTS"}
                onClick={() => {
                  setTab("MOVEMENTS")
                  setPage(1)
                }}
              >
                {t("stock.movements")}
              </button>
            </div>

            <div className="flex min-w-[200px] flex-1 items-center gap-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder={tab === "LEVELS" ? t("stock.searchPlaceholder") : "Search product, invoice or reason…"}
                className="h-9 border-0 bg-transparent px-0 hover:border-0 focus-visible:border-0 focus-visible:ring-0"
              />
            </div>

            {tab === "LEVELS" && (
              <div className="segmented" role="tablist" aria-label="Filter levels">
                {([[ "ALL", t("stock.all")], ["LOW", t("stock.low")], ["OUT", t("stock.out")]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    data-active={filter === value}
                    onClick={() => {
                      setFilter(value)
                      setPage(1)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div
            className="card-glow overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "180ms" }}
          >
            {tab === "LEVELS" ? (
              levels.length === 0 ? (
                <EmptyBox
                  title="Nothing here"
                  text={
                    search || filter !== "ALL"
                      ? "Try another search or filter."
                      : "Add products to see stock levels."
                  }
                />
              ) : (
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b">
                        <th>{t("stock.product")}</th>
                        <th>{t("stock.inStock")}</th>
                        <th>{t("stock.alertAt")}</th>
                        <th>{t("stock.status")}</th>
                        <th>{t("stock.value")}</th>
                        <th className="text-right">Quick count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((p) => {
                        const out = p.currentStock === 0
                        const low = isLowStock(p)
                        return (
                          <tr key={p.id} className="transition-colors hover:bg-muted/50">
                            <td>
                              <p className="font-semibold">{p.name}</p>
                              <p className="text-[11.5px] text-muted-foreground">{p.sku}</p>
                            </td>
                            <td>
                              <Badge
                                variant={out ? "destructive" : low ? "destructive" : "default"}
                                className="text-xs font-bold tabular-nums"
                              >
                                {p.currentStock}
                              </Badge>
                            </td>
                            <td className="tabular-nums text-muted-foreground">{p.minimumStock}</td>
                            <td>
                              {out ? (
                                <Badge className="pill-down font-bold">{t("stock.outBadge")}</Badge>
                              ) : low ? (
                                <Badge className="pill-warn font-bold">{t("stock.lowBadge")}</Badge>
                              ) : (
                                <Badge className="pill-up font-bold">{t("stock.inStockBadge")}</Badge>
                              )}
                            </td>
                            <td className="tabular-nums">{formatINR(p.costPrice * p.currentStock)}</td>
                            <td>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  aria-label={`Remove one ${p.name}`}
                                  disabled={p.currentStock === 0}
                                  onClick={() => quickAdjust(p.id, -1)}
                                  className="grid h-8 w-8 place-items-center rounded-lg border border-border/70 text-muted-foreground transition-all hover:border-[#ff453a]/50 hover:text-[#ff453a] active:scale-90 disabled:opacity-30"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Add one ${p.name}`}
                                  onClick={() => quickAdjust(p.id, 1)}
                                  className="grid h-8 w-8 place-items-center rounded-lg border border-border/70 text-muted-foreground transition-all hover:border-[#30d158]/60 hover:text-[#30d158] active:scale-90"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : movements.length === 0 ? (
              <EmptyBox
                title="No movements yet"
                text="Sales, purchases and manual adjustments all appear here."
              />
            ) : (
              <>
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b">
                        <th>Product</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Reference</th>
                        <th>{t("stock.reason")}</th>
                        <th>Date</th>
                        <th>User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedMovements.map((t) => (
                        <tr key={t.id} className="transition-colors hover:bg-muted/50">
                          <td className="font-medium">{t.productName}</td>
                          <td>
                            {t.type === "IN" ? (
                              <Badge className="pill-up inline-flex items-center gap-1 font-bold">
                                <ArrowDown className="h-3 w-3" /> IN
                              </Badge>
                            ) : (
                              <Badge className="pill-down inline-flex items-center gap-1 font-bold">
                                <ArrowUp className="h-3 w-3" /> OUT
                              </Badge>
                            )}
                          </td>
                          <td className="font-semibold tabular-nums">{t.quantity}</td>
                          <td className="tabular-nums">{t.reference}</td>
                          <td>{t.reason}</td>
                          <td className="text-muted-foreground">{relativeDay(t.date)}</td>
                          <td className="text-muted-foreground">{t.user}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
                    <span className="eyebrow">
                      {movements.length} movements · page {safePage}/{totalPages}
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

      <AdjustModal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        onApply={(productId, sign, qty, reason) => {
          const product = state.products.find((p) => p.id === productId)
          if (!product) return
          const delta = sign * Math.min(qty, sign < 0 ? product.currentStock : qty)
          if (delta === 0) {
            notify(`${product.name} has no stock to remove`, "error")
            return
          }
          adjustStock(productId, delta, reason)
          notify(
            `${product.name}: ${delta > 0 ? "+" : ""}${delta} (${reason}) → ${product.currentStock + delta} left`,
            "success"
          )
          setShowAdjust(false)
        }}
      />
    </main>
  )
}

function EmptyBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Archive className="h-6 w-6" />
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[360px] text-[13.5px] text-muted-foreground">{text}</p>
    </div>
  )
}

function AdjustModal({
  open,
  onClose,
  onApply,
}: {
  open: boolean
  onClose: () => void
  onApply: (productId: string, sign: 1 | -1, qty: number, reason: string) => void
}) {
  const { state } = useERP()
  const { t } = useLanguage()
  const [productId, setProductId] = useState("")
  const [sign, setSign] = useState<1 | -1>(1)
  const [qty, setQty] = useState("")
  const [reason, setReason] = useState<string>(ADJUST_REASONS[0])

  const product = state.products.find((p) => p.id === productId)
  const value = Number(qty) || 0
  const valid = !!product && value > 0 && (sign === 1 || product.currentStock >= value)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("stock.adjustTitle")}
      subtitle="Purchase incoming, damage, or a shelf count fix"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("stock.cancel")}
          </Button>
          <Button
            disabled={!valid}
            onClick={() => onApply(productId, sign, value, reason)}
            className="shadow-lg shadow-primary/25"
          >
            Apply adjustment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Product" hint={product ? `Currently ${product.currentStock} in stock` : undefined}>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-input/70 bg-background px-3 text-[14px] text-foreground outline-none transition-all hover:border-input focus-visible:border-ring"
          >
            <option value="">Select a product…</option>
            {[...state.products]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currentStock})
                </option>
              ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Direction">
            <div className="segmented" role="radiogroup" aria-label="Stock direction">
              <button
                type="button"
                role="radio"
                aria-checked={sign === 1}
                data-active={sign === 1}
                onClick={() => setSign(1)}
                className="flex-1"
              >
                Stock in
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={sign === -1}
                data-active={sign === -1}
                onClick={() => setSign(-1)}
                className="flex-1"
              >
                Stock out
              </button>
            </div>
          </Field>
          <Field label={t("stock.quantity")}>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="10"
              autoFocus
            />
          </Field>
        </div>

        <Field label={t("stock.reason")}>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-input/70 bg-background px-3 text-[14px] text-foreground outline-none transition-all hover:border-input focus-visible:border-ring"
          >
            {ADJUST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        {sign === -1 && product && product.currentStock < value && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#ff453a]">
            <AlertTriangle className="h-3.5 w-3.5" /> Only {product.currentStock} in stock
          </p>
        )}
      </div>
    </Modal>
  )
}
