"use client"

import { useEffect, useRef } from "react"

const INTERACTIVE = 'a, button, input, textarea, select, [role="button"], [data-cursor="hover"]'

/**
 * Dot + lagging ring cursor with blend-difference inversion.
 * Only mounts on fine pointers; falls back to the native cursor
 * for touch devices and reduced-motion users.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!fine || reduced) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    document.documentElement.classList.add("cursor-none")

    let mx = -100
    let my = -100
    let rx = -100
    let ry = -100
    let raf = 0
    let visible = false

    const show = () => {
      if (visible) return
      visible = true
      dot.classList.remove("is-hidden")
      ring.classList.remove("is-hidden")
    }

    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      show()
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`
      const target = e.target as HTMLElement | null
      const interactive = !!target?.closest(INTERACTIVE)
      ring.classList.toggle("is-hover", interactive)
    }

    const onDown = () => ring.classList.add("is-down")
    const onUp = () => ring.classList.remove("is-down")

    const onLeave = () => {
      visible = false
      dot.classList.add("is-hidden")
      ring.classList.add("is-hidden")
    }

    const tick = () => {
      rx += (mx - rx) * 0.16
      ry += (my - ry) * 0.16
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("mousedown", onDown)
    window.addEventListener("mouseup", onUp)
    document.documentElement.addEventListener("mouseleave", onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      document.documentElement.classList.remove("cursor-none")
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("mouseup", onUp)
      document.documentElement.removeEventListener("mouseleave", onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot is-hidden" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring is-hidden" aria-hidden="true" />
    </>
  )
}
