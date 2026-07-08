import PostgresAdapter from "@auth/pg-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { Pool } from "pg";

// node-postgres pool against Neon. Low-traffic; reuses DATABASE_URL.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  session: { strategy: "database" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    }),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    // Database sessions: `user` is the adapter row, so tier comes straight
    // from our users table.
    session({ session, user }) {
      const u = session.user as { id?: string; tier?: string };
      u.id = String(user.id);
      u.tier = (user as { tier?: string }).tier ?? "free";
      return session;
    },
  },
});
