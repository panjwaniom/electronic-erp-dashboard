import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/ui/shell";
import { Cursor } from "@/components/ui/cursor";
import { ERPProvider } from "@/lib/store";
import { LanguageProvider } from "@/lib/i18n";
import { BUSINESS } from "@/lib/erp/utils";

export const metadata: Metadata = {
  title: {
    default: `${BUSINESS.name} — Electronics ERP`,
    template: `%s · ${BUSINESS.name}`,
  },
  description: `${BUSINESS.tagline}. GST billing with barcode counter, WhatsApp bill sharing, stock alerts, customer udhaar, staff attendance, day book and P&L reports.`,
};

/* Single premium UI family — Plus Jakarta Sans (modern SaaS standard) */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

/* Mono for data: table headers, numerals, micro-labels */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/* Applies the saved theme before first paint — no flash of wrong theme */
const themeInit = `(function(){try{var m=localStorage.getItem('theme');var d=m?m==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ERPProvider>
          <LanguageProvider>
            <Shell>{children}</Shell>
            <Cursor />
          </LanguageProvider>
        </ERPProvider>
      </body>
    </html>
  );
}
