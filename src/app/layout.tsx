import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import { ToastViewport } from "@/components/ui/toast";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";
import { Providers } from "./providers";

const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Task board", template: "%s · Task board" },
  description: "Plan and track your team's work on shared Kanban boards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17171c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before paint by THEME_SCRIPT, so the server and client markup differ.
    <html lang="en" className={notoSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers>
          {children}
          <ToastViewport />
        </Providers>
      </body>
    </html>
  );
}
