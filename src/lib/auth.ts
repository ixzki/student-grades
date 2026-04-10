import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "姓名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const loginName = credentials?.username?.trim();
        const password = credentials?.password;
        if (!loginName || !password) return null;

        // 规则：
        // - 管理员：使用 username 登录（默认 admin）
        // - 学生：使用 name（姓名）登录
        const user =
          (await prisma.user.findUnique({
            where: { username: loginName },
            select: { id: true, username: true, name: true, password: true, role: true, className: true },
          })) ||
          (await prisma.user.findFirst({
            where: { name: loginName, role: "STUDENT" },
            select: { id: true, username: true, name: true, password: true, role: true, className: true },
          }));

        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          className: user.className,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // 初次登录时 user 有值
      if (user) {
        const u = user as unknown as {
          id: string;
          role: "STUDENT" | "ADMIN";
          className?: string | null;
          name: string;
        };
        token.id = u.id;
        token.role = u.role;
        token.className = u.className ?? null;
        token.name = u.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || "");
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "STUDENT";
        session.user.className = token.className ?? null;
        session.user.name = String(token.name || session.user.name || "");
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
