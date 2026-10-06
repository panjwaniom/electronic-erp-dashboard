import type {
  BusinessInfo,
  DayBookEntry,
  ExpenseEntry,
  LedgerEntry,
  Sale,
  StockTransaction,
} from '@/types'

/* ──────────────────────────────────────────────
   Business identity — Hambire Electronics
   ────────────────────────────────────────────── */
export const BUSINESS: BusinessInfo = {
  name: 'Hambire Electronics',
  legalName: 'Hambire Retail Solutions',
  tagline: 'Electronics · Retail & Service',
  gstin: '29HAMBR2947E1Z5',
  state: 'Karnataka',
  stateCode: '29',
  address: 'Shop 12, Commercial Street, Bengaluru – 560001',
  phone: '+91 98450 22341',
  email: 'care@hambirelectronics.in',
  invoicePrefix: 'HE/26-27/',
}

/* ──────────────────────────────────────────────
   Number / currency formatting (deterministic)
   ────────────────────────────────────────────── */
const inr = new Intl.NumberFormat('en-IN')

export function formatNumber(value: number): string {
  return inr.format(value)
}

export function formatINR(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}₹${inr.format(Math.abs(Math.round(value)))}`
}

export function formatINRShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10000000) return `${sign(value)}₹${(abs / 10000000).toFixed(2)} Cr`
  if (abs >= 100000) return `${sign(value)}₹${(abs / 100000).toFixed(2)} L`
  if (abs >= 1000) return `${sign(value)}₹${(abs / 1000).toFixed(1)}k`
  return formatINR(value)
}
const sign = (v: number) => (v < 0 ? '-' : '')

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/* Whole-rupee money rule — every stored amount (line total, tax, bill total,
   settlement, expense) is an integer rupee. Amounts are displayed rounded, so
   keeping paise in the data would let five rows shown as ₹5,544 + … sum to
   ₹3,00,298 while the header above them says ₹3,00,297. */
export function rupee(n: number): number {
  return Math.round(n)
}

/* ──────────────────────────────────────────────
   Dates
   ────────────────────────────────────────────── */
export function todayISO(): string {
  return toISO(new Date())
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISO(d)
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function prettyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

export function relativeDay(iso: string): string {
  if (isToday(iso)) return 'Today'
  if (iso === daysAgoISO(1)) return 'Yesterday'
  return prettyDate(iso)
}

/* ──────────────────────────────────────────────
   GST helpers
   ────────────────────────────────────────────── */
export const GST_RATES = [0, 5, 12, 18, 28]

export function gstRateForCategory(category: string): number {
  const c = category.toLowerCase()
  if (c === 'gaming') return 28 // video game consoles sit in the 28% slab
  if (c === 'services' || c === 'repair') return 18
  return 18
}

export function hsnForCategory(category: string): string {
  const map: Record<string, string> = {
    Smartphones: '8517',
    Laptops: '8471',
    Computers: '8471',
    Tablets: '8471',
    Audio: '8518',
    Cameras: '8525',
    Gaming: '9504',
    Accessories: '8504',
    Services: '9987',
  }
  return map[category] ?? '8543'
}

export function splitGst(tax: number): { cgst: number; sgst: number } {
  // Whole rupees: halves must still add back up to the tax exactly.
  const cgst = rupee(tax / 2)
  return { cgst, sgst: tax - cgst }
}

/* ──────────────────────────────────────────────
   Invoice number sequence
   ────────────────────────────────────────────── */
export function nextInvoiceNumber(seq: number, prefix: string = BUSINESS.invoicePrefix): string {
  return `${prefix}${String(seq).padStart(4, '0')}`
}

/* ──────────────────────────────────────────────
   WhatsApp bill text
   ────────────────────────────────────────────── */
export function billWhatsappText(sale: Sale, business: BusinessInfo): string {
  const lines: string[] = []
  lines.push(`*${business.name}*`)
  lines.push(business.address)
  lines.push(`GSTIN: ${business.gstin}`)
  lines.push('')
  lines.push(`*Bill ${sale.invoiceNumber}*`)
  lines.push(`Date: ${prettyDate(sale.date)}`)
  if (sale.customerName) lines.push(`Customer: ${sale.customerName}`)
  lines.push('')
  lines.push('───────────────')
  sale.items.forEach((it) => {
    const amt = formatINR(it.total + it.tax)
    lines.push(`${it.productName}`)
    lines.push(`  ${it.quantity} × ${formatINR(it.unitPrice)} = ${amt}  (GST ${it.gstRate}%)`)
  })
  lines.push('───────────────')
  lines.push(`Subtotal: ${formatINR(sale.subtotal)}`)
  lines.push(`GST (CGST + SGST): ${formatINR(sale.tax)}`)
  lines.push(`*Total: ${formatINR(sale.total)}*`)
  lines.push(`Payment: ${sale.paymentMethod === 'UDHARI' ? 'UDHARI (credit)' : sale.paymentMethod}`)
  lines.push('')
  lines.push('Thank you for shopping with us! 🙏')
  lines.push('Warranty & service support available in-store.')
  return lines.join('\n')
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  const ten = digits.length > 10 ? digits.slice(-10) : digits
  if (!ten) return null
  return `https://wa.me/91${ten}?text=${encodeURIComponent(text)}`
}

