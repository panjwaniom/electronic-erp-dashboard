import {
  customers,
  products,
  invoices,
  sales as legacySales,
} from '@/lib/data/electronics-shop'
import type {
  AttendanceRecord,
  Customer,
  ERPState,
  ExpenseEntry,
  LedgerEntry,
  LegacySale,
  PaymentMethod,
  PaymentStatus,
  Product,
  Sale,
  SaleItem,
  StockTransaction,
} from '@/types'
import { generateExpenses, generateSales, supplierDeliveries } from './history'
import {
  BUSINESS,
  daysAgoISO,
  gstRateForCategory,
  hsnForCategory,
  nextInvoiceNumber,
  rupee,
} from './utils'

/* ──────────────────────────────────────────────
   Products enriched with GST metadata
   ────────────────────────────────────────────── */
const enrichedProducts: Product[] = products.map((p) => ({
  ...p,
  gstRate: p.gstRate ?? gstRateForCategory(p.category),
  hsnCode: p.hsnCode ?? hsnForCategory(p.category),
}))

/* ──────────────────────────────────────────────
   Unified sales (legacy sales + invoices merged)
   ────────────────────────────────────────────── */
const saleMeta: Record<string, { method: PaymentMethod; paymentStatus: PaymentStatus }> = {
  s001: { method: 'TRANSFER', paymentStatus: 'PAID' },
  s002: { method: 'CARD', paymentStatus: 'PAID' },
  s003: { method: 'UDHARI', paymentStatus: 'PENDING' },
  s004: { method: 'UDHARI', paymentStatus: 'OVERDUE' },
  s005: { method: 'UDHARI', paymentStatus: 'PENDING' },
  s006: { method: 'CARD', paymentStatus: 'PAID' },
}

/**
 * The six prototype bills are the shop's "featured" story — a couple of large
 * account sales, an open udhaar, a part payment and a refund. They are re-dated
 * relative to today so that story is always visible on the dashboard.
 */
const ANCHOR_AGE: Record<string, number> = {
  s001: 0, // TechZone — big corporate bill, paid by bank transfer
  s006: 1, // TechZone — desktop, card
  s003: 2, // Delhi Digital Mart — udhaar, part paid
  s002: 3, // Mumbai Gadgets — bulk order, card
  s004: 8, // Chennai — refunded, customer keeps an advance
  s005: 10, // Kolkata — udhaar, still open
}

function buildUnifiedSale(legacy: LegacySale): Sale {
  const inv = invoices.find((i) => i.invoiceNumber === legacy.invoiceNumber)
  const customer = customers.find((c) => c.id === (inv?.customerId ?? legacy.customerId))
  const meta = saleMeta[legacy.id] ?? {
    method: legacy.paymentMethod as PaymentMethod,
    paymentStatus: 'PAID' as PaymentStatus,
  }

  const source = inv ?? legacy
  /* Normalize from items — source invoices carry hand-fudged tax (~13%) and one
     invoice whose items don't even sum to its subtotal. Items + product GST rate
     are the single source of truth so every bill foots, prints 18% correctly, and
     the GST report ties back to the invoices. */
  const items: SaleItem[] = source.items.map((ii) => {
    const product = enrichedProducts.find((pp) => pp.id === ii.productId)
    const rate = product?.gstRate ?? 18
    const lineTotal = rupee(ii.unitPrice * ii.quantity)
    return {
      productId: ii.productId,
      productName: ii.productName,
      hsnCode: product?.hsnCode,
      gstRate: rate,
      quantity: ii.quantity,
      unitPrice: ii.unitPrice,
      unitCost: product?.costPrice ?? 0,
      total: lineTotal,
      tax: rupee((lineTotal * rate) / 100),
    }
  })

  const subtotal = rupee(items.reduce((sum, i) => sum + i.total, 0))
  const tax = rupee(items.reduce((sum, i) => sum + i.tax, 0))
  const total = rupee(subtotal + tax)
  const rates = [...new Set(items.map((i) => i.gstRate))].sort((a, b) => a - b)
  const cgst = rupee(tax / 2)

  const refunded = legacy.status === 'REFUNDED'

  return {
    id: legacy.id,
    invoiceNumber: legacy.invoiceNumber,
    customerId: source.customerId,
    customerName: source.customerName,
    customerPhone: customer?.phone ?? null,
    date: daysAgoISO(ANCHOR_AGE[legacy.id] ?? 5),
    items,
    subtotal,
    tax,
    total,
    gst: { taxable: subtotal, cgst, sgst: tax - cgst, rates },
    paymentMethod: meta.method,
    /* A returned bill is no longer collectable — saying OVERDUE on it would
       send the owner chasing money the shop already gave back. */
    paymentStatus: refunded ? 'REFUNDED' : meta.paymentStatus,
    status: refunded ? 'REFUNDED' : 'COMPLETED',
    billedBy: 'Ravi Kumar',
    notes: 'notes' in source ? (source as { notes?: string }).notes : undefined,
  }
}

