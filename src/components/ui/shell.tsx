"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  AlertCircle,
  Download,
  Info,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"
import { useERP } from "@/lib/store"
import { useLanguage, LANGS } from "@/lib/i18n"

/* ── Language selector (EN / हिंदी / EN + हिंदी) ── */
function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()
  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-border/70 p-0.5"
      role="radiogroup"
      aria-label="Language"
    >
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={lang === l.value}
          onClick={() => setLang(l.value)}
          className={cn(
            "h-8 flex-1 rounded-[10px] px-2 text-[12px] font-bold transition-all",
            lang === l.value
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" className="group flex items-center gap-3 px-2" aria-label="VoltKart ERP home">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-[#0a84ff] to-[#00d4ff] text-white shadow-[0_6px_20px_rgba(10,132,255,0.4)] transition-transform duration-300 group-hover:scale-105 group-hover:rotate-[-6deg]">
        <Zap className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-col transition-all duration-300",
          collapsed && "md:pointer-events-none md:absolute md:opacity-0"
        )}
      >
        <span className="font-accent text-[19px] font-extrabold leading-tight text-foreground">
          VoltKart
        </span>
        <span className="eyebrow mt-0.5">Electronics ERP</span>
      </span>
    </Link>
  )
}

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  onToggleCollapsed: () => void
}

