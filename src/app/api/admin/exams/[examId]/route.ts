import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ examId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await ctx.params;
  const id = (examId || "").trim();
  if (!id) return NextResponse.json({ message: "缺少 examId" }, { status: 400 });

  const exam = await prisma.exam.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      date: true,
      subjects: true,
      enableClassRank: true,
      hidden: true,
      createdAt: true,
      grades: {
        orderBy: [{ totalScore: "desc" }],
        select: {
          id: true,
          scores: true,
          totalScore: true,
          student: { select: { id: true, name: true, className: true } },
        },
      },
    },
  });

  if (!exam) return NextResponse.json({ message: "考试不存在" }, { status: 404 });
  return NextResponse.json({ exam });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ examId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await ctx.params;
  const id = (examId || "").trim();
  if (!id) return NextResponse.json({ message: "缺少 examId" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | { enableClassRank?: boolean; hidden?: boolean }
    | null;

  const data: { enableClassRank?: boolean; hidden?: boolean } = {};
  if (typeof body?.enableClassRank === "boolean") data.enableClassRank = body.enableClassRank;
  if (typeof body?.hidden === "boolean") data.hidden = body.hidden;

  if (!Object.keys(data).length) {
    return NextResponse.json({ message: "缺少可更新字段" }, { status: 400 });
  }

  // 隐藏考试时：删除该考试全部成绩
  if (data.hidden === true) {
    await prisma.grade.deleteMany({ where: { examId: id } });
  }

  const exam = await prisma.exam.update({
    where: { id },
    data,
    select: { id: true, enableClassRank: true, hidden: true },
  });

  return NextResponse.json({ exam });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ examId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await ctx.params;
  const id = (examId || "").trim();
  if (!id) return NextResponse.json({ message: "缺少 examId" }, { status: 400 });

  // 删除考试前，先显式删除成绩（同时也满足“删除考试对应成绩”的需求；即使 cascade 也不会出错）
  await prisma.grade.deleteMany({ where: { examId: id } });
  await prisma.exam.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