const anchorSales: Sale[] = legacySales.map(buildUnifiedSale)

/* ──────────────────────────────────────────────
   Six months of trading, generated deterministically
   ────────────────────────────────────────────── */
const history = generateSales(enrichedProducts, customers)

/**
 * One invoice sequence for the whole book: bills are sorted oldest → newest
 * and numbered `HE/26-27/0001…`, exactly the way a GST-registered shop
 * sequences invoices for a financial year. Prototype `INV-…` numbers are
 * rewritten, and every ledger/stock reference follows.
 */
function numberTheBook(sales: Sale[]): {
  sales: Sale[]
  invoiceSeq: number
  byId: Map<string, string>
  byOldNumber: Map<string, string>
} {
  const ascending = [...sales].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  )
  const byOldNumber = new Map<string, string>()
  ascending.forEach((sale, index) => {
    const next = nextInvoiceNumber(index + 1)
    byOldNumber.set(sale.invoiceNumber, next)
    sale.invoiceNumber = next
  })
  const byId = new Map(ascending.map((s) => [s.id, s.invoiceNumber]))
  return {
    sales: ascending.reverse(),
    invoiceSeq: ascending.length + 1,
    byId,
    byOldNumber,
  }
}

const book = numberTheBook([...anchorSales, ...history.sales])

/* ──────────────────────────────────────────────
   Udhaar ledger
   ────────────────────────────────────────────── */
const saleTotal = (saleId: string): number =>
  book.sales.find((s) => s.id === saleId)?.total ?? 0

const anchorLedger: LedgerEntry[] = [
  {
    id: 'led001',
    customerId: 'c001',
    type: 'CREDIT',
    amount: 45000,
    date: daysAgoISO(45),
    reference: 'SETTLEMENT',
    note: 'Bulk accessory order on udhaar',
  },
  {
    id: 'led002',
    customerId: 'c001',
    type: 'PAYMENT',
    amount: 45000,
    date: daysAgoISO(30),
    reference: 'SETTLEMENT',
    note: 'Full settlement via UPI',
    method: 'UPI',
  },
  {
    id: 'led003',
    customerId: 'c003',
    type: 'CREDIT',
    amount: saleTotal('s003'),
    date: daysAgoISO(ANCHOR_AGE.s003),
    reference: book.byId.get('s003') ?? '',
    saleId: 's003',
    note: 'Samsung Galaxy S25 Ultra on udhaar',
  },
  {
    id: 'led004',
    customerId: 'c004',
    type: 'CREDIT',
    amount: saleTotal('s004'),
    date: daysAgoISO(ANCHOR_AGE.s004),
    reference: book.byId.get('s004') ?? '',
    saleId: 's004',
    note: 'MacBook Pro 14-inch M3 — overdue',
  },
  {
    id: 'led005',
    customerId: 'c005',
    type: 'CREDIT',
    amount: saleTotal('s005'),
    date: daysAgoISO(ANCHOR_AGE.s005),
    reference: book.byId.get('s005') ?? '',
    saleId: 's005',
    note: 'OnePlus 12 5G on udhaar',
  },
  {
    id: 'led006',
    customerId: 'c003',
    type: 'PAYMENT',
    amount: 25000,
    date: daysAgoISO(2),
    reference: book.byId.get('s003') ?? '',
    saleId: 's003',
    note: 'Part payment — cash',
    method: 'CASH',
  },
  {
    id: 'led007',
    customerId: 'c004',
    type: 'PAYMENT',
    amount: 50000,
    date: daysAgoISO(5),
    reference: book.byId.get('s004') ?? '',
    saleId: 's004',
    note: 'Part payment via UPI',
    method: 'UPI',
  },
  {
    /* Refund of s004 — full udhaar reversal (mirrors refundSale).
       Customer keeps a ₹50,000 advance (they had paid part of the bill). */
    id: 'led008',
    customerId: 'c004',
    type: 'ADJUST',
    amount: -saleTotal('s004'),
    date: daysAgoISO(4),
    reference: book.byId.get('s004') ?? '',
    saleId: 's004',
    note: `Refund — udhaar reversed for ${book.byId.get('s004') ?? ''}`,
  },
]