function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const { state, savedAt, exportBackup, resetDemoData } = useERP()
  const { t } = useLanguage()

  const navGroups = [
    {
      label: t("nav.group.counter"),
      routes: [
        { href: "/dashboard", label: t("nav.home"), icon: LayoutDashboard },
        { href: "/billing", label: t("nav.bills"), icon: Receipt },
        { href: "/daybook", label: t("nav.daybook"), icon: BookOpen },
      ],
    },
    {
      label: t("nav.group.shop"),
      routes: [
        { href: "/products", label: t("nav.items"), icon: Package },
        { href: "/stock", label: t("nav.stock"), icon: Archive },
        { href: "/sales", label: t("nav.allBills"), icon: ShoppingBag },
      ],
    },
    {
      label: t("nav.group.people"),
      routes: [
        { href: "/customers", label: t("nav.customers"), icon: Users },
        { href: "/staff", label: t("nav.staff"), icon: UserCog },
        { href: "/expenses", label: t("nav.expenses"), icon: Wallet },
        { href: "/reports", label: t("nav.reports"), icon: TrendingUp },
      ],
    },
    {
      label: t("nav.group.system"),
      routes: [{ href: "/settings", label: t("nav.settings"), icon: Settings }],
    },
  ]

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onCloseMobile}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "sidebar-dots fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-border/70 bg-[var(--sidebar-bg)] backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "max-md:-translate-x-full",
          mobileOpen && "max-md:translate-x-0",
          collapsed ? "md:w-[76px]" : "md:w-[264px]"
        )}
      >
        {/* Logo row */}
        <div className="relative flex h-[76px] items-center px-5">
          <Logo collapsed={collapsed} />
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("shell.expand") : t("shell.collapse")}
            className="absolute -right-[14px] top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-1)] transition-all duration-300 hover:scale-110 hover:text-foreground md:grid"
          >
            <ChevronLeft
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-300",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className={cn("eyebrow px-3 pb-2.5", collapsed && "md:hidden")}>
                {group.label}
              </p>
              <ul className="space-y-1.5">
                {group.routes.map((route, routeIndex) => {
                  const active =
                    pathname === route.href || pathname.startsWith(route.href + "/")
                  const Icon = route.icon
                  const offset = navGroups
                    .slice(0, groupIndex)
                    .reduce((total, g) => total + g.routes.length, 0)
                  const delay = 60 + (offset + routeIndex) * 40
                  return (
                    <li
                      key={route.href}
                      className="fade-in-up"
                      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
                    >
                      <Link
                        href={route.href}
                        title={collapsed ? route.label : undefined}
                        data-active={active}
                        className={cn(
                          "group relative flex h-10.5 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-all duration-200",
                          collapsed && "md:justify-center md:px-0",
                          active
                            ? "bg-black/[0.06] text-foreground dark:bg-white/[0.09]"
                            : "text-muted-foreground hover:translate-x-0.5 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]"
                        )}
                      >
                        {/* Active accent dot */}
                        <span
                          className={cn(
                            "absolute left-1 h-1.5 w-1.5 rounded-full bg-[var(--ring)] transition-transform duration-300",
                            active ? "scale-100" : "scale-0"
                          )}
                        />
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] flex-shrink-0 transition-all duration-300 group-hover:scale-110",
                            active && "text-[var(--ring)]",
                            collapsed && "md:ml-1"
                          )}
                          strokeWidth={active ? 2.2 : 1.8}
                        />
                        <span className={cn("truncate", collapsed && "md:hidden")}>
                          {route.label}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="relative border-t border-border/70 p-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
              collapsed && "md:justify-center md:px-0"
            )}
          >
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff9f0a] to-[#ff375f] text-[13px] font-bold text-white">
              A
            </span>
            <span className={cn("flex min-w-0 flex-col", collapsed && "md:hidden")}>
              <span className="truncate text-[13.5px] font-semibold text-foreground">
                Admin
              </span>
              <span className="eyebrow">{t("shell.owner")}</span>
            </span>
          </div>

          {/* Cloud save status */}
          <p
            className={cn(
              "eyebrow flex items-center gap-1.5 px-2 pb-1 pt-0.5",
              collapsed && "md:hidden"
            )}
            title="All changes are saved on this device automatically"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                savedAt ? "bg-[#30d158]" : "bg-[#98989d]"
              )}
            />
            {savedAt
              ? `${t("shell.saved")} · ${state.products.length} ${t("nav.items")}`
              : t("shell.autosave")}
          </p>

          {/* Language selector (EN / हिंदी / EN + हिंदी) */}
          <div className={cn("px-1 pb-1", collapsed && "md:hidden")}>
            <LanguageSwitcher />
          </div>

          <div className={cn("mt-1 flex items-center gap-1", collapsed && "md:justify-center")}>
            <button
              type="button"
              aria-label={t("shell.backup")}
              title={t("shell.backup")}
              onClick={exportBackup}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90"
            >
              <Download className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <button
              type="button"
              aria-label={t("shell.reset")}
              title={t("shell.reset")}
              onClick={() => {
                if (window.confirm("Restore original demo data? Current changes will be lost.")) {
                  resetDemoData()
                }
              }}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-90",
                collapsed && "md:hidden"
              )}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function MobileBar({ onMenu }: { onMenu: () => void }) {
  const { t } = useLanguage()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-[var(--glass)] px-4 backdrop-blur-xl md:hidden">
      <button
        type="button"
        onClick={onMenu}
        aria-label={t("shell.menu")}
        className="grid h-9 w-9 place-items-center rounded-xl text-foreground transition-all active:scale-90"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-gradient-to-br from-[#0a84ff] to-[#00d4ff] text-white">
          <Zap className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1.5} />
        </span>
        <span className="font-accent text-[17px] font-extrabold text-foreground">VoltKart</span>
      </Link>
      <div className="flex items-center gap-1.5">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useERP()
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }
  const tones = {
    success: "text-[#30d158]",
    error: "text-[#ff453a]",
    info: "text-[var(--ring)]",
  }
  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = icons[t.tone]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismissToast(t.id)}
            className="fade-in-up pointer-events-auto flex max-w-[340px] items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-4 py-3 text-[13.5px] font-medium text-card-foreground shadow-[var(--shadow-2)]"
          >
            <Icon className={cn("h-4.5 w-4.5 flex-shrink-0", tones[t.tone])} />
            <span className="text-left">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  /* Close the mobile drawer on navigation — adjusted during render so the
     menu can't stay open over the page you just moved to (works for browser
     back too), without scheduling a follow-up render from an effect. */
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMobileOpen(false)
  }

  /* Start every route at the top. Next's default navigation keeps the current
     scroll position whenever the next page is already inside the viewport, so
     without this you land mid-page (and the sidebar stays put while the right
     column jumps). The first render is skipped so a browser-restored position
     on reload is left alone. */
  const scrolledOnce = useRef(false)
  useEffect(() => {
    if (!scrolledOnce.current) {
      scrolledOnce.current = true
      return
    }
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />
      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "md:pl-[76px]" : "md:pl-[264px]"
        )}
      >
        <MobileBar onMenu={() => setMobileOpen((v) => !v)} />
        {children}
      </div>
      <Toasts />
    </>
  )
}
