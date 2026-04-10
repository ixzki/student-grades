import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const cfg = await prisma.appConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, loginTitle: "学生成绩管理系统" },
      select: { loginTitle: true },
    });
    return NextResponse.json({ config: cfg });
  } catch (e) {
    console.error(e);
    // 兼容：数据库尚未 db push 新表时，避免直接 500 导致后台打不开
    return NextResponse.json({ config: { loginTitle: "学生成绩管理系统" } });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { loginTitle?: string } | null;
  const loginTitle = (body?.loginTitle || "").trim();
  if (!loginTitle) {
    return NextResponse.json({ message: "缺少 loginTitle" }, { status: 400 });
  }

  try {
    const cfg = await prisma.appConfig.upsert({
      where: { id: 1 },
      update: { loginTitle },
      create: { id: 1, loginTitle },
      select: { loginTitle: true },
    });
    return NextResponse.json({ config: cfg });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "保存失败：请先对生产库执行 pnpm db:push 同步 AppConfig 表" }, { status: 500 });
  }
}
