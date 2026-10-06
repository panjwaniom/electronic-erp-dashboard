"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Barcode,
  Check,
  Minus,
  Plus,
  Printer,
  Search,
  Send,
  ShoppingCart,
  UserPlus,
  X,
  Zap,
} from "lucide-react"
import { useERP, type ERPContextValue } from "@/lib/store"
import type { PaymentMethod, Product, Sale } from "@/types"
import { Button } from "@/components/ui"
import { NewCustomerModal } from "@/components/customer-modal"
import { billWhatsappText, formatINR, nextInvoiceNumber, prettyDate, splitGst, todayISO, waLink } from "@/lib/erp/utils"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface CartLine {
  productId: string
  quantity: number
}

const PAYMENT_OPTIONS: { value: PaymentMethod; labelKey: string; hintKey: string }[] = [
  { value: "CASH", labelKey: "newbill.cash", hintKey: "newbill.cashHint" },
  { value: "CARD", labelKey: "newbill.card", hintKey: "newbill.cardHint" },
  { value: "UPI", labelKey: "newbill.upi", hintKey: "newbill.upiHint" },
  { value: "UDHARI", labelKey: "newbill.udhaar", hintKey: "newbill.udhaarHint" },
]

/* ──────────────────────────────────────────────
   GST tax invoice (printable)
   ────────────────────────────────────────────── */
