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

  const body = (await req.json().catch(() => null)) as { enableClassRank?: boolean } | null;
  if (typeof body?.enableClassRank !== "boolean") {
    return NextResponse.json({ message: "缺少 enableClassRank" }, { status: 400 });
  }

  const exam = await prisma.exam.update({
    where: { id },
    data: { enableClassRank: body.enableClassRank },
    select: { id: true, enableClassRank: true },
  });

  return NextResponse.json({ exam });
}
