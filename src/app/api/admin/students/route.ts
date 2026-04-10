import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcrypt";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function randomUsername() {
  return `stu_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function random6Digits() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: [{ className: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      className: true,
      plainPassword: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ students });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name?: string;
    className?: string;
    password?: string;
  };

  const name = body.name?.trim();
  const className = body.className?.trim();
  const passwordPlain = body.password?.trim();

  if (!name || !className || !passwordPlain) {
    return NextResponse.json({ message: "参数不合法：需要 name、className、password" }, { status: 400 });
  }
  if (passwordPlain.length < 6) {
    return NextResponse.json({ message: "密码至少 6 位" }, { status: 400 });
  }

  const existedSameName = await prisma.user.findFirst({
    where: { role: "STUDENT", name },
    select: { id: true },
  });
  if (existedSameName) {
    return NextResponse.json({ message: "学生姓名已存在（请保证姓名唯一）" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  // 生成一个内部 username（不再用于学生登录）
  let username = randomUsername();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!exists) break;
    username = randomUsername();
  }

  const student = await prisma.user.create({
    data: {
      username,
      name,
      className,
      password: passwordHash,
      plainPassword: passwordPlain,
      role: "STUDENT",
    },
    select: { id: true, name: true, className: true, plainPassword: true, createdAt: true },
  });

  return NextResponse.json({ student }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: string; className?: string; resetPassword?: boolean }
    | null;

  const id = body?.id?.trim();
  const className = body?.className?.trim();
  const resetPassword = Boolean(body?.resetPassword);

  if (!id) return NextResponse.json({ message: "缺少 id" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!target || target.role !== "STUDENT") {
    return NextResponse.json({ message: "学生不存在" }, { status: 404 });
  }

  const data: { className?: string; password?: string; plainPassword?: string } = {};
  if (className) data.className = className;

  let newPlain: string | null = null;
  if (resetPassword) {
    newPlain = random6Digits();
    data.plainPassword = newPlain;
    data.password = await bcrypt.hash(newPlain, 10);
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ message: "没有可更新字段" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, className: true, plainPassword: true, createdAt: true },
  });

  return NextResponse.json({ student: updated, newPassword: newPlain });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id?.trim();
  if (!id) {
    return NextResponse.json({ message: "缺少 id" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role !== "STUDENT") {
    return NextResponse.json({ message: "学生不存在" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
