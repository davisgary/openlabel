import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { Session } from "../lib/session";
import { Theme } from "../lib/theme";
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Open Label",
  description: "Unlock the power of Open Label.",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Open Label",
    images: ["/meta.png"],
    siteName: "Open Label",
  },
};

const primaryFont = Instrument_Sans({ subsets: ['latin'], display: 'swap' })

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <Session>
          <Theme>
            {children}
          </Theme>
        </Session>
      </body>
    </html>
  );
}