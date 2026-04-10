import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcrypt";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { oldPassword?: string; newPassword?: string };
  const oldPassword = body.oldPassword || "";
  const newPassword = (body.newPassword || "").trim();

  if (!oldPassword || newPassword.length < 6) {
    return NextResponse.json({ message: "参数不合法：新密码至少 6 位" }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, password: true },
  });

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const ok = await bcrypt.compare(oldPassword, admin.password);
  if (!ok) {
    return NextResponse.json({ message: "旧密码错误" }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hash },
  });

  return NextResponse.json({ ok: true });
}
