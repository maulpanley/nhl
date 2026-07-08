"use client";

import { signOut, useSession } from "next-auth/react";

/** Account widget in the header. Client-side so the layout stays static/ISR;
    it fetches the session from /api/auth/session after hydration. */
export function HeaderAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="ml-auto" />;
  }

  if (session?.user) {
    return (
      <span className="ml-auto flex items-baseline gap-3 text-sm">
        <span style={{ color: "var(--ink-muted)" }}>{session.user.email}</span>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="plain-link">
          Sign out
        </button>
      </span>
    );
  }

  // Public sign-in is hidden until email-to-anyone is ready (needs a verified
  // sending domain). The /signin route still works if visited directly.
  return null;
}
