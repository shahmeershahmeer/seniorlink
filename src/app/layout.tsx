import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import PwaSetup from "@/components/PwaSetup";
import "./globals.css";

// Atkinson Hyperlegible Next was designed by the Braille Institute for low-vision readers.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
});

export const metadata: Metadata = {
  title: "SeniorLink",
  description: "We turn a neighbourhood into a support network.",
  applicationName: "SeniorLink",
  appleWebApp: { capable: true, title: "SeniorLink", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-48-v2.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192-v2.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon-v2.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b4530",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, password managers, dark-mode tools)
    // add attributes to <html>/<body> before React loads. This only ignores those two tags' attributes.
    <html lang="en" className={atkinson.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <PwaSetup />
        <div className="mx-auto min-h-dvh max-w-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
