import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getUserByEmail } from "~/server/db/users-client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await getUserByEmail(credentials.email as string);
        if (!user) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) return null;
        // Block sign-in until the email address is verified
        if (!user.emailVerified) return null;
        return {
          id: user.id,
          email: user.email,
          dbUrl: user.dbUrl,
          dbAuthToken: user.dbAuthToken,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.dbUrl = user.dbUrl;
        token.dbAuthToken = user.dbAuthToken;
      }
      return token;
    },
    session({ session }) {
      // Deliberately do NOT copy dbUrl / dbAuthToken onto the session — that
      // object is serialized to the browser via /api/auth/session. The Turso
      // credentials stay in the encrypted JWT and are read server-side through
      // getUserDbCredentials() (src/server/user-db.ts). See audit H1.
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt" },
});
