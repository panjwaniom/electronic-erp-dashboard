"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The theme lives on `<html class="dark">` — written before first paint by the
 * inline script in the root layout, and mutated directly when toggling. The
 * toggle therefore *subscribes* to that class instead of copying it into state,
 * so the icon can never disagree with what is actually on screen (and it stays
 * correct if another tab changes the theme).
 */
function subscribe(onStoreChange: () => void): () => void {
  if (typeof document === "undefined") return () => {}
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

const readIsDark = () => document.documentElement.classList.contains("dark")
const readIsDarkOnServer = () => false

export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, readIsDark, readIsDarkOnServer)

  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark")
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
    try {
      localStorage.setItem("theme", dark ? "dark" : "light")
    } catch {
      /* private mode — theme still applies for this session */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "group relative grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90",
        className
      )}
    >
      <span className="relative block h-4 w-4">
        <Sun
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300",
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          )}
        />
      </span>
    </button>
  )
}
