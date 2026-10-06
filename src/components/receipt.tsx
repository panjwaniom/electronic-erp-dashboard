import type { BusinessInfo, Sale } from "@/types"
import { formatINR, prettyDate } from "@/lib/erp/utils"

/**
 * GST tax invoice body — printable (.print-area), shared by Billing and Sales.
 */
export function ReceiptBody({ sale, business }: { sale: Sale; business: BusinessInfo }) {
  return (
    <div className="print-area rounded-[20px] border border-border/70 bg-card p-6 text-[13px]">
      <div className="flex items-start justify-between border-b border-dashed border-border pb-4">
        <div>
          <p className="font-accent text-[17px] font-extrabold">{business.name}</p>
          <p className="mt-1 max-w-[260px] text-[12px] text-muted-foreground">
            {business.address} · GSTIN {business.gstin}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-bold tabular-nums">{sale.invoiceNumber}</p>
          <p className="text-[12px] text-muted-foreground">{prettyDate(sale.date)}</p>
        </div>
      </div>
      <p className="py-3 text-[13px]">
        <span className="eyebrow mr-2">Customer</span>
        {sale.customerName ?? "Walk-in customer"}
      </p>
      <table className="w-full">
        <thead>
          <tr>
            <th className="eyebrow py-2 text-left">Item</th>
            <th className="eyebrow py-2 text-right">Qty</th>
            <th className="eyebrow py-2 text-right">GST</th>
            <th className="eyebrow py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it) => (
            <tr key={it.productId} className="border-t border-border/60">
              <td className="py-2.5 pr-3 font-medium">{it.productName}</td>
              <td className="py-2.5 text-right tabular-nums">{it.quantity}</td>
              <td className="py-2.5 text-right tabular-nums">{formatINR(it.tax)}</td>
              <td className="py-2.5 text-right font-semibold tabular-nums">
                {formatINR(it.total + it.tax)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 border-t border-dashed border-border pt-3 text-[12.5px]">
        <div className="flex justify-between text-muted-foreground">
          <span>Taxable</span>
          <span className="tabular-nums">{formatINR(sale.gst.taxable)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>CGST + SGST</span>
          <span className="tabular-nums">{formatINR(sale.tax)}</span>
        </div>
        <div className="flex justify-between text-[15px] font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatINR(sale.total)}</span>
        </div>
        {sale.status === "REFUNDED" && (
          <p className="pt-1 text-center text-[12px] font-bold uppercase tracking-wide text-[#ff453a]">
            Refunded
          </p>
        )}
      </div>
    </div>
  )
}
