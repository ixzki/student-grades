import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const exams = await prisma.exam.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      date: true,
      subjects: true,
      enableClassRank: true,
      hidden: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ exams });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { name?: string; date?: string; subjects?: string[] };
  const name = body.name?.trim();
  const date = body.date ? new Date(body.date) : null;
  const subjects = (body.subjects || [])
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  const uniqSubjects = Array.from(new Set(subjects));

  if (!name || !date || Number.isNaN(date.getTime()) || uniqSubjects.length === 0) {
    return NextResponse.json(
      { message: "参数不合法：需要 name、date、subjects(至少1个)" },
      { status: 400 },
    );
  }

  const exam = await prisma.exam.create({
    data: {
      name,
      date,
      subjects: uniqSubjects,
    },
  });

  return NextResponse.json({ exam }, { status: 201 });
}
