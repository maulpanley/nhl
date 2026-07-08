import Link from "next/link";

export const metadata = {
  title: "Pricing — NHL Trends",
  description: "Free NHL stats and trends, or go Pro for predictions and Best Bets.",
};

const FREE = [
  "All player & team stats since 2015-16",
  "Filters: season, game type, home/away, date range",
  "Recent-form and career trend charts",
  "Head-to-head history (player & team)",
  "Full schedule",
];

const PRO = [
  "Everything in Free",
  "Matchup outlook & expected points on every page",
  "Team expected scores",
  "Best Bets — the day's biggest edges, ranked",
  "Favorite teams/players & milestone alerts",
];

export default function PricingPage() {
  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold mb-1">Pricing</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          The stats are free, forever. Go Pro for the predictions.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card">
          <h2 className="font-medium">Free</h2>
          <p className="text-2xl font-semibold my-1">$0</p>
          <ul className="text-sm mt-2 flex flex-col gap-1.5" style={{ color: "var(--ink-2)" }}>
            {FREE.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <Link href="/" className="btn-secondary mt-4 inline-block">
            Browse stats
          </Link>
        </section>

        <section className="card" style={{ borderColor: "var(--series-1)" }}>
          <h2 className="font-medium">Pro</h2>
          <p className="text-2xl font-semibold my-1">
            Coming soon
          </p>
          <ul className="text-sm mt-2 flex flex-col gap-1.5" style={{ color: "var(--ink-2)" }}>
            {PRO.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <button className="btn-primary mt-4" disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
            Checkout coming soon
          </button>
        </section>
      </div>
    </>
  );
}
