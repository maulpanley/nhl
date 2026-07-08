import Link from "next/link";

/** Tease for a paywalled panel: blurred placeholder tiles (no real numbers ever
    reach the client) with an unlock call-to-action over the top. */
export function LockedOutlook({
  title = "Matchup outlook",
  labels,
  blurb,
}: {
  title?: string;
  labels: string[];
  blurb: string;
}) {
  return (
    <section className="card locked-wrap">
      <h2 className="font-medium mb-1">{title}</h2>
      <p className="text-xs mb-3" style={{ color: "var(--ink-muted)" }}>
        {blurb}
      </p>
      <div className="locked-blur tile-row" aria-hidden="true">
        {labels.map((l, i) => (
          <div className="stat-tile" key={i}>
            <div className="label">{l}</div>
            <div className="value">•.••</div>
          </div>
        ))}
      </div>
      <div className="locked-overlay">
        <div className="locked-cta">
          <div className="lock-title">🔒 Predictions are a Pro feature</div>
          <Link href="/pricing" className="btn-primary">
            Unlock predictions
          </Link>
        </div>
      </div>
    </section>
  );
}
