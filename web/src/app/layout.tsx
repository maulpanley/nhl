import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nhl-trends.vercel.app"),
  title: "NHL Trends",
  description: "Player vs. team splits, goalie matchups, and recent-form trends",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="max-w-4xl mx-auto px-4 pt-6 pb-2 flex items-baseline gap-4">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            NHL Trends
          </Link>
          <Link href="/schedule" className="text-sm plain-link">
            Schedule
          </Link>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4">{children}</main>
        <footer className="max-w-4xl mx-auto px-4 py-8 text-xs" style={{ color: "var(--ink-muted)" }}>
          Data from the NHL API, refreshed nightly.
        </footer>
      </body>
    </html>
  );
}
