"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Package,
  Pencil,
  Plus,
  Search,
} from "lucide-react"
import { useERP, isLowStock } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import type { Product } from "@/types"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Modal, Field } from "@/components/ui/modal"
import { GST_RATES, formatINR } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"

export default function ProductsPage() {
  const { state, notify } = useERP()
  const { t, tx } = useLanguage()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"ALL" | "LOW">("ALL")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Product | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const pageSize = 10

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.products.filter((p) => {
      if (filter === "LOW" && !isLowStock(p)) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q)
      )
    })
  }, [state.products, search, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const stats = useMemo(() => {
    const low = state.products.filter(isLowStock).length
    const value = state.products.reduce((s, p) => s + p.costPrice * p.currentStock, 0)
    return { skus: state.products.length, low, value }
  }, [state.products])

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in-up">
            <div>
              <p className="eyebrow mb-3">Inventory</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">
                {t("products.title")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("products.subtitle")}
              </p>
            </div>
            <Button size="lg" className="shadow-lg shadow-primary/25" onClick={() => setShowAdd(true)}>
              <Plus className="h-4.5 w-4.5" /> {t("products.addItem")}
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 fade-in-up" style={{ animationDelay: "80ms" }}>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">SKUs</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums">{stats.skus}</p>
            </div>
            <div
              className={cn(
                "rounded-2xl border px-5 py-4 shadow-[var(--shadow-1)]",
                stats.low > 0 ? "border-[#ff9f0a]/40 bg-[#ff9f0a]/[0.06]" : "border-border/70 bg-card"
              )}
            >
              <p className="eyebrow">Low stock</p>
              <p
                className={cn(
                  "mt-1 flex items-center gap-1.5 text-[24px] font-bold tabular-nums",
                  stats.low > 0 ? "text-[#ff9f0a]" : "text-foreground"
                )}
              >
                {stats.low}
                {stats.low > 0 && <AlertTriangle className="h-5 w-5" />}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-1)]">
              <p className="eyebrow">Stock value (at cost)</p>
              <p className="mt-1 text-[24px] font-bold tabular-nums">{formatINR(stats.value)}</p>
            </div>
          </div>

          {/* Search & filter */}
          <div className="toolbar flex flex-wrap items-center gap-3 fade-in-up" style={{ animationDelay: "140ms" }}>
            <div className="flex min-w-[240px] flex-1 items-center gap-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder={t("products.searchPlaceholder")}
                className="h-9 border-0 bg-transparent px-0 hover:border-0 focus-visible:border-0 focus-visible:ring-0"
              />
            </div>
            <div className="segmented" role="tablist" aria-label="Filter products">
              {([["ALL", t("products.all")], ["LOW", t("products.low")]] as const).map(([value, label]) => (
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
          </div>

          {/* Table */}
          <div
            className="card-glow overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[var(--shadow-1)] fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {paged.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <Package className="h-6 w-6" />
                </span>
                <p className="text-[15px] font-semibold">No products found</p>
                <p className="mt-1 max-w-[360px] text-[13.5px] text-muted-foreground">
                  {search || filter !== "ALL"
                    ? "Try clearing the search or filter."
                    : "Add your first product to start billing."}
                </p>
                {!search && filter === "ALL" && (
                  <Button className="mt-4" onClick={() => setShowAdd(true)}>
                    <Plus className="h-4 w-4" /> Add first product
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b">
                        <th>Product</th>
                        <th>{t("products.category")}</th>
                        <th>Stock</th>
                        <th>Cost</th>
                        <th>Sale price</th>
                        <th>GST</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((product) => {
                        const low = isLowStock(product)
                        return (
                          <tr key={product.id} className="transition-colors hover:bg-muted/50">
                            <td>
                              <p className="font-semibold">{product.name}</p>
                              <p className="text-[11.5px] text-muted-foreground">
                                {product.sku}
                                {product.brand ? ` · ${product.brand}` : ""}
                              </p>
                            </td>
                            <td>
                              <Badge variant="outline" className="text-xs">
                                {product.category}
                              </Badge>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={low ? "destructive" : "default"}
                                  className="text-xs tabular-nums"
                                >
                                  {product.currentStock}
                                </Badge>
                                {low && (
                                  <span className="text-[11px] font-semibold text-[#ff9f0a]">
                                    {product.currentStock === 0 ? "Out" : "Low"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="tabular-nums">{formatINR(product.costPrice)}</td>
                            <td className="font-semibold tabular-nums text-[var(--ring)]">
                              {formatINR(product.salePrice)}
                            </td>
                            <td className="tabular-nums">{product.gstRate}%</td>
                            <td>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  title={`Edit ${product.name}`}
                                  onClick={() => setEditing(product)}
                                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
                    <span className="eyebrow">
                      {filtered.length} products · page {safePage}/{totalPages}
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

      <ProductModal
        open={showAdd || !!editing}
        product={editing}
        onClose={() => {
          setShowAdd(false)
          setEditing(null)
        }}
        onSaved={(name, mode) =>
          notify(mode === "add" ? tx("products.added", { name }) : tx("products.updated", { name }), "success")
        }
      />
    </main>
  )
}

function blankForm() {
  return {
    name: "",
    category: "Smartphones",
    brand: "",
    sku: "",
    barcode: "",
    costPrice: "",
    salePrice: "",
    gstRate: "18",
    hsnCode: "",
    minimumStock: "3",
  }
}

function ProductModal({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean
  product: Product | null
  onClose: () => void
  onSaved: (name: string, mode: "add" | "edit") => void
}) {
  const { addProduct, updateProduct } = useERP()
  const { t, tx } = useLanguage()
  const editing = !!product

  const [form, setForm] = useState(() => blankForm())
  const [stockQty, setStockQty] = useState("")

  // sync form when opening (add vs edit)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = open ? (product?.id ?? "new") : null
  if (key !== lastKey) {
    setLastKey(key)
    if (product) {
      setForm({
        name: product.name,
        category: product.category,
        brand: product.brand ?? "",
        sku: product.sku,
        barcode: product.barcode,
        costPrice: String(product.costPrice),
        salePrice: String(product.salePrice),
        gstRate: String(product.gstRate),
        hsnCode: product.hsnCode ?? "",
        minimumStock: String(product.minimumStock),
      })
      setStockQty("")
    } else {
      setForm(blankForm())
      setStockQty("")
    }
  }

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  /* Suggest GST + HSN only for known categories — never clobber a manual GST pick */
  const KNOWN_CATEGORIES: Record<string, { gst: number; hsn: string }> = {
    smartphones: { gst: 18, hsn: "8517" },
    mobiles: { gst: 18, hsn: "8517" },
    laptops: { gst: 18, hsn: "8471" },
    computers: { gst: 18, hsn: "8471" },
    tablets: { gst: 18, hsn: "8471" },
    audio: { gst: 18, hsn: "8518" },
    headphones: { gst: 18, hsn: "8518" },
    accessories: { gst: 18, hsn: "8504" },
    televisions: { gst: 18, hsn: "8528" },
    appliances: { gst: 28, hsn: "8516" },
    cameras: { gst: 18, hsn: "8525" },
    gaming: { gst: 18, hsn: "9504" },
    services: { gst: 18, hsn: "9987" },
    repair: { gst: 18, hsn: "9987" },
  }

  function onCategoryChange(category: string) {
    const hit = KNOWN_CATEGORIES[category.trim().toLowerCase()]
    if (hit) set({ category, gstRate: String(hit.gst), hsnCode: hit.hsn })
    else set({ category })
  }

  const valid = form.name.trim() && Number(form.salePrice) > 0

  function submit() {
    if (!valid) return
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "Other",
      brand: form.brand.trim() || undefined,
      sku: form.sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
      barcode: form.barcode.trim() || String(Date.now()).slice(-13),
      costPrice: Math.round(Number(form.costPrice) || 0),
      salePrice: Math.round(Number(form.salePrice)),
      gstRate: Number(form.gstRate),
      hsnCode: form.hsnCode.trim() || undefined,
      minimumStock: Number(form.minimumStock) || 0,
    }
    if (product) {
      updateProduct(product.id, payload)
      onSaved(payload.name, "edit")
    } else {
      addProduct({
        ...payload,
        currentStock: Number(stockQty) || 0,
        reorderPoint: payload.minimumStock,
        maximumStock: Math.max(payload.minimumStock * 10, 50),
        totalSold: 0,
      })
      onSaved(payload.name, "add")
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${product?.name}` : "Add product"}
      subtitle={
        editing
          ? "Update pricing, GST or stock thresholds"
          : "Barcode is generated if you don't have one — a scanner can still find it by SKU"
      }
      size="wide"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("products.cancel")}
          </Button>
          <Button onClick={submit} disabled={!valid} className="shadow-lg shadow-primary/25">
            {editing ? t("products.saveChanges") : t("products.add")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("products.name")} className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Samsung Galaxy S24 128GB" autoFocus />
        </Field>
        <Field label={t("products.category")} hint={tx("products.gstHsnHint", { rate: form.gstRate, hsn: form.hsnCode || "—" })}>
          <Input
            value={form.category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder="Smartphones / Laptops / Audio…"
          />
        </Field>
        <Field label={t("products.brand")}>
          <Input value={form.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Samsung" />
        </Field>
        <Field label={t("products.sku")}>
          <Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="SM-S24-128" />
        </Field>
        <Field label={t("products.barcode")} hint={t("products.barcodeHint")}>
          <Input value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} placeholder="8901234567890" className="tabular-nums" />
        </Field>
        <Field label={t("products.costPrice")}>
          <Input type="number" min={0} value={form.costPrice} onChange={(e) => set({ costPrice: e.target.value })} placeholder="0" />
        </Field>
        <Field label={t("products.salePrice")}>
          <Input type="number" min={0} value={form.salePrice} onChange={(e) => set({ salePrice: e.target.value })} placeholder="0" />
        </Field>
        <Field label={t("products.gstRate")}>
          <select
            value={form.gstRate}
            onChange={(e) => set({ gstRate: e.target.value })}
            className="h-10 w-full appearance-none rounded-xl border border-input/70 bg-background px-3 text-[14px] text-foreground outline-none transition-all hover:border-input focus-visible:border-ring"
          >
            {GST_RATES.map((r) => (
              <option key={r} value={String(r)}>
                {r}%
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("products.lowStockAt")} hint={t("products.lowStockHint")}>
          <Input type="number" min={0} value={form.minimumStock} onChange={(e) => set({ minimumStock: e.target.value })} />
        </Field>
        {!editing && (
          <Field label={t("products.openingStock")} hint={t("products.openingStockHint")}>
            <Input type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
          </Field>
        )}
      </div>
    </Modal>
  )
}
