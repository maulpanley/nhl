/** Official NHL team logo from assets.nhle.com, theme-aware (light/dark SVGs). */
export function TeamLogo({ abbrev, size = 22 }: { abbrev: string; size?: number }) {
  const base = `https://assets.nhle.com/logos/nhl/svg/${abbrev}`;
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={`${base}_dark.svg`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- external SVG, no optimization needed */}
      <img
        src={`${base}_light.svg`}
        alt=""
        width={size}
        height={size}
        style={{ display: "inline-block", verticalAlign: "middle" }}
        loading="lazy"
      />
    </picture>
  );
}
