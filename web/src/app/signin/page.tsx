import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in — NHL Trends" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const [session, { sent }] = await Promise.all([auth(), searchParams]);

  if (session?.user) {
    return (
      <section className="card">
        <h1 className="text-xl font-semibold mb-1">You&apos;re signed in</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Signed in as {session.user.email}.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h1 className="text-xl font-semibold mb-1">Sign in</h1>
      <p className="text-sm mb-4" style={{ color: "var(--ink-2)" }}>
        Enter your email and we&apos;ll send a one-click sign-in link. No password.
        A free account lets you save favorite teams and players (and, soon, milestone
        alerts).
      </p>
      {sent ? (
        <p className="text-sm" style={{ color: "var(--delta-good)" }}>
          Check your inbox for the sign-in link.
        </p>
      ) : (
        <form
          action={async (formData) => {
            "use server";
            await signIn("resend", {
              email: String(formData.get("email")),
              redirectTo: "/signin?sent=1",
            });
          }}
          className="flex gap-2"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--axis)", background: "var(--surface-1)" }}
          />
          <button type="submit" className="btn-primary">
            Send link
          </button>
        </form>
      )}
    </section>
  );
}