function BillReceipt({ sale, business }: { sale: Sale; business: ERPContextValue["state"]["business"] }) {
  const { t } = useLanguage()
  return (
    <div className="print-area rounded-[20px] border border-border/70 bg-card p-7 text-[13px] text-card-foreground">
      <div className="flex items-start justify-between border-b border-dashed border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#0a84ff] to-[#00d4ff] text-white">
              <Zap className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />
            </span>
            <div>
              <p className="font-accent text-[17px] font-extrabold leading-none">
                {business.name}
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">{business.tagline}</p>
            </div>
          </div>
          <p className="mt-3 max-w-[260px] text-[12px] leading-relaxed text-muted-foreground">
            {business.address}
            <br />
            Ph: {business.phone} · {business.email}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">{t("newbill.taxInvoice")}</p>
          <p className="mt-1 text-[15px] font-bold tabular-nums">{sale.invoiceNumber}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{prettyDate(sale.date)}</p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {t("newbill.gstin")}: <span className="tabular-nums">{business.gstin}</span>
          </p>
        </div>
      </div>

      <div className="border-b border-dashed border-border py-3">
        <p className="eyebrow">{t("newbill.billedTo")}</p>
        <p className="mt-1 font-semibold">{sale.customerName ?? t("newbill.walkIn")}</p>
      </div>

      <table className="mt-1 w-full">
        <thead>
          <tr>
            <th className="eyebrow py-2 text-left">{t("newbill.item")}</th>
            <th className="eyebrow py-2 text-right">{t("newbill.qty")}</th>
            <th className="eyebrow py-2 text-right">{t("newbill.rate")}</th>
            <th className="eyebrow py-2 text-right">{t("newbill.gst")}</th>
            <th className="eyebrow py-2 text-right">{t("newbill.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it) => (
            <tr key={it.productId} className="border-t border-border/60">
              <td className="py-2.5 pr-3">
                <p className="font-medium">{it.productName}</p>
                <p className="text-[11px] text-muted-foreground">
                  HSN {it.hsnCode ?? "—"} · {it.gstRate}%
                </p>
              </td>
              <td className="py-2.5 text-right tabular-nums">{it.quantity}</td>
              <td className="py-2.5 text-right tabular-nums">{formatINR(it.unitPrice)}</td>
              <td className="py-2.5 text-right tabular-nums">{formatINR(it.tax)}</td>
              <td className="py-2.5 text-right font-semibold tabular-nums">
                {formatINR(it.total + it.tax)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-1.5 border-t border-dashed border-border pt-3 text-[12.5px]">
        <div className="flex justify-between text-muted-foreground">
          <span>{t("newbill.taxable")}</span>
          <span className="tabular-nums">{formatINR(sale.gst.taxable)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("newbill.cgst")}</span>
          <span className="tabular-nums">{formatINR(sale.gst.cgst)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("newbill.sgst")}</span>
          <span className="tabular-nums">{formatINR(sale.gst.sgst)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-[15px] font-bold">
          <span>{t("newbill.total")}</span>
           <span className="tabular-nums">{formatINR(sale.total)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("newbill.payment")}</span>
          <span>
            {sale.paymentMethod === "UDHARI" ? (
              <span className="text-[#ff9f0a]">{t("newbill.udhaarDue")} {formatINR(sale.total)}</span>
            ) : (
              `${sale.paymentMethod} · ${t("newbill.paidVia")}`
            )}
          </span>
        </div>
      </div>

      <p className="mt-5 text-center text-[12px] text-muted-foreground">
        {t("newbill.thanks")}
      </p>
    </div>
  )
}

export default function NewBillPage() {
  const { state, recordSale, addCustomer, notify } = useERP()
  const { t, tx } = useLanguage()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentMethod>("CASH")
  const [savedSale, setSavedSale] = useState<Sale | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  /* ── derived ── */
  const lines = useMemo(
    () =>
      cart
        .map((line) => {
          const product = state.products.find((p) => p.id === line.productId)
          if (!product) return null
          return { ...line, product }
        })
        .filter(Boolean) as { productId: string; quantity: number; product: Product }[],
    [cart, state.products]
  )

  /* Whole-rupee math — mirrors store.saveSale so the preview on screen is
     exactly what gets saved (and every row adds up to the total shown). */
  const { subtotal, tax, total } = useMemo(() => {
    const s = lines.reduce(
      (sum, l) => sum + Math.round(l.product.salePrice * l.quantity),
      0
    )
    const t = lines.reduce((sum, l) => {
      const lineTotal = Math.round(l.product.salePrice * l.quantity)
      return sum + Math.round((lineTotal * l.product.gstRate) / 100)
    }, 0)
    return { subtotal: s, tax: t, total: s + t }
  }, [lines])

  const gstRates = [...new Set(lines.map((l) => l.product.gstRate))].sort((a, b) => a - b)
  const { cgst, sgst } = splitGst(tax)
  const customer = state.customers.find((c) => c.id === customerId) ?? null

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return state.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q)
      )
      .slice(0, 6)
  }, [query, state.products])

  const previewInvoice = nextInvoiceNumber(state.invoiceSeq, state.business.invoicePrefix)

  /* ── cart ops ── */
  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          notify(`Only ${product.currentStock} left for ${product.name}`, "error")
          return prev
        }
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      if (product.currentStock < 1) {
        notify(tx("newbill.outOfStock", { name: product.name }), "error")
        return prev
      }
      return [...prev, { productId: product.id, quantity: 1 }]
    })
    setQuery("")
    searchRef.current?.focus()
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productId !== productId) return l
          const product = state.products.find((p) => p.id === productId)
          const next = l.quantity + delta
          if (product && next > product.currentStock) {
            notify(`Only ${product.currentStock} left in stock`, "error")
            return l
          }
          return { ...l, quantity: next }
        })
        .filter((l) => l.quantity > 0)
    )
  }

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    // 1) exact barcode / SKU match (barcode scanners end with Enter)
    const exact =
      state.products.find((p) => p.barcode === q) ??
      state.products.find((p) => p.sku.toLowerCase() === q)
    if (exact) {
      addToCart(exact)
      return
    }
    // 2) single search hit
    if (searchResults.length > 0) addToCart(searchResults[0])
    else notify(t("newbill.noMatch"), "error")
  }

  /* ── save ── */
  function save() {
    if (lines.length === 0) return
    if (payment === "UDHARI" && !customer) {
      notify(t("newbill.selectCustomer"), "error")
      return
    }
    try {
      const sale = recordSale({ customerId, items: cart, paymentMethod: payment, billedBy: "Admin" })
      setSavedSale(sale)
      notify(tx("newbill.saved", { no: sale.invoiceNumber }), "success")
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save bill", "error")
    }
  }

  function resetForNext() {
    setSavedSale(null)
    setCart([])
    setCustomerId(null)
    setPayment("CASH")
    setQuery("")
    window.setTimeout(() => searchRef.current?.focus(), 50)
  }

  async function shareOnWhatsapp(sale: Sale) {
    const text = billWhatsappText(sale, state.business)
    const link = sale.customerPhone ? waLink(sale.customerPhone, text) : null
    if (link) {
      window.open(link, "_blank", "noopener")
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      notify("No phone number on this customer — bill text copied", "info")
    } catch {
      notify("Could not copy bill text", "error")
    }
  }

  /* ────────────────────────── success view ────────────────────────── */
  if (savedSale) {
    return (
      <main className="min-h-screen bg-background antialiased">
        <section className="mx-auto max-w-[720px] px-5 py-10 md:px-8">
          <div className="fade-in-up mb-6 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#30d158]/15 text-[#30d158]">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <h1 className="text-[30px] font-bold tracking-[-0.03em]">{t("newbill.billSaved")}</h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {savedSale.invoiceNumber} · {formatINR(savedSale.total)}
              {savedSale.paymentMethod === "UDHARI" && " · on udhaar"}
            </p>
          </div>

          <div className="fade-in-up mb-6 flex flex-wrap justify-center gap-3" style={{ animationDelay: "80ms" }}>
            <Button onClick={() => shareOnWhatsapp(savedSale)}>
              <Send className="h-4 w-4" /> {t("newbill.shareWhatsapp")}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> {t("newbill.print")}
            </Button>
            <Button variant="outline" onClick={resetForNext}>
              <Plus className="h-4 w-4" /> {t("newbill.newBill")}
            </Button>
            <Button variant="ghost" onClick={() => router.push("/billing")}>
              {t("newbill.backToBilling")}
            </Button>
          </div>

          <div className="fade-in-up" style={{ animationDelay: "160ms" }}>
            <BillReceipt sale={savedSale} business={state.business} />
          </div>
        </section>
      </main>
    )
  }

  /* ────────────────────────── bill builder ────────────────────────── */
  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
          <div>
            <Link
              href="/billing"
              className="arrow-link mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ring)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("newbill.back")}
            </Link>
            <p className="eyebrow mb-2">{t("newbill.counter")}</p>
            <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[40px]">
              {t("newbill.title")}
            </h1>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-right shadow-[var(--shadow-1)]">
            <p className="eyebrow">{t("newbill.invoiceNo")}</p>
            <p className="mt-0.5 text-[15px] font-bold tabular-nums">{previewInvoice}</p>
            <p className="text-[12px] text-muted-foreground">{prettyDate(todayISO())}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          {/* ── Left: scan + cart ── */}
          <div className="space-y-4">
            {/* Scanner / search */}
            <div className="toolbar fade-in-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3">
                <Search className="h-4.5 w-4.5 flex-shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                  placeholder={t("newbill.scanPlaceholder")}
                  aria-label={t("newbill.scanOrSearch")}
                  className="h-9 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  title={t("newbill.simulateScan")}
                  aria-label={t("newbill.simulateScan")}
                  onClick={() => {
                    const pool = state.products.filter((p) => p.currentStock > 0)
                    if (pool.length === 0) return
                    const pick = pool[Math.floor(Math.random() * pool.length)]
                    addToCart(pick)
                    notify(tx("newbill.scanned", { code: pick.barcode }), "info")
                  }}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-border/70 text-muted-foreground transition-all hover:border-[var(--ring)]/50 hover:text-[var(--ring)] active:scale-90"
                >
                  <Barcode className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Search results */}
              {query.trim() && searchResults.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border/70 pt-3">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium">
                            {p.name}
                          </span>
                          <span className="block text-[12px] text-muted-foreground">
                            {p.sku} · {p.barcode} · GST {p.gstRate}%
                          </span>
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-3">
                          <span
                            className={cn(
                              "text-[11.5px] font-semibold tabular-nums",
                              p.currentStock <= p.minimumStock
                                ? "text-[#ff9f0a]"
                                : "text-muted-foreground"
                            )}
                          >
                            {p.currentStock} {t("newbill.inStock")}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatINR(p.salePrice)}
                          </span>
                          <Plus className="h-4 w-4 text-muted-foreground transition-all group-hover:scale-110 group-hover:text-[var(--ring)]" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cart */}
            <div className="card-glow rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up" style={{ animationDelay: "180ms" }}>
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  <ShoppingCart className="h-4 w-4 text-[var(--ring)]" />
                  {t("billing.items")}
                  {lines.length > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-muted-foreground">
                      {lines.length}
                    </span>
                  )}
                </h2>
                {lines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-[#ff453a]"
                  >
                    {t("newbill.clearBill")}
                  </button>
                )}
              </div>

              {lines.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                    <Barcode className="h-6 w-6" />
                  </span>
                  <p className="text-[14.5px] font-semibold">{t("newbill.noItems")}</p>
                  <p className="mt-1 max-w-[320px] text-[13px] text-muted-foreground">
                    {t("newbill.noItemsHint")}
                    Press <kbd className="rounded border border-border px-1 text-[11px]">↵</kbd>{" "}
                    {t("newbill.pressEnter")}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {lines.map((l) => {
                    const lineTotal = Math.round(l.product.salePrice * l.quantity)
                    const lineTax = Math.round((lineTotal * l.product.gstRate) / 100)
                    const low = l.quantity >= l.product.currentStock
                    return (
                      <li key={l.productId} className="flex items-center gap-4 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold">{l.product.name}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {formatINR(l.product.salePrice)} · GST {l.product.gstRate}%
                            {low && (
                              <span className="ml-1.5 font-semibold text-[#ff9f0a]">
                                · only {l.product.currentStock} left
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/50 p-1">
                          <button
                            type="button"
                            aria-label={t("newbill.decrease")}
                            onClick={() => changeQty(l.productId, -1)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center text-[14px] font-bold tabular-nums">
                            {l.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={t("newbill.increase")}
                            onClick={() => changeQty(l.productId, 1)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="w-[110px] text-right">
                          <p className="text-[14.5px] font-bold tabular-nums">
                            {formatINR(lineTotal + lineTax)}
                          </p>
                          <p className="text-[11.5px] text-muted-foreground tabular-nums">
                            +{formatINR(lineTax)} GST
                          </p>
                        </div>

                        <button
                          type="button"
                          aria-label={`${t("newbill.remove")} ${l.product.name}`}
                          onClick={() =>
                            setCart((prev) => prev.filter((x) => x.productId !== l.productId))
                          }
                          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-[#ff453a] active:scale-90"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ── Right: summary ── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div
              className="card-glow space-y-5 rounded-[20px] border border-border/70 bg-card p-5 shadow-[var(--shadow-1)] fade-in-up"
              style={{ animationDelay: "260ms" }}
            >
              {/* Customer */}
              <div>
                <p className="eyebrow mb-2">{t("newbill.customer")}</p>
                <div className="flex gap-2">
                  <select
                    value={customerId ?? ""}
                    onChange={(e) => setCustomerId(e.target.value || null)}
                    aria-label="Select customer"
                    className="h-10 w-full appearance-none rounded-xl border border-input/70 bg-background px-3 text-[14px] text-foreground outline-none transition-all hover:border-input focus-visible:border-ring"
                  >
                    <option value="">{t("newbill.walkIn")}</option>
                    {state.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.city || "—"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    aria-label="Add new customer"
                    title="Add new customer"
                    className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-border/70 text-muted-foreground transition-all hover:border-[var(--ring)]/50 hover:text-[var(--ring)] active:scale-90"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 rounded-2xl bg-background/60 p-4 text-[13.5px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("newbill.taxable")}</span>
                  <span className="tabular-nums text-foreground">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {t("newbill.cgst")} {gstRates.length > 0 ? `(${gstRates.join("% + ")}%) / 2` : ""}
                  </span>
                  <span className="tabular-nums text-foreground">{formatINR(cgst)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("newbill.sgst")}</span>
                  <span className="tabular-nums text-foreground">{formatINR(sgst)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border/70 pt-2.5">
                  <span className="text-[15px] font-semibold">Total</span>
                  <span className="text-[26px] font-bold tracking-[-0.03em] tabular-nums">
                    {formatINR(total)}
                  </span>
                </div>
              </div>

              {/* Payment */}
              <div>
                <p className="eyebrow mb-2">Payment</p>
                <div className="segmented flex-wrap" role="radiogroup" aria-label="Payment method">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const disabled = opt.value === "UDHARI" && !customer
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={payment === opt.value}
                        data-active={payment === opt.value}
                        disabled={disabled}
                        title={disabled ? t("newbill.selectCustomer") : t(opt.hintKey)}
                        onClick={() => setPayment(opt.value)}
                        className={cn(disabled && "cursor-not-allowed opacity-40")}
                      >
                        {t(opt.labelKey)}
                      </button>
                    )
                  })}
                </div>
                {payment === "UDHARI" && customer && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[#ff9f0a]">
                    <Zap className="h-3.5 w-3.5" />
                    Due amount goes to {customer.name}&apos;s udhaar ledger
                  </p>
                )}
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={lines.length === 0}
                onClick={save}
              >
                {lines.length === 0
                  ? "Add items to bill"
                  : `Save bill · ${formatINR(total)}`}
              </Button>

              <p className="text-center text-[12px] text-muted-foreground">
                Saving updates stock, udhaar ledger and day book instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick add customer */}
      <NewCustomerModal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreate={(input) => {
          const c = addCustomer(input)
          setCustomerId(c.id)
          setShowNewCustomer(false)
          notify(`${c.name} added`, "success")
        }}
      />
    </main>
  )
}