/* Generated udhaar entries carry their bill's final invoice number. */
const generatedLedger: LedgerEntry[] = history.ledger.map((entry) => ({
  ...entry,
  reference: entry.saleId
    ? book.byId.get(entry.saleId) ?? entry.reference
    : book.byOldNumber.get(entry.reference) ?? entry.reference,
}))

const ledger: LedgerEntry[] = [...anchorLedger, ...generatedLedger].sort((a, b) =>
  b.date.localeCompare(a.date)
)

/* Payment status must agree with the ledger: a bill whose udhaar was reversed
   (or settled) is paid, and a part-paid bill still open past 30 days is
   genuinely overdue. Keeps badges, due filters and "Collect" buttons truthful. */
const settleNet = (saleId: string): number =>
  ledger.reduce((sum, l) => {
    if (l.saleId !== saleId) return sum
    if (l.type === 'CREDIT') return sum + l.amount
    if (l.type === 'PAYMENT') return sum - l.amount
    return sum + l.amount // ADJUST carries signed amounts
  }, 0)

book.sales.forEach((sale) => {
  if (sale.status === 'REFUNDED') {
    sale.paymentStatus = 'REFUNDED' // returned bill — nothing left to chase
    return
  }
  if (sale.paymentStatus !== 'PENDING' && sale.paymentStatus !== 'OVERDUE') return
  const owed = settleNet(sale.id)
  if (owed <= 0.5) sale.paymentStatus = 'PAID'
  else if (sale.paymentStatus === 'PENDING' && sale.date < daysAgoISO(30))
    sale.paymentStatus = 'OVERDUE'
})

/* ──────────────────────────────────────────────
   Stock movement — every bill moves stock, every
   restock comes from a supplier delivery
   ────────────────────────────────────────────── */
const soldOut = new Map<string, number>()
book.sales.forEach((sale) =>
  sale.items.forEach((item) => {
    soldOut.set(item.productId, (soldOut.get(item.productId) ?? 0) + item.quantity)
  })
)

const saleMovement: StockTransaction[] = book.sales.flatMap((sale) =>
  sale.items.flatMap((item) => {
    const base = {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      reference: sale.invoiceNumber,
      date: sale.date,
      user: sale.billedBy ?? 'Counter',
    }
    const out: StockTransaction = {
      ...base,
      id: `stk_${sale.id}_${item.productId}`,
      type: 'OUT',
      reason: sale.status === 'REFUNDED' ? 'Sale (refunded)' : 'Sale',
    }
    if (sale.status !== 'REFUNDED') return [out]
    return [
      out,
      {
        ...base,
        id: `stkr_${sale.id}_${item.productId}`,
        type: 'IN' as const,
        reason: 'Refund restock',
        user: 'Counter',
      },
    ]
  })
)

const purchaseMovement: StockTransaction[] = supplierDeliveries(
  enrichedProducts,
  soldOut
).map((d, index) => ({
  id: `stkpo_${index}`,
  productId: d.productId,
  productName: d.productName,
  type: 'IN',
  quantity: d.quantity,
  reference: d.reference,
  reason: 'Purchase received',
  date: d.date,
  user: 'Store',
}))

const stock: StockTransaction[] = [...saleMovement, ...purchaseMovement].sort((a, b) =>
  b.date.localeCompare(a.date)
)

/* Last time a shelf actually changed — derived, never hand-written. */
const lastMovement = new Map<string, string>()
stock.forEach((t) => {
  const prev = lastMovement.get(t.productId)
  if (!prev || t.date > prev) lastMovement.set(t.productId, t.date)
})

/* ──────────────────────────────────────────────
   Customers — lifetime numbers follow the book
   ────────────────────────────────────────────── */
const customerTotals = new Map<string, { total: number; last: string }>()
book.sales
  .filter((s) => s.status !== 'REFUNDED' && s.customerId)
  .forEach((s) => {
    const cur = customerTotals.get(s.customerId as string) ?? { total: 0, last: s.date }
    cur.total = rupee(cur.total + s.total)
    if (s.date > cur.last) cur.last = s.date
    customerTotals.set(s.customerId as string, cur)
  })

