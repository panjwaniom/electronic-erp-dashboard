import type {
  Customer,
  ExpenseEntry,
  LedgerEntry,
  PaymentMethod,
  Product,
  Sale,
  SaleItem,
  Staff,
} from '@/types'
import { addDaysISO, daysAgoISO, rupee, splitGst, toISO } from './utils'

/**
 * Deterministic trading history for the demo shop.
 *
 * Everything here is generated from a fixed PRNG seed, so every "restore demo
 * data" produces the exact same believable six months: bills spread across the
 * weeks, udhaar that is mostly settled and occasionally still open, supplier
 * deliveries, and the recurring overheads a real shop pays every month.
 *
 * Dates are relative to *today* rather than hard-coded, so the dashboard, day
 * book and reports are never full of stale zeroes.
 */

/** Rolling window of history — roughly six months. */
export const HISTORY_DAYS = 175

const BILLERS = ['Ravi Kumar', 'Anitha Rao', 'Imran Sheikh']

/* Cheaper, faster-moving lines get billed more often than the flagship boxes. */
const PRODUCT_WEIGHT: Record<string, number> = {
  /* Flagship boxes — the bills that carry the month */
  p001: 5,
  p002: 5,
  p003: 3,
  p004: 5,
  p005: 10,
  p006: 5,
  p007: 8,
  p008: 2,
  p009: 1,
  p010: 8,
  p016: 6,
  /* Counter fast movers — bought several at a time */
  p011: 12,
  p012: 10,
  p013: 11,
  p014: 18,
  p015: 12,
}
const DEFAULT_WEIGHT = 5

/** Anything at or below this is a counter add-on rather than a considered purchase. */
const COUNTER_ITEM_LIMIT = 5000

/** Udhaar is only offered on bills worth remembering — nobody gives credit for a cable. */
const UDHARI_MINIMUM = 10000

const WALK_IN_METHODS: { method: PaymentMethod; weight: number }[] = [
  { method: 'CASH', weight: 45 },
  { method: 'UPI', weight: 40 },
  { method: 'CARD', weight: 15 },
]

const ACCOUNT_METHODS: { method: PaymentMethod; weight: number }[] = [
  { method: 'CARD', weight: 35 },
  { method: 'UPI', weight: 30 },
  { method: 'TRANSFER', weight: 20 },
  { method: 'UDHARI', weight: 15 },
]

const PAY_METHODS: { method: PaymentMethod; weight: number }[] = [
  { method: 'CASH', weight: 40 },
  { method: 'UPI', weight: 40 },
  { method: 'CARD', weight: 12 },
  { method: 'TRANSFER', weight: 8 },
]

/* ──────────────────────────────────────────────
   Deterministic random helpers
   ────────────────────────────────────────────── */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function weightedPick<T>(rand: () => number, pool: T[], weight: (item: T) => number): T {
  const total = pool.reduce((sum, item) => sum + weight(item), 0)
  let roll = rand() * total
  for (const item of pool) {
    roll -= weight(item)
    if (roll <= 0) return item
  }
  return pool[pool.length - 1]
}

function sampleProducts(rand: () => number, products: Product[], count: number): Product[] {
  const pool = [...products]
  const picked: Product[] = []
  while (picked.length < count && pool.length > 0) {
    const item = weightedPick(rand, pool, (p) => PRODUCT_WEIGHT[p.id] ?? DEFAULT_WEIGHT)
    picked.push(item)
    pool.splice(pool.indexOf(item), 1)
  }
  return picked
}

/* ──────────────────────────────────────────────
   Sales
   ────────────────────────────────────────────── */
export interface GeneratedBooks {
  sales: Sale[]
  ledger: LedgerEntry[]
}

