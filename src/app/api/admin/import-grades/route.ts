import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const examId = String(form.get("examId") || "").trim();
  const file = form.get("file");

  if (!examId || !(file instanceof File)) {
    return NextResponse.json({ message: "缺少 examId 或 file" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    return NextResponse.json({ message: "考试不存在" }, { status: 404 });
  }

  const csvText = await file.text();
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    return NextResponse.json({ message: "CSV 解析失败", errors: parsed.errors }, { status: 400 });
  }

  const fields = parsed.meta.fields || [];
  if (fields.length < 2) {
    return NextResponse.json({ message: "CSV 至少需要两列：学号 + 科目列" }, { status: 400 });
  }

  if (fields[0] !== "学号") {
    return NextResponse.json({ message: "CSV 第一列必须命名为“学号”" }, { status: 400 });
  }

  const subjectHeaders = fields.slice(1).map((s) => s.trim()).filter(Boolean);

  // 可选：提示管理员 CSV 表头科目与 Exam.subjects 不一致
  const examSubjectSet = new Set(exam.subjects);
  const unknownSubjects = subjectHeaders.filter((h) => !examSubjectSet.has(h));

  const rows = parsed.data || [];
  const errors: Array<{ row: number; username?: string; message: string }> = [];

  let upserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowObj = row as Record<string, unknown>;
    const username = String(rowObj["学号"] || "").trim();
    if (!username) {
      skipped++;
      errors.push({ row: i + 2, message: "学号为空" });
      continue;
    }

    const student = await prisma.user.findUnique({
      where: { username },
      select: { id: true, role: true },
    });

    if (!student || student.role !== "STUDENT") {
      skipped++;
      errors.push({ row: i + 2, username, message: "找不到对应学生账号" });
      continue;
    }

    const scores: Record<string, number | null> = {};
    for (const subject of subjectHeaders) {
      scores[subject] = toNumberOrNull(rowObj[subject]);
    }

    // totalScore：缺考/空值按 0
    const totalScore = Object.values(scores).reduce<number>(
      (acc, v) => acc + (typeof v === "number" ? v : 0),
      0,
    );

    await prisma.grade.upsert({
      where: {
        studentId_examId: {
          studentId: student.id,
          examId,
        },
      },
      update: {
        scores,
        totalScore,
      },
      create: {
        studentId: student.id,
        examId,
        scores,
        totalScore,
      },
    });

    upserted++;
  }

  return NextResponse.json({
    examId,
    importedSubjects: subjectHeaders,
    unknownSubjects,
    upserted,
    skipped,
    errors,
  });
}