const seedCustomers: Customer[] = customers.map((c) => {
  const stats = customerTotals.get(c.id)
  return stats
    ? { ...c, totalPurchases: stats.total, lastPurchase: stats.last }
    : c
})

/* ──────────────────────────────────────────────
   Staff
   ────────────────────────────────────────────── */
const staff = [
  {
    id: 'stf001',
    name: 'Ravi Kumar',
    role: 'Sales Executive',
    phone: '+91-98450 11223',
    monthlySalary: 22000,
    joinedAt: '2023-06-12',
    active: true,
  },
  {
    id: 'stf002',
    name: 'Anitha Rao',
    role: 'Service Technician',
    phone: '+91-98450 44556',
    monthlySalary: 26000,
    joinedAt: '2022-11-01',
    active: true,
  },
  {
    id: 'stf003',
    name: 'Imran Sheikh',
    role: 'Storekeeper',
    phone: '+91-98450 77889',
    monthlySalary: 18000,
    joinedAt: '2024-02-19',
    active: true,
  },
]

/* ──────────────────────────────────────────────
   Attendance — last 6 days (today left open for the owner)
   ────────────────────────────────────────────── */
const attendancePattern: Record<string, ('PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE')[]> = {
  // [Ravi, Anitha, Imran]
  '1': ['PRESENT', 'HALF_DAY', 'PRESENT'],
  '2': ['PRESENT', 'PRESENT', 'PRESENT'],
  '3': ['ABSENT', 'PRESENT', 'PRESENT'],
  '4': ['PRESENT', 'PRESENT', 'PRESENT'],
  '5': ['LEAVE', 'PRESENT', 'PRESENT'],
  '6': ['PRESENT', 'PRESENT', 'HALF_DAY'],
}

const attendance: AttendanceRecord[] = []
Object.entries(attendancePattern).forEach(([ago, statuses]) => {
  const date = daysAgoISO(Number(ago))
  staff.forEach((s, idx) => {
    attendance.push({
      id: `${s.id}|${date}`,
      staffId: s.id,
      date,
      status: statuses[idx],
    })
  })
})

/* ──────────────────────────────────────────────
   Income & expenses — recurring overheads come from
   history.ts, these are the last few days at the counter
   ────────────────────────────────────────────── */
const recentEntries: ExpenseEntry[] = [
  {
    id: 'exp001',
    type: 'EXPENSE',
    category: 'Transport',
    amount: 850,
    date: daysAgoISO(0),
    note: 'Scooter delivery — 3 customer drops',
    method: 'CASH',
  },
  {
    id: 'exp002',
    type: 'INCOME',
    category: 'Service Income',
    amount: 1200,
    date: daysAgoISO(0),
    note: 'Screen replacement — walk-in customer',
    method: 'CASH',
  },
  {
    id: 'exp003',
    type: 'EXPENSE',
    category: 'Supplies',
    amount: 1450,
    date: daysAgoISO(1),
    note: 'Thermal paper rolls + packing material',
    method: 'UPI',
  },
  {
    id: 'exp004',
    type: 'EXPENSE',
    category: 'Marketing',
    amount: 2000,
    date: daysAgoISO(1),
    note: 'Google Ads — festive campaign',
    method: 'CARD',
  },
  {
    id: 'exp006',
    type: 'EXPENSE',
    category: 'Transport',
    amount: 650,
    date: daysAgoISO(2),
    note: 'Courier — spare parts from distributor',
    method: 'CASH',
  },
  {
    id: 'exp009',
    type: 'INCOME',
    category: 'Accessories Income',
    amount: 3400,
    date: daysAgoISO(6),
    note: 'Screen guards & cases — bulk sale',
    method: 'UPI',
  },
]

const expenses: ExpenseEntry[] = [
  ...recentEntries,
  ...generateExpenses(staff),
].sort((a, b) => b.date.localeCompare(a.date))

/* ──────────────────────────────────────────────
   Initial state
   ────────────────────────────────────────────── */
export function buildInitialState(): ERPState {
  return {
    business: BUSINESS,
    products: enrichedProducts.map((p) => ({
      ...p,
      lastStockUpdate: lastMovement.get(p.id) ?? daysAgoISO(2),
    })),
    customers: seedCustomers,
    sales: book.sales,
    ledger,
    stock,
    staff,
    attendance,
    expenses,
    invoiceSeq: book.invoiceSeq,
    version: 2,
  }
}