function buildItems(rand: () => number, products: Product[]): SaleItem[] {
  const pool = products.length ? products : []
  const counter =
    pool.filter((p) => p.salePrice <= COUNTER_ITEM_LIMIT).length > 0
      ? pool.filter((p) => p.salePrice <= COUNTER_ITEM_LIMIT)
      : pool
  const considered = pool.filter((p) => p.salePrice > COUNTER_ITEM_LIMIT)

  const picked: { product: Product; quantity: number }[] = []
  const addCounterLine = () => {
    if (counter.length === 0) return
    const product = weightedPick(rand, counter, (p) => PRODUCT_WEIGHT[p.id] ?? DEFAULT_WEIGHT)
    if (picked.some((l) => l.product.id === product.id)) return
    const roll = rand()
    const quantity = roll < 0.5 ? 1 : roll < 0.78 ? 2 : roll < 0.92 ? 3 : 4
    picked.push({ product, quantity })
  }

  const roll = rand()
  if (roll < 0.68 || considered.length === 0) {
    /* The everyday transaction: a handful of small lines. */
    const count = 1 + Math.floor(rand() * 4)
    sampleProducts(rand, counter, count).forEach((product) => {
      const lineRoll = rand()
      const quantity = lineRoll < 0.5 ? 1 : lineRoll < 0.78 ? 2 : lineRoll < 0.92 ? 3 : 4
      picked.push({ product, quantity })
    })
  } else if (roll < 0.94) {
    /* One considered purchase, usually with something thrown in. */
    picked.push({
      product: weightedPick(rand, considered, (p) => PRODUCT_WEIGHT[p.id] ?? DEFAULT_WEIGHT),
      quantity: 1,
    })
    if (rand() < 0.5) addCounterLine()
  } else if (rand() < 0.45) {
    /* A proper haul — two flagship lines. */
    sampleProducts(rand, considered, 2).forEach((product) =>
      picked.push({ product, quantity: 1 })
    )
    addCounterLine()
  } else {
    picked.push({
      product: weightedPick(rand, considered, (p) => PRODUCT_WEIGHT[p.id] ?? DEFAULT_WEIGHT),
      quantity: rand() < 0.9 ? 1 : 2,
    })
    addCounterLine()
    addCounterLine()
  }

  if (picked.length === 0 && pool.length > 0) {
    picked.push({ product: pool[0], quantity: 1 })
  }

  return picked.map(({ product, quantity }) => {
    const lineTotal = rupee(product.salePrice * quantity)
    const tax = rupee((lineTotal * product.gstRate) / 100)
    return {
      productId: product.id,
      productName: product.name,
      hsnCode: product.hsnCode,
      gstRate: product.gstRate,
      quantity,
      unitPrice: product.salePrice,
      unitCost: product.costPrice,
      total: lineTotal,
      tax,
    }
  })
}

/** Bills per day — weekends are busier, Sunday is quiet. */
function billsForDay(rand: () => number, daysAgo: number, date: string): number {
  const dow = new Date(`${date}T12:00:00`).getDay()
  const roll = rand()
  let count = roll < 0.2 ? 0 : roll < 0.5 ? 1 : roll < 0.78 ? 2 : roll < 0.93 ? 3 : 4
  if (dow === 0) count = Math.max(0, count - 1)
  if (dow === 6) count += 1
  /* The counter is always busy today and yesterday, so the demo never opens
     on an empty dashboard. */
  if (daysAgo === 0) count = Math.max(count, 3)
  if (daysAgo === 1) count = Math.max(count, 2)
  return count
}

