# Hambire Electronics ERP

A front-end ERP dashboard prototype for a single-shop Indian electronics retailer: GST billing counter, inventory, customer udhaar ledger, staff attendance, day book, and P&L/GST reports. Built with Next.js (App Router), React, and Tailwind CSS.

> **Status:** Working prototype with realistic seeded demo data. All data lives in the browser (`localStorage`) — there is no backend, database, or authentication. Intended as a front-end portfolio piece and a demo for shop-counter workflows, not a production system.

## What it does

The app simulates a full day-to-day workflow for an electronics shop owner:

- Raise a GST tax invoice at the billing counter (barcode scan or name search, cart, payment split, udhaar option)
- Share the bill with the customer over WhatsApp, or print it
- Track stock levels with low-stock alerts and a full movement history
- Maintain per-customer udhaar (credit) ledgers and record collections
- Mark staff attendance, pay salaries (auto-posted to expenses)
- Record shop income/expenses and review the daily Day Book register
- Analyse Profit & Loss and GST-by-slab reports with charts

## Key features

- **Billing counter** — barcode/name search with keyboard flow (Enter to add), quantity stepper, CASH / CARD / UPI / UDHAAR payment modes, printable GST receipt, WhatsApp bill sharing
- **GST handling** — per-category rate slabs (0/5/12/18/28%) with HSN codes, CGST+SGST split, receipt shows taxable value and tax breakup
- **Udhaar ledger** — per-customer running balance, oldest-due-first allocation on collection, overdue badges
- **Inventory** — live levels, low/out filters, quick +/- adjust, adjustment reasons (sale, purchase, wastage, return), movement log
- **Day Book** — every bill, payment, and expense for a selected day with cash-in / udhaar / payments / expenses / net cards
- **Reports** — P&L statement (gross sales, refunds, COGS, opex, net profit + margin), GST payable by slab and by month, revenue trend, top customers
- **Trilingual UI** — English / Hindi / combined mode switcher in the sidebar (persisted, instant, no reload)
- **Dark + light themes**, collapsible sidebar, mobile drawer navigation, custom cursor (fine-pointer devices only)
- **Local-first demo** — seeded 6-month history, JSON backup export/import, one-click demo reset, cross-tab sync

## Main modules

| Route | Module | Purpose |
|---|---|---|
| `/dashboard` | Overview | Sales/collected/udhaar/low-stock KPI cards, today's activity, dues list, category chart |
| `/billing` | Bills | Bill history with search, PAID/DUE filter, collect-dues flow, receipt reprint |
| `/billing/new` | Counter | The point-of-sale screen: search, cart, customer, payment, receipt |
| `/daybook` | Day Book | Daily register with prev/next-day navigation |
| `/products` | Catalogue | Product CRUD, category-driven GST/HSN suggestion, low-stock thresholds |
| `/stock` | Inventory | Levels + movements tabs, quick adjust |
| `/sales` | Sales history | Every bill with receipt, refund (restores stock, reverses udhaar), share |
| `/customers` | Customers | Directory sorted by balance, with dues/overdue filters |
| `/customers/[id]` | Ledger | Per-customer ledger, receive payment, WhatsApp link |
| `/staff` | Team | Attendance marking (present/half-day/absent/leave), salary payment |
| `/expenses` | Income & expenses | Ledger with month totals, add/delete entries |
| `/reports` | Analytics | P&L and GST tabs with charts and top customers |
| `/settings` | Setup | Business profile (prints on invoices), backup/restore, demo reset |

## Technical highlights

- React Context + `useState` store with memoised selectors (`customerBalance`, `saleOutstanding`, `isLowStock`)
- Single-document `localStorage` persistence with hydration guard, identical-payload skip, and `storage`-event cross-tab sync
- Deterministic seeded history (seeded PRNG, ~175 days) so charts and reports look realistic on first load
- Dictionary-based i18n (`en`/`hi` + composed "Both" mode) with a placeholder-safe `tx()` helper
- Reusable UI kit (`Button`, `Badge`, `Card`, `Input`, `Modal` + `Field`, `Table`, `Pagination`) with a barrel export
- Recharts visualisations (category pie, revenue trend, expense breakdown)
- Whole-rupee money rounding throughout; UTC-stable date helpers

## Technology stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4, lucide-react icons, Recharts
- No backend, no database, no auth libraries — browser-only

## Architecture

```
src/
  app/            14 routes (App Router pages, all client components)
  components/
    ui/           Shell (sidebar/mobile/toasts), theme toggle, form primitives
    receipt.tsx   Shared printable GST invoice
    customer-modal.tsx  Quick-add customer dialog
  lib/
    store.tsx     ERP context: state, mutations, persistence, backup
    i18n.tsx      en/hi dictionaries + LanguageProvider
    erp/
      utils.ts    Money/date/GST helpers, invoice numbering, WhatsApp links
      seed.ts     Demo shop assembly (anchors, ledger, staff, expenses)
      history.ts  Deterministic 6-month sales/stock/expense generator
    data/
      electronics-shop.ts  Base catalogue (16 SKUs), customers, sample invoices
  types/          Domain types (Product, Sale, LedgerEntry, Staff, …)
```

State flows one way: pages call store mutations (`recordSale`, `collectPayment`, `adjustStock`, …), the store updates context state, persists to `localStorage`, and every page re-renders from the same source — so dashboard, day book, stock, and reports always agree.

## Screenshots

<!-- TODO: add screenshots to docs/screenshots/ (dashboard.png, billing-new.png,
     daybook.png, reports.png) and embed them here before sharing publicly.
     They could not be captured in this session because the browser window
     was not visible. Suggested captures at 1600px wide, light theme, English:
     Dashboard, /billing/new counter, Day Book, Reports P&L tab. -->

## Installation

Prerequisites: Node.js 18+ and npm.

```bash
git clone <your-repo-url>
cd <repo>
npm install
```

No environment variables are required — the app runs entirely in the browser with seeded demo data.

## Development

```bash
npm run dev     # start dev server at http://localhost:3000
npm run lint    # eslint
npx tsc --noEmit  # type checking
```

## Build

```bash
npm run build   # production build
npm start       # serve the production build
```

## Demo notes

- The demo shop ("Hambire Electronics", Bengaluru) and all customers, bills, and figures are fictional sample data.
- All changes save automatically in the browser. Use the sidebar footer buttons to download a JSON backup or restore the original demo data.

## Current limitations

- Browser-only: data does not sync across devices and clears with site storage; no multi-user or role support
- No real backend, database, payments, or e-invoicing integration
- Seed data is fictional and tuned for demonstration, not accounting accuracy
- Tips walkthrough button is a placeholder; cloud backup is local JSON export/import

## Future improvements

- Real backend with multi-user auth and role-based access
- Server-side persistence with offline queue and conflict handling
- E-invoice / e-way-bill integration and GST return filing formats
- Barcode label printing and thermal receipt layouts
- Automated tests (unit + e2e) and CI checks

## Role

Solo front-end project: product scoping, UI design, state architecture, i18n, charts, and demo data — built as a portfolio piece for a Frontend Developer role.
