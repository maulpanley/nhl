"use client";

import Link from "next/link";
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

  return (
    <Link href="/signin" className="ml-auto text-sm plain-link">
      Sign in
    </Link>
  );
}