/* ──────────────────────────────────────────────
   Derived business metrics
   ────────────────────────────────────────────── */
export interface PnLResult {
  grossSales: number
  refunded: number
  netRevenue: number
  cogs: number
  grossProfit: number
  expenses: number
  income: number
  netProfit: number
  byCategory: { category: string; amount: number; type: 'INCOME' | 'EXPENSE' }[]
}

export function computePnl(
  sales: Sale[],
  expenses: ExpenseEntry[],
  datePrefix: string
): PnLResult {
  const inPeriod = (d: string) => d.startsWith(datePrefix)

  const active = sales.filter((s) => inPeriod(s.date) && s.status !== 'REFUNDED')
  const refunded = sales
    .filter((s) => inPeriod(s.date) && s.status === 'REFUNDED')
    .reduce((sum, s) => sum + s.total, 0)

  const revenue = active.reduce((sum, s) => sum + s.total, 0)
  const cogs = active.reduce(
    (sum, s) =>
      sum + s.items.reduce((i, it) => i + it.unitCost * it.quantity, 0),
    0
  )

  const entries = expenses.filter((e) => inPeriod(e.date))
  const expenseTotal = entries
    .filter((e) => e.type === 'EXPENSE')
    .reduce((sum, e) => sum + e.amount, 0)
  const incomeExtra = entries
    .filter((e) => e.type === 'INCOME')
    .reduce((sum, e) => sum + e.amount, 0)

  const catMap = new Map<string, { category: string; amount: number; type: 'INCOME' | 'EXPENSE' }>()
  entries.forEach((e) => {
    const key = `${e.type}:${e.category}`
    const row = catMap.get(key)
    if (row) row.amount += e.amount
    else catMap.set(key, { category: e.category, amount: e.amount, type: e.type })
  })

  const grossProfit = revenue - cogs
  const netProfit = grossProfit - expenseTotal + incomeExtra

  /* `revenue` already excludes refunded bills, so refunds must not be
     subtracted a second time. grossSales is the pre-refund figure (what went
     through the till); netRevenue is the money actually kept — the single
     basis for margins and for the COGS line, so the statement foots. */
  return {
    grossSales: revenue + refunded,
    refunded,
    netRevenue: revenue,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    income: incomeExtra,
    netProfit,
    byCategory: [...catMap.values()].sort((a, b) => b.amount - a.amount),
  }
}

/* ──────────────────────────────────────────────
   GST summary per rate slab
   ────────────────────────────────────────────── */
export interface GstSlab {
  rate: number
  taxable: number
  cgst: number
  sgst: number
  total: number
  invoices: number
}

