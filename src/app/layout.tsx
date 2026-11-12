import type { Metadata } from "next";
import { Kantumruy_Pro, Noto_Serif_Khmer } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const ui = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-kantumruy",
  display: "swap",
});

const khmerSerif = Noto_Serif_Khmer({
  subsets: ["khmer", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-serif-khmer",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KhmerWord · វចនានុក្រមខ្មែរ ជួន ណាត",
    template: "%s · KhmerWord",
  },
  description:
    "Check and look up Khmer words in the Chuon Nath Dictionary (Buddhist Institute, 1967). Data from SPICE / Open Institute.",
  keywords: ["Khmer", "dictionary", "Chuon Nath", "វចនានុក្រម", "ជួន ណាត", "spell check", "ខ្មែរ"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="km" className={`${ui.variable} ${khmerSerif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so dark mode doesn't flash white. Defaults to light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1 w-full">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
