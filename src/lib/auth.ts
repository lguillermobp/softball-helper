import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { logAudit } from "./audit";

// NOTE: We intentionally do NOT include the PrismaAdapter here.
// NextAuth v5 throws ?error=Configuration when an adapter is present
// alongside the Credentials provider + JWT strategy, because the adapter
// tries to persist sessions to the DB which conflicts with JWT sessions.
// Users are created directly via prisma.user.create() in the register flow.

export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: {
    error(error: Error) {
      if (error.name === "CredentialsSignin") return;
      console.error(error);
    },
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await prisma.user.findFirst({
            where: { email: { equals: credentials.email as string, mode: "insensitive" } },
          });

          if (!user || !user.password) return null;
          if (!user.isActive) return null;

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isMasterAdmin: user.isMasterAdmin,
            isSupportTechnician: user.isSupportTechnician,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isMasterAdmin = (user as any).isMasterAdmin;
        token.isSupportTechnician = (user as any).isSupportTechnician;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).isMasterAdmin = token.isMasterAdmin;
        (session.user as any).isSupportTechnician = token.isSupportTechnician;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        await logAudit({
          actor: { id: user.id!, name: user.name, email: user.email },
          action: "user.signin",
          metadata: { email: user.email },
        });
      } catch (e) {
        console.error("[audit] signIn log failed:", e);
      }
    },
    async signOut(message) {
      try {
        const token = (message as any).token;
        if (token?.id) {
          await logAudit({
            actor: { id: token.id as string, name: token.name as string ?? null, email: token.email as string ?? null },
            action: "user.signout",
            metadata: { email: token.email },
          });
        }
      } catch (e) {
        console.error("[audit] signOut log failed:", e);
      }
    },
  },
});