export function computeGstSummary(sales: Sale[], datePrefix: string): {
  slabs: GstSlab[]
  totalTaxable: number
  totalTax: number
  invoices: number
} {
  const active = sales.filter(
    (s) => s.date.startsWith(datePrefix) && s.status !== 'REFUNDED'
  )
  const map = new Map<number, GstSlab>()

  active.forEach((sale) => {
    sale.items.forEach((it) => {
      const slab = map.get(it.gstRate) ?? {
        rate: it.gstRate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        total: 0,
        invoices: 0,
      }
      slab.taxable += it.total
      const tax = it.tax
      slab.cgst += tax / 2
      slab.sgst += tax - tax / 2
      slab.total += it.total + tax
      map.set(it.gstRate, slab)
    })
  })

  const slabs = [...map.values()]
    .map((s) => ({ ...s, taxable: Math.round(s.taxable), cgst: Math.round(s.cgst), sgst: Math.round(s.sgst), total: Math.round(s.total), invoices: active.filter((sale) => sale.items.some((i) => i.gstRate === s.rate)).length }))
    .sort((a, b) => a.rate - b.rate)

  const totalTaxable = slabs.reduce((s, x) => s + x.taxable, 0)
  const totalTax = slabs.reduce((s, x) => s + x.cgst + x.sgst, 0)

  return { slabs, totalTaxable, totalTax, invoices: active.length }
}

/* ──────────────────────────────────────────────
   Day Book assembly
   ────────────────────────────────────────────── */
export function buildDayBook(
  date: string,
  sales: Sale[],
  ledger: LedgerEntry[],
  expenses: ExpenseEntry[],
  stock: StockTransaction[]
): DayBookEntry[] {
  const entries: DayBookEntry[] = []

  sales
    .filter((s) => s.date === date)
    .forEach((s) => {
      entries.push({
        id: `db-bill-${s.id}`,
        kind: s.paymentMethod === 'UDHARI' ? 'CREDIT' : 'BILL',
        time: '—',
        title: `${s.invoiceNumber} · ${s.customerName ?? 'Walk-in customer'}`,
        subtitle: `${s.items.length} item(s) · ${s.paymentMethod}${s.paymentStatus !== 'PAID' ? ` · ${s.paymentStatus}` : ''}`,
        amount: s.total,
        date,
      })
    })

  ledger
    .filter((l) => l.date === date && l.type === 'PAYMENT')
    .forEach((l) => {
      entries.push({
        id: `db-pay-${l.id}`,
        kind: 'PAYMENT',
        time: '—',
        title: `Udhari payment · ${l.reference}`,
        subtitle: l.note ?? `Received via ${l.method ?? 'CASH'}`,
        amount: l.amount,
        date,
      })
    })

  ledger
    .filter((l) => l.date === date && l.type === 'ADJUST')
    .forEach((l) => {
      entries.push({
        id: `db-adj-${l.id}`,
        kind: 'ADJUST',
        time: '—',
        title: `Udhaar adjustment · ${l.reference}`,
        subtitle: l.note ?? 'Ledger correction',
        amount: l.amount,
        date,
      })
    })

  expenses
    .filter((e) => e.date === date)
    .forEach((e) => {
      entries.push({
        id: `db-exp-${e.id}`,
        kind: e.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        time: '—',
        title: e.category,
        subtitle: e.note,
        amount: e.type === 'INCOME' ? e.amount : -e.amount,
        date,
      })
    })

  stock
    .filter((t) => t.date === date)
    .forEach((t) => {
      const informational =
        t.reference.startsWith('HE/') && t.type === 'OUT'
      if (informational) return // already shown as a bill
      entries.push({
        id: `db-stk-${t.id}`,
        kind: t.type === 'IN' ? 'STOCK_IN' : 'STOCK_OUT',
        time: '—',
        title: `${t.type === 'IN' ? 'Stock in' : 'Stock out'} · ${t.productName}`,
        subtitle: `${t.reason} · Ref: ${t.reference}`,
        amount: 0,
        date,
      })
    })

  return entries
}
