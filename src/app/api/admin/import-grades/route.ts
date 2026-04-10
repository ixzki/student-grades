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
    return NextResponse.json({ message: "CSV 至少需要两列：姓名/学号 + 科目列" }, { status: 400 });
  }

  const idHeader = fields[0];
  if (idHeader !== "姓名" && idHeader !== "学号") {
    return NextResponse.json({ message: "CSV 第一列必须命名为“姓名”或“学号”" }, { status: 400 });
  }

  const subjectHeaders = fields.slice(1).map((s) => s.trim()).filter(Boolean);

  // 可选：提示管理员 CSV 表头科目与 Exam.subjects 不一致
  const examSubjectSet = new Set(exam.subjects);
  const unknownSubjects = subjectHeaders.filter((h) => !examSubjectSet.has(h));

  const rows = parsed.data || [];
  const errors: Array<{ row: number; username?: string; message: string }> = []; // username 字段保留用于兼容旧前端

  let upserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowObj = row as Record<string, unknown>;
    const loginName = String(rowObj[idHeader] || "").trim();
    if (!loginName) {
      skipped++;
      errors.push({ row: i + 2, message: `${idHeader}为空` });
      continue;
    }

    const student =
      idHeader === "学号"
        ? await prisma.user.findUnique({ where: { username: loginName }, select: { id: true, role: true } })
        : await prisma.user.findFirst({ where: { name: loginName, role: "STUDENT" }, select: { id: true, role: true } });

    if (!student || student.role !== "STUDENT") {
      skipped++;
      errors.push({ row: i + 2, username: loginName, message: "找不到对应学生" });
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
