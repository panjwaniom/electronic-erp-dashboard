export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Deterministic date formatting (UTC-based) so server and client
 * always render identical text — avoids React hydration mismatches.
 */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return 'N/A'
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/* Indian-grouping numbers, deterministic across server/client locales */
const numberFormatter = new Intl.NumberFormat('en-IN')

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}