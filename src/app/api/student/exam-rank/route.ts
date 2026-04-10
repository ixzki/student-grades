import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function computeRank(all: Array<{ studentId: string; totalScore: number }>, meId: string) {
  const sorted = [...all].sort((a, b) => b.totalScore - a.totalScore);
  let lastScore: number | null = null;
  let lastRank = 0;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const rank = i + 1;
    if (lastScore === null || row.totalScore !== lastScore) {
      lastScore = row.totalScore;
      lastRank = rank;
    }

    if (row.studentId === meId) {
      return { rank: lastRank, total: sorted.length };
    }
  }

  return { rank: 0, total: sorted.length };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const examId = (url.searchParams.get("examId") || "").trim();
  if (!examId) {
    return NextResponse.json({ message: "缺少 examId" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { enableClassRank: true } });
  if (!exam) {
    return NextResponse.json({ message: "考试不存在" }, { status: 404 });
  }
  if (!exam.enableClassRank) {
    return NextResponse.json({ message: "本次考试未开放班级排名" }, { status: 403 });
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, className: true },
  });

  if (!me?.className) {
    return NextResponse.json({ message: "当前账号未设置班级" }, { status: 400 });
  }

  const myGrade = await prisma.grade.findUnique({
    where: {
      studentId_examId: {
        studentId: me.id,
        examId,
      },
    },
    select: { totalScore: true },
  });

  const classmates = await prisma.grade.findMany({
    where: {
      examId,
      student: { className: me.className },
    },
    select: { studentId: true, totalScore: true },
  });

  const rank = computeRank(classmates, me.id);

  return NextResponse.json({
    examId,
    className: me.className,
    myTotalScore: myGrade?.totalScore ?? 0,
    rank,
  });
}
