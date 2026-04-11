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

// 检测是否为 UTF-8 BOM
function hasUtf8Bom(buffer: Uint8Array): boolean {
  return buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
}

// 检测是否为 UTF-16 LE BOM
function hasUtf16LeBom(buffer: Uint8Array): boolean {
  return buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE;
}

// 检测是否为 UTF-16 BE BOM
function hasUtf16BeBom(buffer: Uint8Array): boolean {
  return buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF;
}

// 检测字符串中是否包含有效的中文字符（CJK 统一表意文字）
function hasValidChineseChars(str: string): boolean {
  const chineseRegex = /[\u4e00-\u9fff]/g;
  const matches = str.match(chineseRegex);
  return matches !== null && matches.length >= 2;
}

// 检查解码结果是否合理（包含预期的中文列名）
function isValidDecode(str: string): boolean {
  const expected = ["姓名", "班级", "语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"];
  for (const word of expected) {
    if (str.includes(word)) return true;
  }
  // 或者检查是否有足够多的中文字符
  return hasValidChineseChars(str);
}

// 自动检测编码并解码
function decodeContent(buffer: Uint8Array): string {
  // 1. 检查 UTF-8 BOM
  if (hasUtf8Bom(buffer)) {
    return new TextDecoder("utf-8").decode(buffer.slice(3));
  }
  // 2. 检查 UTF-16 LE BOM
  if (hasUtf16LeBom(buffer)) {
    return new TextDecoder("utf-16le").decode(buffer.slice(2));
  }
  // 3. 检查 UTF-16 BE BOM
  if (hasUtf16BeBom(buffer)) {
    return new TextDecoder("utf-16be").decode(buffer.slice(2));
  }

  // 4. 尝试 UTF-8 解码
  const utf8Result = new TextDecoder("utf-8").decode(buffer);
  if (isValidDecode(utf8Result)) {
    return utf8Result;
  }

  // 5. 尝试 GBK/GB18030 解码（Vercel/Node.js 环境支持）
  try {
    const gbkResult = new TextDecoder("gb18030").decode(buffer);
    if (isValidDecode(gbkResult)) {
      return gbkResult;
    }
  } catch {
    // 环境不支持 gb18030
  }

  // 6. 回退到 UTF-8
  return utf8Result;
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

  // 读取为 ArrayBuffer 以处理不同编码（UTF-8/GBK/ANSI）
  const arrayBuffer = await file.arrayBuffer();
  const csvText = decodeContent(arrayBuffer);
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    return NextResponse.json({ message: "CSV 解析失败", errors: parsed.errors }, { status: 400 });
  }

  const fields = (parsed.meta.fields || []).map((f) => (f ?? "").trim());
  if (fields.length < 3) {
    return NextResponse.json({ message: "CSV 至少需要三列：姓名 + 班级 + 科目列" }, { status: 400 });
  }

  const idHeader = fields[0];
  const classHeader = fields[1];

  if (idHeader !== "姓名") {
    return NextResponse.json({ message: "CSV 第一列必须命名为“姓名”" }, { status: 400 });
  }
  if (classHeader !== "班级") {
    return NextResponse.json({ message: "CSV 第二列必须命名为“班级”" }, { status: 400 });
  }

  const subjectHeaders = fields.slice(2).map((s) => s.trim()).filter(Boolean);

  // CSV 科目会动态合并到 Exam.subjects，确保管理员端“考试列表/详情”能按导入表头显示
  const examSubjectSet = new Set(exam.subjects);
  const newSubjects = subjectHeaders.filter((h) => !examSubjectSet.has(h));
  const mergedSubjects = Array.from(new Set([...exam.subjects, ...subjectHeaders]));

  if (newSubjects.length) {
    await prisma.exam.update({
      where: { id: examId },
      data: { subjects: mergedSubjects },
      select: { id: true },
    });
  }

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
    newSubjects,
    upserted,
    skipped,
    errors,
  });
}