export function generateSales(products: Product[], customers: Customer[]): GeneratedBooks {
  const rand = mulberry32(0x48414d42) // "HAMB"
  const sales: Sale[] = []
  const ledger: LedgerEntry[] = []
  let counter = 0
  const uid = (prefix: string) => `${prefix}h${String(++counter).padStart(4, '0')}`

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo--) {
    const date = daysAgoISO(daysAgo)
    const bills = billsForDay(rand, daysAgo, date)

    for (let b = 0; b < bills; b++) {
      const items = buildItems(rand, products)
      const subtotal = rupee(items.reduce((sum, i) => sum + i.total, 0))
      const tax = rupee(items.reduce((sum, i) => sum + i.tax, 0))
      const total = rupee(subtotal + tax)
      const { cgst, sgst } = splitGst(tax)
      const rates = [...new Set(items.map((i) => i.gstRate))].sort((x, y) => x - y)

      const onAccount = rand() < 0.4
      const customer = onAccount ? customers[Math.floor(rand() * customers.length)] ?? null : null
      const methods = customer
        ? total >= UDHARI_MINIMUM
          ? ACCOUNT_METHODS
          : ACCOUNT_METHODS.filter((m) => m.method !== 'UDHARI')
        : WALK_IN_METHODS
      const method = weightedPick(rand, methods, (m) => m.weight).method

      let paymentStatus: Sale['paymentStatus'] = method === 'UDHARI' ? 'PENDING' : 'PAID'
      const saleId = uid('sale')

      if (method === 'UDHARI' && customer) {
        ledger.push({
          id: uid('led'),
          customerId: customer.id,
          type: 'CREDIT',
          amount: total,
          date,
          reference: '', // filled in once invoice numbers are assigned
          saleId,
          note: `Udhaar sale — ${items[0]?.productName ?? 'items'}`,
        })

        /* Most credit gets cleared within a few weeks; a couple stay open,
           and a stubborn few run past 35 days so the OVERDUE state is real. */
        const neverSettled = daysAgo > 35 && rand() < 0.35
        const settleBy = addDaysISO(date, 5 + Math.floor(rand() * 22))
        if (!neverSettled && daysAgo > 12 && settleBy <= daysAgoISO(0)) {
          const settledInFull = rand() < 0.7
          const amount = settledInFull ? total : rupee(total * (0.35 + rand() * 0.4))
          ledger.push({
            id: uid('led'),
            customerId: customer.id,
            type: 'PAYMENT',
            amount,
            date: settleBy,
            reference: '',
            saleId,
            note: settledInFull ? 'Udhaar settled in full' : 'Part payment received',
            method: weightedPick(rand, PAY_METHODS, (m) => m.weight).method,
          })
          if (settledInFull) paymentStatus = 'PAID'
        } else if (daysAgo > 30) {
          paymentStatus = 'OVERDUE'
        }
      }

      const refunded =
        paymentStatus !== 'PENDING' &&
        paymentStatus !== 'OVERDUE' &&
        daysAgo > 6 &&
        rand() < 0.02

      sales.push({
        id: saleId,
        invoiceNumber: `TMP-${saleId}`,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
        date,
        items,
        subtotal,
        tax,
        total,
        gst: { taxable: subtotal, cgst, sgst, rates },
        paymentMethod: method,
        paymentStatus: refunded ? 'REFUNDED' : paymentStatus,
        status: refunded ? 'REFUNDED' : 'COMPLETED',
        billedBy: BILLERS[Math.floor(rand() * BILLERS.length)],
      })
    }
  }

  return { sales, ledger }
}

/* ──────────────────────────────────────────────
   Stock movement (bills out, supplier deliveries in)
   ────────────────────────────────────────────── */
export interface Delivery {
  productId: string
  productName: string
  quantity: number
  reference: string
  date: string
}

/**
 * Supplier restocks. Quantities track what the counter actually sold so the
 * movement log reads like a shop that reorders instead of one that only drains.
 */
export function supplierDeliveries(
  products: Product[],
  soldOut: Map<string, number>
): Delivery[] {
  const deliveries: Delivery[] = []

  const rand = mulberry32(0x504f5300) // "PO"
  const events = [170, 140, 112, 84, 55, 24]
  products.forEach((product, index) => {
    const out = soldOut.get(product.id) ?? 0
    /* Replenish what the counter actually moved, plus today's shelf count. */
    const perEvent = Math.max(5, Math.ceil((out + product.currentStock) / events.length / 5) * 5)
    events.forEach((daysAgo, i) => {
      if (i % 2 === 1 && (index + i) % 3 === 0) return // not every product arrives every time
      const date = daysAgoISO(Math.max(1, daysAgo - index))
      const suffix = String(Math.floor(rand() * 90) + 10)
      deliveries.push({
        productId: product.id,
        productName: product.name,
        quantity: perEvent + (i % 2 === 0 ? Math.floor(rand() * 5) : 0),
        reference: `PO-${date.replace(/-/g, '').slice(2)}-${suffix}`,
        date,
      })
    })
  })

  return deliveries
}

