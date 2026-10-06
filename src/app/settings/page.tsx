"use client"

import { useMemo, useRef, useState } from "react"
import {
  Building2,
  Check,
  CloudUpload,
  Download,
  FileJson,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { useERP } from "@/lib/store"
import { useLanguage } from "@/lib/i18n"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { nextInvoiceNumber, prettyDate, todayISO } from "@/lib/erp/utils"
import { cn } from "@/lib/utils"

const STANDARD_PLAN = [
  "GST billing with HSN & tax breakup",
  "Barcode scanning at the counter",
  "WhatsApp bill sharing",
  "Stock tracking & low-stock alerts",
  "Customer-wise udhaar ledger",
  "Staff attendance & salary",
  "Income and expense tracking",
  "Profit & loss reports",
  "Day Book",
  "GST reports",
  "Cloud workflow with automatic backup",
]

const PREMIUM_PLAN = [
  "Multi-outlet & warehouse transfers",
  "GSTR-1 / e-invoice export",
  "Barcode label printing",
  "Loyalty points & schemes",
  "Purchase orders & vendor ledger",
]

function savedTimeLabel(savedAt: number | null): string {
  if (!savedAt) return "Waiting for the first save"
  const d = new Date(savedAt)
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const isToday = prettyDate(d.toISOString().slice(0, 10)) === prettyDate(todayISO())
  return isToday ? `Saved today at ${time}` : `Saved ${time}`
}

export default function SettingsPage() {
  const { state, savedAt, updateBusiness, exportBackup, importBackup, resetDemoData, notify } =
    useERP()
  const { t } = useLanguage()
  /* Only fields the user actually touched are held here, so a backup restore
     or demo reset shows through immediately for everything else. */
  const [draft, setDraft] = useState<Partial<typeof state.business>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const form = useMemo(() => ({ ...state.business, ...draft }), [state.business, draft])

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(state.business),
    [form, state.business]
  )

  const storageKB = useMemo(
    () => Math.round(JSON.stringify(state).length / 1024),
    [state]
  )

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setDraft((prev) => {
        const next = { ...prev, [key]: value }
        if (value === state.business[key]) delete next[key]
        return next
      })
    }

  function save() {
    updateBusiness(form)
    setDraft({})
    notify("Business details saved — new bills use them", "success")
  }

  function onRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => importBackup(String(reader.result ?? ""))
    reader.onerror = () => notify("Could not read that file", "error")
    reader.readAsText(file)
  }

  return (
    <main className="min-h-screen bg-background antialiased">
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="fade-in-up mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3">Setup</p>
              <h1 className="text-[34px] font-bold tracking-[-0.04em] md:text-[42px]">{t("settings.title")}</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t("settings.subtitle")}
              </p>
            </div>
            <Button
              size="lg"
              className="shadow-lg shadow-primary/25"
              disabled={!dirty}
              onClick={save}
            >
              <Save className="h-4.5 w-4.5" /> {dirty ? "Save changes" : "All changes saved"}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
            {/* ── Left column ── */}
            <div className="space-y-4">
              {/* Business profile */}
              <div
                className="card-glow rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
                style={{ animationDelay: "80ms" }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0a84ff]/12 text-[#0a84ff]">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-[-0.02em]">{t("settings.profile")}</h2>
                    <p className="text-[13px] text-muted-foreground">
                      {t("settings.profileHint")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("settings.shopName")}>
                    <Input value={form.name} onChange={set("name")} placeholder="Hambire Electronics" />
                  </Field>
                  <Field label={t("settings.legalName")}>
                    <Input
                      value={form.legalName}
                      onChange={set("legalName")}
                      placeholder="Hambire Retail Solutions"
                    />
                  </Field>
                  <Field label="Tagline" className="sm:col-span-2">
                    <Input
                      value={form.tagline}
                      onChange={set("tagline")}
                      placeholder="Electronics · Retail & Service"
                    />
                  </Field>
                  <Field
                    label="GSTIN"
                    hint="15 characters — printed as the tax invoice number of record"
                  >
                    <Input
                      value={form.gstin}
                      onChange={set("gstin")}
                      placeholder="29HAMBR2947E1Z5"
                      className="tabular-nums uppercase"
                    />
                  </Field>
                  <Field label="Invoice prefix">
                    <Input
                      value={form.invoicePrefix}
                      onChange={set("invoicePrefix")}
                      placeholder="HE/26-27/"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field label="State">
                    <Input value={form.state} onChange={set("state")} placeholder="Karnataka" />
                  </Field>
                  <Field label="State code" hint="Used for CGST / SGST split">
                    <Input
                      value={form.stateCode}
                      onChange={set("stateCode")}
                      placeholder="29"
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <Input
                      value={form.address}
                      onChange={set("address")}
                      placeholder="Shop 12, Commercial Street, Bengaluru – 560001"
                    />
                  </Field>
                  <Field label="Phone">
                    <Input value={form.phone} onChange={set("phone")} placeholder="+91 98450 22341" />
                  </Field>
                  <Field label="Email">
                    <Input
                      value={form.email}
                      onChange={set("email")}
                      type="email"
                      placeholder="care@shop.in"
                    />
                  </Field>
                </div>
              </div>

              {/* Live invoice header preview */}
              <div
                className="rounded-[20px] border border-dashed border-border bg-background/60 p-6 fade-in-up"
                style={{ animationDelay: "140ms" }}
              >
                <p className="eyebrow mb-3">Printed header preview</p>
                <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-1)]">
                  <div className="flex gap-3">
                    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#0a84ff] to-[#00d4ff] text-white">
                      <Zap className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-accent text-[17px] font-extrabold leading-none">
                        {form.name || "Your shop name"}
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">{form.tagline}</p>
                      <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-muted-foreground">
                        {form.address || "Shop address"}
                        <br />
                        Ph: {form.phone || "—"} · {form.email || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="eyebrow">Tax invoice</p>
                    <p className="mt-1 text-[14px] font-bold tabular-nums">
                      {nextInvoiceNumber(state.invoiceSeq, form.invoicePrefix)}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{prettyDate(todayISO())}</p>
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      GSTIN: <span className="tabular-nums">{form.gstin || "—"}</span>
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  Next bill will be numbered{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {nextInvoiceNumber(state.invoiceSeq, form.invoicePrefix)}
                  </span>{" "}
                  — saving updates every future bill.
                </p>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="space-y-4">
              {/* Data safety */}
              <div
                className="card-glow rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
                style={{ animationDelay: "200ms" }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#30d158]/12 text-[#30d158]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-[-0.02em]">Data & backup</h2>
                    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          savedAt ? "bg-[#30d158]" : "bg-[#98989d]"
                        )}
                      />
                      {savedTimeLabel(savedAt)}
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-background/70 py-2.5">
                    <p className="text-[15px] font-bold tabular-nums">{state.products.length}</p>
                    <p className="eyebrow mt-0.5">Items</p>
                  </div>
                  <div className="rounded-xl bg-background/70 py-2.5">
                    <p className="text-[15px] font-bold tabular-nums">{state.sales.length}</p>
                    <p className="eyebrow mt-0.5">Bills</p>
                  </div>
                  <div className="rounded-xl bg-background/70 py-2.5">
                    <p className="text-[15px] font-bold tabular-nums">{storageKB}</p>
                    <p className="eyebrow mt-0.5">KB used</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={exportBackup}>
                    <Download className="h-4 w-4" /> Download backup
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileRef.current?.click()}
                  >
                    <CloudUpload className="h-4 w-4" /> Restore from a backup file
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={onRestore}
                    aria-label="Choose a backup file"
                  />
                  <Button
                    variant="ghost"
                    className="w-full text-[#ff453a] hover:bg-[#ff453a]/10"
                    onClick={() => {
                      if (
                        window.confirm("Restore the original demo data? Current changes will be lost.")
                      ) {
                        resetDemoData()
                      }
                    }}
                  >
                    <RefreshCcw className="h-4 w-4" /> Restore demo data
                  </Button>
                </div>

                <p className="mt-4 flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  <FileJson className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#30d158]" />
                  <span>
                    Every tap is saved instantly on this device, so closing the browser never loses a
                    bill. Download a backup before moving to another machine — restoring it brings
                    the whole shop back.
                  </span>
                </p>
              </div>

              {/* Plan */}
              <div
                className="card-glow rounded-[20px] border border-border/70 bg-card p-6 shadow-[var(--shadow-1)] fade-in-up"
                style={{ animationDelay: "260ms" }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[16px] font-bold tracking-[-0.02em]">Your plan</h2>
                  <Badge variant="primary" className="px-2.5 py-1 text-[11.5px]">
                    Standard
                  </Badge>
                </div>

                <ul className="space-y-2">
                  {STANDARD_PLAN.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13.5px]">
                      <span className="mt-0.5 grid h-4.5 w-4.5 flex-shrink-0 place-items-center rounded-full bg-[#30d158]/15 text-[#30d158]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 border-t border-border/70 pt-4">
                  <p className="eyebrow mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Premium — later
                  </p>
                  <ul className="space-y-1.5">
                    {PREMIUM_PLAN.map((feature) => (
                      <li
                        key={feature}
                        className="text-[13px] text-muted-foreground line-through decoration-border"
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
