"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type {
  AttendanceRecord,
  AttendanceStatus,
  BusinessInfo,
  Customer,
  ERPState,
  ExpenseCategory,
  ExpenseEntry,
  LedgerEntry,
  PaymentMethod,
  Product,
  Sale,
  Staff,
} from '@/types'
import { buildInitialState } from './erp/seed'
import {
  nextInvoiceNumber,
  rupee,
  splitGst,
  todayISO,
} from './erp/utils'

const STORAGE_KEY = 'hambire-erp-state-v2'

/* ──────────────────────────────────────────────
   Small id helper
   ────────────────────────────────────────────── */
let counter = 0
function uid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`
}

/* ──────────────────────────────────────────────
   Pure selectors (usable without the provider)
   ────────────────────────────────────────────── */
export function isLowStock(p: Product): boolean {
  return p.currentStock <= p.minimumStock
}

export function customerBalance(customerId: string, ledger: LedgerEntry[]): number {
  return ledger
    .filter((l) => l.customerId === customerId)
    .reduce((sum, l) => {
      if (l.type === 'CREDIT') return sum + l.amount
      if (l.type === 'PAYMENT') return sum - l.amount
      return sum + l.amount // ADJUST carries signed amounts
    }, 0)
}

export function saleOutstanding(sale: Sale, ledger: LedgerEntry[]): number {
  if (sale.status === 'REFUNDED') return 0
  if (sale.paymentStatus !== 'PENDING' && sale.paymentStatus !== 'OVERDUE') return 0
  return Math.max(
    0,
    ledger
      .filter((l) => l.saleId === sale.id)
      .reduce((sum, l) => {
        if (l.type === 'ADJUST') return sum + l.amount // signed: waivers/reversals cut what's owed
        return l.type === 'CREDIT' ? sum + l.amount : sum - l.amount
      }, 0)
  )
}

export interface ToastMsg {
  id: string
  message: string
  tone: 'success' | 'error' | 'info'
}

export interface NewSaleInput {
  customerId: string | null
  items: { productId: string; quantity: number }[]
  paymentMethod: PaymentMethod
  billedBy?: string
  notes?: string
}

export interface ERPContextValue {
  state: ERPState
  ready: boolean
  savedAt: number | null
  toasts: ToastMsg[]
  notify: (message: string, tone?: ToastMsg['tone']) => void
  dismissToast: (id: string) => void
  /* billing */
  recordSale: (input: NewSaleInput) => Sale
  refundSale: (saleId: string) => void
  collectPayment: (opts: {
    customerId: string
    amount: number
    method: Exclude<PaymentMethod, 'UDHARI'>
    saleId?: string
    note?: string
  }) => number
  /* catalogue */
  addProduct: (input: Partial<Product>) => Product
  updateProduct: (id: string, patch: Partial<Product>) => void
  adjustStock: (productId: string, delta: number, reason: string) => void
  /* customers */
  addCustomer: (input: Partial<Customer>) => Customer
  updateCustomer: (id: string, patch: Partial<Customer>) => void
  /* shop identity (invoice header, WhatsApp footer, GSTIN) */
  updateBusiness: (patch: Partial<BusinessInfo>) => void
  /* staff */
  addStaff: (input: Partial<Staff>) => Staff
  updateStaff: (id: string, patch: Partial<Staff>) => void
  setAttendance: (staffId: string, date: string, status: AttendanceStatus | null) => void
  paySalary: (staffId: string, month: string) => void
  /* money in/out */
  addExpense: (input: {
    type: 'INCOME' | 'EXPENSE'
    category: ExpenseCategory
    amount: number
    date: string
    note: string
    method: Exclude<PaymentMethod, 'UDHARI'>
    staffId?: string
  }) => void
  deleteExpense: (id: string) => void
  /* backup / data safety */
  exportBackup: () => void
  importBackup: (json: string) => void
  resetDemoData: () => void
}

const ERPContext = createContext<ERPContextValue | null>(null)

export function useERP(): ERPContextValue {
  const ctx = useContext(ERPContext)
  if (!ctx) throw new Error('useERP must be used inside <ERPProvider>')
  return ctx
}

/* ──────────────────────────────────────────────
   Timestamp of the last successful write.

   Published as an external store (rather than setState from an effect) so the
   auto-save effect can report "saved at" without scheduling a cascading render.
   ────────────────────────────────────────────── */
let lastSavedAt: number | null = null
const savedAtListeners = new Set<() => void>()

function markSaved() {
  lastSavedAt = Date.now()
  savedAtListeners.forEach((notify) => notify())
}

function subscribeSavedAt(onStoreChange: () => void) {
  savedAtListeners.add(onStoreChange)
  return () => {
    savedAtListeners.delete(onStoreChange)
  }
}

/* ──────────────────────────────────────────────
   Provider
   ────────────────────────────────────────────── */
export function ERPProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ERPState>(() => buildInitialState())
  const [ready, setReady] = useState(false)
  const savedAt = useSyncExternalStore(
    subscribeSavedAt,
    () => lastSavedAt,
    () => null
  )
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const lastSerialized = useRef<string | null>(null)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const seqRef = useRef(1)

  /* hydrate from local storage after mount — `ready` flips in the SAME batch as
     the loaded state, so the auto-save effect never writes the pre-load seed.
     React requires this setState-in-effect: reading localStorage during render
     would hydrate against a different tree than the prerendered server HTML. */
  useEffect(() => {
    const pending = timers.current
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        lastSerialized.current = raw
        markSaved()
        const parsed = JSON.parse(raw) as ERPState
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.sales)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount hydration
          setState({ ...buildInitialState(), ...parsed })
        }
      }
    } catch {
      /* corrupt storage — fall back to seed */
    }
    setReady(true)
    return () => {
      pending.forEach(clearTimeout)
    }
  }, [])

  /* adopt writes from other tabs instead of clobbering them */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (!e.newValue) {
        /* storage cleared (demo reset in another tab) — follow along */
        lastSerialized.current = null
        setState(buildInitialState())
        return
      }
      if (e.newValue === lastSerialized.current) return
      try {
        const parsed = JSON.parse(e.newValue) as ERPState
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.sales)) {
          lastSerialized.current = e.newValue
          setState((prev) => ({ ...prev, ...parsed }))
        }
      } catch {
        /* ignore malformed external writes */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* keep invoice sequence mirror for rapid successive bills */
  useEffect(() => {
    seqRef.current = Math.max(seqRef.current, state.invoiceSeq)
  }, [state.invoiceSeq])

  /* auto-save on every change — gated on `ready` (post-hydration), and skips
     identical payloads (no cross-tab ping-pong) */
  useEffect(() => {
    if (!ready) return
    try {
      const raw = JSON.stringify(state)
      if (raw === lastSerialized.current) return
      lastSerialized.current = raw
      localStorage.setItem(STORAGE_KEY, raw)
      markSaved()
    } catch {
      /* quota exceeded — keep working in memory */
    }
  }, [state, ready])

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastMsg['tone'] = 'success') => {
      const id = uid('toast')
      setToasts((t) => [...t.slice(-2), { id, message, tone }])
      const timer = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id))
        timers.current.delete(timer)
      }, 3600)
      timers.current.add(timer)
    },
    []
  )

  /* ───────── Billing ───────── */
  const recordSale = useCallback(
    (input: NewSaleInput): Sale => {
      if (input.items.length === 0) throw new Error('Add at least one item to the bill')

      const customer = input.customerId
        ? state.customers.find((c) => c.id === input.customerId) ?? null
        : null

      const items = input.items.map(({ productId, quantity }) => {
        const product = state.products.find((p) => p.id === productId)
        if (!product) throw new Error('Product not found')
        if (quantity < 1) throw new Error(`Invalid quantity for ${product.name}`)
        if (product.currentStock < quantity) {
          throw new Error(
            `Only ${product.currentStock} left in stock for ${product.name}`
          )
        }
        const lineTotal = rupee(product.salePrice * quantity)
        const tax = rupee((lineTotal * product.gstRate) / 100)
        return {
          productId,
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

      const subtotal = rupee(items.reduce((s, i) => s + i.total, 0))
      const tax = rupee(items.reduce((s, i) => s + i.tax, 0))
      const total = rupee(subtotal + tax)
      const { cgst, sgst } = splitGst(tax)
      const rates = [...new Set(items.map((i) => i.gstRate))].sort((a, b) => a - b)
      const date = todayISO()

      const isUdhari = input.paymentMethod === 'UDHARI'
      const seq = Math.max(seqRef.current, state.invoiceSeq)
      seqRef.current = seq + 1
      const invoiceNumber = nextInvoiceNumber(seq, state.business.invoicePrefix)

      const sale: Sale = {
        id: uid('sale'),
        invoiceNumber,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
        date,
        items,
        subtotal,
        tax,
        total,
        gst: { taxable: subtotal, cgst, sgst, rates },
        paymentMethod: input.paymentMethod,
        paymentStatus: isUdhari ? 'PENDING' : 'PAID',
        status: 'COMPLETED',
        billedBy: input.billedBy ?? 'Counter',
        notes: input.notes,
      }

      const ledgerAdd: LedgerEntry[] = []
      if (isUdhari && customer) {
        ledgerAdd.push({
          id: uid('led'),
          customerId: customer.id,
          type: 'CREDIT',
          amount: total,
          date,
          reference: invoiceNumber,
          saleId: sale.id,
          note: `Udhaar sale — ${invoiceNumber}`,
        })
      }

      const stockAdd = items.map((i) => ({
        id: uid('stk'),
        productId: i.productId,
        productName: i.productName,
        type: 'OUT' as const,
        quantity: i.quantity,
        reference: invoiceNumber,
        reason: 'Sale',
        date,
        user: sale.billedBy ?? 'Counter',
      }))

      setState((prev) => ({
        ...prev,
        invoiceSeq: Math.max(prev.invoiceSeq, seq + 1),
        sales: [sale, ...prev.sales],
        ledger: [...prev.ledger, ...ledgerAdd],
        stock: [...stockAdd, ...prev.stock],
        products: prev.products.map((p) => {
          const line = items.find((i) => i.productId === p.id)
          if (!line) return p
          return {
            ...p,
            currentStock: p.currentStock - line.quantity,
            totalSold: p.totalSold + line.quantity,
            lastStockUpdate: date,
          }
        }),
        customers: prev.customers.map((c) =>
          c.id === customer?.id
            ? {
                ...c,
                totalPurchases: c.totalPurchases + total,
                lastPurchase: date,
              }
            : c
        ),
      }))

      return sale
    },
    [state.customers, state.products, state.invoiceSeq, state.business.invoicePrefix]
  )

  const refundSale = useCallback((saleId: string) => {
    setState((prev) => {
      const sale = prev.sales.find((s) => s.id === saleId)
      if (!sale || sale.status === 'REFUNDED') return prev
      const date = todayISO()

      const restockTx = sale.items.map((i) => ({
        id: uid('stk'),
        productId: i.productId,
        productName: i.productName,
        type: 'IN' as const,
        quantity: i.quantity,
        reference: sale.invoiceNumber,
        reason: 'Refund restock',
        date,
        user: 'Counter',
      }))

      const creditTotal = prev.ledger
        .filter((l) => l.saleId === sale.id && l.type === 'CREDIT')
        .reduce((s, l) => s + l.amount, 0)

      const reversals: LedgerEntry[] = []
      if (creditTotal > 0 && sale.customerId) {
        reversals.push({
          id: uid('led'),
          customerId: sale.customerId,
          type: 'ADJUST',
          amount: -creditTotal,
          date,
          reference: sale.invoiceNumber,
          note: `Refund — udhaar reversed for ${sale.invoiceNumber}`,
        })
      }

      return {
        ...prev,
        sales: prev.sales.map((s) =>
          s.id === saleId
            ? { ...s, status: 'REFUNDED', paymentStatus: 'REFUNDED' }
            : s
        ),
        ledger: [...prev.ledger, ...reversals],
        stock: [...restockTx, ...prev.stock],
        products: prev.products.map((p) => {
          const line = sale.items.find((i) => i.productId === p.id)
          if (!line) return p
          return {
            ...p,
            currentStock: p.currentStock + line.quantity,
            totalSold: Math.max(0, p.totalSold - line.quantity),
            lastStockUpdate: date,
          }
        }),
      }
    })
  }, [])

  const collectPayment = useCallback<ERPContextValue['collectPayment']>(
    ({ customerId, amount, method, saleId, note }) => {
      /* Whole-rupee rule: a typed amount like 500.5 must not create ledger
         rows that no longer add up to the totals shown next to them. */
      const target = rupee(amount)
      if (target <= 0) return 0
      const date = todayISO()

      /* Precompute everything from the current snapshot so the state
         updater stays pure (StrictMode invokes updaters twice). */
      const targets = state.sales
        .filter(
          (s) =>
            s.customerId === customerId &&
            (s.paymentStatus === 'PENDING' || s.paymentStatus === 'OVERDUE') &&
            s.status !== 'REFUNDED' &&
            (!saleId || s.id === saleId)
        )
        .sort((a, b) => a.date.localeCompare(b.date))

      const entries: LedgerEntry[] = []
      const saleUpdates = new Map<string, Sale>()
      let remaining = target
      let allocated = 0

      for (const sale of targets) {
        if (remaining <= 0) break
        const outstanding = saleOutstanding(sale, state.ledger)
        if (outstanding <= 0) continue
        const pay = Math.min(outstanding, remaining)
        remaining -= pay
        allocated += pay
        entries.push({
          id: uid('led'),
          customerId,
          type: 'PAYMENT',
          amount: pay,
          date,
          reference: sale.invoiceNumber,
          saleId: sale.id,
          note: note ?? `Payment received via ${method}`,
          method,
        })
        if (pay >= outstanding - 0.5) {
          saleUpdates.set(sale.id, { ...sale, paymentStatus: 'PAID' })
        }
      }

      /* Anything left over with no open bill becomes an advance */
      if (remaining > 0.5 && !saleId) {
        entries.push({
          id: uid('led'),
          customerId,
          type: 'PAYMENT',
          amount: remaining,
          date,
          reference: 'ADVANCE',
          note: note ?? `Advance received via ${method}`,
          method,
        })
        allocated += remaining
      }

      if (entries.length === 0) return allocated

      setState((prev) => ({
        ...prev,
        ledger: [...prev.ledger, ...entries],
        sales: prev.sales.map((s) => (saleUpdates.get(s.id) ?? s)),
      }))

      return allocated
    },
    [state.sales, state.ledger]
  )

  /* ───────── Catalogue ───────── */
  const addProduct = useCallback<ERPContextValue['addProduct']>((input) => {
    const product: Product = {
      id: uid('p'),
      name: input.name ?? 'Untitled product',
      sku: input.sku ?? `SKU-${Date.now().toString(36).toUpperCase()}`,
      category: input.category ?? 'Accessories',
      subcategory: input.subcategory,
      brand: input.brand,
      costPrice: rupee(input.costPrice ?? 0),
      salePrice: rupee(input.salePrice ?? 0),
      gstRate: input.gstRate ?? 18,
      hsnCode: input.hsnCode,
      currentStock: input.currentStock ?? 0,
      minimumStock: input.minimumStock ?? 5,
      maximumStock: input.maximumStock ?? 100,
      reorderPoint: input.reorderPoint ?? Math.max(2, Math.floor((input.minimumStock ?? 5) * 1.5)),
      description: input.description,
      barcode: input.barcode ?? String(Date.now()).slice(-13),
      imageUrl: input.imageUrl,
      lastStockUpdate: todayISO(),
      totalSold: 0,
    }
    setState((prev) => ({
      ...prev,
      products: [product, ...prev.products],
      stock: [
        {
          id: uid('stk'),
          productId: product.id,
          productName: product.name,
          type: 'IN',
          quantity: product.currentStock,
          reference: 'OPENING',
          reason: 'Opening stock',
          date: todayISO(),
          user: 'Counter',
        },
        ...prev.stock,
      ],
    }))
    return product
  }, [])

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }, [])

  const adjustStock = useCallback((productId: string, delta: number, reason: string) => {
    if (delta === 0) return
    setState((prev) => {
      const product = prev.products.find((p) => p.id === productId)
      if (!product) return prev
      const nextStock = Math.max(0, product.currentStock + delta)
      const date = todayISO()
      return {
        ...prev,
        products: prev.products.map((p) =>
          p.id === productId
            ? { ...p, currentStock: nextStock, lastStockUpdate: date }
            : p
        ),
        stock: [
          {
            id: uid('stk'),
            productId,
            productName: product.name,
            type: delta > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(delta),
            reference: 'MANUAL',
            reason,
            date,
            user: 'Counter',
          },
          ...prev.stock,
        ],
      }
    })
  }, [])

  /* ───────── Customers ───────── */
  const addCustomer = useCallback<ERPContextValue['addCustomer']>((input) => {
    const customer: Customer = {
      id: uid('c'),
      name: input.name ?? 'Walk-in customer',
      email: input.email ?? '',
      phone: input.phone ?? '',
      address: input.address ?? '',
      city: input.city ?? '',
      state: input.state ?? '',
      postalCode: input.postalCode ?? '',
      companyName: input.companyName,
      createdAt: todayISO(),
      totalPurchases: input.totalPurchases ?? 0,
      lastPurchase: input.lastPurchase,
    }
    setState((prev) => ({ ...prev, customers: [customer, ...prev.customers] }))
    return customer
  }, [])

  const updateCustomer = useCallback((id: string, patch: Partial<Customer>) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  const updateBusiness = useCallback((patch: Partial<BusinessInfo>) => {
    setState((prev) => ({ ...prev, business: { ...prev.business, ...patch } }))
  }, [])

  /* ───────── Staff ───────── */
  const addStaff = useCallback<ERPContextValue['addStaff']>((input) => {
    const member: Staff = {
      id: uid('stf'),
      name: input.name ?? 'New staff',
      role: input.role ?? 'Sales',
      phone: input.phone ?? '',
      monthlySalary: rupee(input.monthlySalary ?? 0),
      joinedAt: input.joinedAt ?? todayISO(),
      active: true,
    }
    setState((prev) => ({ ...prev, staff: [...prev.staff, member] }))
    return member
  }, [])

  const updateStaff = useCallback((id: string, patch: Partial<Staff>) => {
    setState((prev) => ({
      ...prev,
      staff: prev.staff.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }, [])

  const setAttendance = useCallback(
    (staffId: string, date: string, status: AttendanceStatus | null) => {
      setState((prev) => {
        const id = `${staffId}|${date}`
        if (status === null) {
          return { ...prev, attendance: prev.attendance.filter((a) => a.id !== id) }
        }
        const existing = prev.attendance.find((a) => a.id === id)
        if (existing) {
          return {
            ...prev,
            attendance: prev.attendance.map((a) => (a.id === id ? { ...a, status } : a)),
          }
        }
        const record: AttendanceRecord = { id, staffId, date, status }
        return { ...prev, attendance: [...prev.attendance, record] }
      })
    },
    []
  )

  const paySalary = useCallback((staffId: string, month: string) => {
    setState((prev) => {
      const member = prev.staff.find((s) => s.id === staffId)
      if (!member) return prev
      const alreadyPaid = prev.expenses.some(
        (e) =>
          e.type === 'EXPENSE' &&
          e.category === 'Salary' &&
          e.staffId === staffId &&
          e.date.startsWith(month)
      )
      if (alreadyPaid) return prev
      const entry: ExpenseEntry = {
        id: uid('exp'),
        type: 'EXPENSE',
        category: 'Salary',
        amount: member.monthlySalary,
        date: todayISO(),
        note: `Salary — ${member.name} (${month})`,
        method: 'TRANSFER',
        staffId,
      }
      return { ...prev, expenses: [entry, ...prev.expenses] }
    })
  }, [])

  /* ───────── Money in / out ───────── */
  const addExpense = useCallback<ERPContextValue['addExpense']>((input) => {
    const entry: ExpenseEntry = {
      id: uid('exp'),
      type: input.type,
      category: input.category,
      amount: rupee(Math.abs(input.amount)),
      date: input.date || todayISO(),
      note: input.note,
      method: input.method,
      staffId: input.staffId,
    }
    setState((prev) => ({ ...prev, expenses: [entry, ...prev.expenses] }))
  }, [])

  const deleteExpense = useCallback((id: string) => {
    setState((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) }))
  }, [])

  /* ───────── Backup & data safety ───────── */
  const exportBackup = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hambire-erp-backup-${todayISO()}.json`
      a.click()
      URL.revokeObjectURL(url)
      notify('Backup downloaded to your device', 'success')
    } catch {
      notify('Could not create backup file', 'error')
    }
  }, [state, notify])

  const importBackup = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as ERPState
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) {
        throw new Error('bad shape')
      }
      setState({ ...buildInitialState(), ...parsed })
      notify('Backup restored successfully', 'success')
    } catch {
      notify('Invalid backup file', 'error')
    }
  }, [notify])

  const resetDemoData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setState(buildInitialState())
    notify('Demo data restored', 'info')
  }, [notify])

  const value = useMemo<ERPContextValue>(
    () => ({
      state,
      ready,
      savedAt,
      toasts,
      notify,
      dismissToast,
      recordSale,
      refundSale,
      collectPayment,
      addProduct,
      updateProduct,
      adjustStock,
      addCustomer,
      updateCustomer,
      updateBusiness,
      addStaff,
      updateStaff,
      setAttendance,
      paySalary,
      addExpense,
      deleteExpense,
      exportBackup,
      importBackup,
      resetDemoData,
    }),
    [
      state,
      ready,
      savedAt,
      toasts,
      notify,
      dismissToast,
      recordSale,
      refundSale,
      collectPayment,
      addProduct,
      updateProduct,
      adjustStock,
      addCustomer,
      updateCustomer,
      updateBusiness,
      addStaff,
      updateStaff,
      setAttendance,
      paySalary,
      addExpense,
      deleteExpense,
      exportBackup,
      importBackup,
      resetDemoData,
    ]
  )

  return <ERPContext.Provider value={value}>{children}</ERPContext.Provider>
}
