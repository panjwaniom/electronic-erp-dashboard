export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  postalCode: string
  companyName?: string
  createdAt: string
  totalPurchases: number
  lastPurchase?: string
  /** Outstanding udhari (credit) balance — derived from ledger entries */
  udhariBalance?: number
}

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  subcategory?: string
  brand?: string
  costPrice: number
  salePrice: number
  /** GST rate in percent: 0 / 5 / 12 / 18 / 28 */
  gstRate: number
  hsnCode?: string
  currentStock: number
  minimumStock: number
  maximumStock: number
  reorderPoint: number
  description?: string
  barcode: string
  imageUrl?: string
  lastStockUpdate?: string
  totalSold: number
}

export interface StockTransaction {
  id: string
  productId: string
  productName: string
  type: 'IN' | 'OUT'
  quantity: number
  reference: string
  reason: string
  date: string
  user: string
}

export interface SaleItem {
  productId: string
  productName: string
  hsnCode?: string
  gstRate: number
  quantity: number
  /** Price per unit excluding GST */
  unitPrice: number
  /** Cost price per unit at time of sale (for P&L) */
  unitCost: number
  total: number
  tax: number
}

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'TRANSFER' | 'UDHARI'
export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'REFUNDED'

export interface GstBreakup {
  taxable: number
  cgst: number
  sgst: number
  rates: number[]
}

export interface Sale {
  id: string
  invoiceNumber: string
  customerId: string | null
  customerName: string | null
  customerPhone?: string | null
  date: string
  items: SaleItem[]
  subtotal: number
  tax: number
  total: number
  gst: GstBreakup
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  status: 'COMPLETED' | 'REFUNDED'
  /** Staff member who billed */
  billedBy?: string
  notes?: string
}

/* ── Udhari (customer credit) ledger ── */
export interface LedgerEntry {
  id: string
  customerId: string
  /** CREDIT = udhari given (sale on credit), PAYMENT = amount received, ADJUST = manual note */
  type: 'CREDIT' | 'PAYMENT' | 'ADJUST'
  amount: number
  date: string
  /** Invoice number or free note */
  reference: string
  /** Sale this entry settles (for per-bill outstanding tracking) */
  saleId?: string
  note?: string
  method?: PaymentMethod
}

/* ── Staff ── */
export interface Staff {
  id: string
  name: string
  role: string
  phone: string
  monthlySalary: number
  joinedAt: string
  active: boolean
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'

export interface AttendanceRecord {
  id: string
  staffId: string
  /** ISO date yyyy-mm-dd */
  date: string
  status: AttendanceStatus
}

/* ── Income & expenses ── */
export type EntryType = 'INCOME' | 'EXPENSE'
export type ExpenseCategory =
  | 'Salary'
  | 'Rent'
  | 'Electricity'
  | 'Transport'
  | 'Marketing'
  | 'Repairs'
  | 'Supplies'
  | 'Purchase'
  | 'Service Income'
  | 'Accessories Income'
  | 'Other'

export interface ExpenseEntry {
  id: string
  type: EntryType
  category: ExpenseCategory
  amount: number
  date: string
  note: string
  method: Exclude<PaymentMethod, 'UDHARI'>
  staffId?: string
  productId?: string
}

/* ── Business identity (invoice header) ── */
export interface BusinessInfo {
  name: string
  legalName: string
  tagline: string
  gstin: string
  state: string
  stateCode: string
  address: string
  phone: string
  email: string
  invoicePrefix: string
}

/* ── Day Book ── */
export type DayBookKind = 'BILL' | 'CREDIT' | 'PAYMENT' | 'ADJUST' | 'EXPENSE' | 'INCOME' | 'STOCK_IN' | 'STOCK_OUT'

export interface DayBookEntry {
  id: string
  kind: DayBookKind
  time: string
  title: string
  subtitle?: string
  /** Positive = money in, negative = money out, 0 = informational */
  amount: number
  date: string
}

/* Legacy shapes kept for backwards compatibility with prototype data */
export interface InvoiceItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  customerId: string
  customerName: string
  date: string
  dueDate: string
  subtotal: number
  tax: number
  total: number
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE'
  items: InvoiceItem[]
  notes?: string
}

/* ── Full application state (persisted as one document) ── */
export interface ERPState {
  business: BusinessInfo
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  ledger: LedgerEntry[]
  stock: StockTransaction[]
  staff: Staff[]
  attendance: AttendanceRecord[]
  expenses: ExpenseEntry[]
  /** Next invoice sequence number */
  invoiceSeq: number
  /** Schema version for future migrations */
  version: number
}

/* ── Legacy prototype shapes (source data before store) ── */
export interface LegacySaleItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface LegacySale {
  id: string
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  date: string
  items: LegacySaleItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: PaymentMethod
  status: 'COMPLETED' | 'REFUNDED'
}

export interface ReportStats {
  totalSales: number
  totalRevenue: number
  totalCustomers: number
  totalProducts: number
  lowStockProducts: number
  topProducts: TopProduct[]
}

export interface TopProduct {
  id: string
  name: string
  totalSold: number
  revenue: number
}

export interface DashboardStats {
  totalRevenue: number
  totalSales: number
  lowStockAlerts: number
  pendingInvoices: number
}
