import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import bcrypt from "bcrypt";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function random6Digits() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function randomUsername() {
  return `stu_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
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

  const fields = (parsed.meta.fields || []).map((f) => (f ?? "").trim());
  if (fields.length < 3) {
    return NextResponse.json({ message: "CSV 至少需要三列：姓名/学号 + 班级 + 科目列" }, { status: 400 });
  }

  const idHeader = fields[0];
  const classHeader = fields[1];

  if (idHeader !== "姓名" && idHeader !== "学号") {
    return NextResponse.json({ message: "CSV 第一列必须命名为“姓名”或“学号”" }, { status: 400 });
  }
  if (classHeader !== "班级") {
    return NextResponse.json({ message: "CSV 第二列必须命名为“班级”" }, { status: 400 });
  }

  const subjectHeaders = fields.slice(2).map((s) => s.trim()).filter(Boolean);

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

    const loginName = String(rowObj[idHeader] || "").trim();
    const className = String(rowObj[classHeader] || "").trim();

    if (!loginName) {
      skipped++;
      errors.push({ row: i + 2, message: `${idHeader}为空` });
      continue;
    }

    if (!className) {
      skipped++;
      errors.push({ row: i + 2, username: loginName, message: "班级为空" });
      continue;
    }

    let studentId: string | null = null;

    if (idHeader === "姓名") {
      const existing = await prisma.user.findFirst({
        where: { role: "STUDENT", name: loginName },
        select: { id: true, className: true },
      });

      if (existing) {
        studentId = existing.id;
        if ((existing.className || "") !== className) {
          await prisma.user.update({ where: { id: existing.id }, data: { className } });
        }
      } else {
        const pwd = random6Digits();
        const hash = await bcrypt.hash(pwd, 10);

        // 生成一个内部 username（不用于学生登录）
        let username = randomUsername();
        for (let j = 0; j < 5; j++) {
          const exists = await prisma.user.findUnique({ where: { username }, select: { id: true } });
          if (!exists) break;
          username = randomUsername();
        }

        const created = await prisma.user.create({
          data: {
            username,
            name: loginName,
            className,
            password: hash,
            plainPassword: pwd,
            role: "STUDENT",
          },
          select: { id: true },
        });
        studentId = created.id;
      }
    } else {
      // 兼容旧格式：学号+班级
      const existing = await prisma.user.findUnique({
        where: { username: loginName },
        select: { id: true, role: true, className: true, name: true },
      });

      if (existing && existing.role === "STUDENT") {
        studentId = existing.id;
        if ((existing.className || "") !== className) {
          await prisma.user.update({ where: { id: existing.id }, data: { className } });
        }
      } else if (!existing) {
        const pwd = random6Digits();
        const hash = await bcrypt.hash(pwd, 10);
        const created = await prisma.user.create({
          data: {
            username: loginName,
            name: loginName,
            className,
            password: hash,
            plainPassword: pwd,
            role: "STUDENT",
          },
          select: { id: true },
        });
        studentId = created.id;
      }
    }

    if (!studentId) {
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
          studentId,
          examId,
        },
      },
      update: {
        scores,
        totalScore,
      },
      create: {
        studentId,
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