/* ──────────────────────────────────────────────
   Recurring overheads + one-off spends
   ────────────────────────────────────────────── */
const ONE_OFFS: {
  category: ExpenseEntry['category']
  note: (rand: () => number) => string
  min: number
  max: number
  type: ExpenseEntry['type']
}[] = [
  { category: 'Transport', note: () => 'Scooter delivery — customer drops', min: 450, max: 1400, type: 'EXPENSE' },
  { category: 'Transport', note: () => 'Courier — spare parts from distributor', min: 500, max: 1800, type: 'EXPENSE' },
  { category: 'Supplies', note: () => 'Thermal paper rolls + packing material', min: 800, max: 2200, type: 'EXPENSE' },
  { category: 'Repairs', note: () => 'Shutter motor service', min: 1500, max: 4000, type: 'EXPENSE' },
  { category: 'Repairs', note: () => 'Inverter battery replacement', min: 3000, max: 7000, type: 'EXPENSE' },
  { category: 'Marketing', note: (rand) => (rand() < 0.5 ? 'Google Ads — festive campaign' : 'JustDial listing renewal'), min: 1500, max: 5000, type: 'EXPENSE' },
  { category: 'Service Income', note: () => 'Screen replacement — walk-in customer', min: 900, max: 3500, type: 'INCOME' },
  { category: 'Accessories Income', note: () => 'Screen guards & cases — bulk sale', min: 1200, max: 4800, type: 'INCOME' },
  { category: 'Service Income', note: () => 'Laptop service + cleaning', min: 1500, max: 4500, type: 'INCOME' },
]

function monthPrefixesBack(count: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(toISO(d).slice(0, 7))
  }
  return out
}

export function generateExpenses(staff: Staff[]): ExpenseEntry[] {
  const rand = mulberry32(0x53484f50) // "SHOP"
  const entries: ExpenseEntry[] = []
  const today = daysAgoISO(0)
  let counter = 0
  const uid = () => `exph${String(++counter).padStart(4, '0')}`

  const add = (
    type: ExpenseEntry['type'],
    category: ExpenseEntry['category'],
    amount: number,
    date: string,
    note: string,
    method: ExpenseEntry['method'],
    staffId?: string
  ) => {
    if (date > today) return
    entries.push({ id: uid(), type, category, amount: rupee(amount), date, note, method, staffId })
  }

  /* Monthly overheads — the shape of a real shop's ledger. */
  monthPrefixesBack(6).forEach((prefix) => {
    add('EXPENSE', 'Rent', 18000, `${prefix}-03`, 'Shop rent', 'TRANSFER')
    add('EXPENSE', 'Electricity', 2900 + rand() * 900, `${prefix}-12`, 'BESCOM electricity bill', 'UPI')
    add('EXPENSE', 'Supplies', 699, `${prefix}-08`, 'Internet + telephone bill', 'UPI')
    staff.forEach((member) => {
      add(
        'EXPENSE',
        'Salary',
        member.monthlySalary,
        `${prefix}-01`,
        `Salary — ${member.name} (${prefix})`,
        'TRANSFER',
        member.id
      )
    })
  })

  /* Irregular spends so monthly P&L has texture. */
  ONE_OFFS.forEach((spend, i) => {
    const daysAgo = 8 + i * 17 + Math.floor(rand() * 9)
    if (daysAgo > HISTORY_DAYS) return
    const amount = spend.min + rand() * (spend.max - spend.min)
    add(
      spend.type,
      spend.category,
      amount,
      daysAgoISO(daysAgo),
      spend.note(rand),
      weightedPick(rand, PAY_METHODS, (m) => m.weight).method as ExpenseEntry['method']
    )
  })

  return entries.sort((a, b) => b.date.localeCompare(a.date))
}
