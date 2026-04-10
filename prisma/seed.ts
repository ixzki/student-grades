import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

function sumScores(scores: Record<string, number | null | undefined>) {
  return Object.values(scores).reduce<number>(
    (acc, v) => acc + (typeof v === "number" && Number.isFinite(v) ? v : 0),
    0,
  );
}

async function main() {
  // 1) 管理员
  const adminPasswordHash = await bcrypt.hash("adminpassword", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      name: "管理员",
      password: adminPasswordHash,
      plainPassword: null,
      role: Role.ADMIN,
      className: null,
    },
    create: {
      username: "admin",
      name: "管理员",
      password: adminPasswordHash,
      plainPassword: null,
      role: Role.ADMIN,
      className: null,
    },
  });

  // 1.5) 系统配置
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, loginTitle: "学生成绩管理系统" },
  });

  // 2) 考试
  const exam = await prisma.exam.upsert({
    where: { id: "final-2025-term1" },
    update: {
      name: "2025学年第一学期期末考试",
      date: new Date("2026-01-15T00:00:00.000Z"),
      subjects: ["语文", "数学", "英语", "科学"],
      enableClassRank: true,
    },
    create: {
      id: "final-2025-term1",
      name: "2025学年第一学期期末考试",
      date: new Date("2026-01-15T00:00:00.000Z"),
      subjects: ["语文", "数学", "英语", "科学"],
      enableClassRank: true,
    },
  });

  // 3) 学生（九年级7班、8班各 3 个）
  const studentPlainPassword = "123456";
  const studentPasswordHash = await bcrypt.hash(studentPlainPassword, 10);

  const studentsSpec: Array<{ username: string; name: string; className: string }> = [
    { username: "20250701", name: "张同学", className: "九年级7班" },
    { username: "20250702", name: "李同学", className: "九年级7班" },
    { username: "20250703", name: "王同学", className: "九年级7班" },
    { username: "20250801", name: "赵同学", className: "九年级8班" },
    { username: "20250802", name: "钱同学", className: "九年级8班" },
    { username: "20250803", name: "孙同学", className: "九年级8班" },
  ];

  const students = [] as Array<{ id: string; username: string; className: string }>;
  for (const s of studentsSpec) {
    const user = await prisma.user.upsert({
      where: { username: s.username },
      update: {
        name: s.name,
        password: studentPasswordHash,
        plainPassword: studentPlainPassword,
        role: Role.STUDENT,
        className: s.className,
      },
      create: {
        username: s.username,
        name: s.name,
        password: studentPasswordHash,
        plainPassword: studentPlainPassword,
        role: Role.STUDENT,
        className: s.className,
      },
    });
    students.push({ id: user.id, username: user.username, className: user.className ?? "" });
  }

  // 4) 成绩（每人一条，包含 4 科）
  const scoresBank: Record<string, Record<string, number>> = {
    "20250701": { 语文: 92, 数学: 88, 英语: 95, 科学: 90 },
    "20250702": { 语文: 85, 数学: 91, 英语: 78, 科学: 84 },
    "20250703": { 语文: 76, 数学: 80, 英语: 82, 科学: 79 },
    "20250801": { 语文: 89, 数学: 87, 英语: 90, 科学: 88 },
    "20250802": { 语文: 93, 数学: 94, 英语: 92, 科学: 91 },
    "20250803": { 语文: 81, 数学: 83, 英语: 85, 科学: 80 },
  };

  for (const s of students) {
    const scores = scoresBank[s.username];
    const totalScore = sumScores(scores);

    await prisma.grade.upsert({
      where: {
        studentId_examId: {
          studentId: s.id,
          examId: exam.id,
        },
      },
      update: {
        scores,
        totalScore,
      },
      create: {
        studentId: s.id,
        examId: exam.id,
        scores,
        totalScore,
      },
    });
  }

  console.log("Seed completed:", {
    admin: { username: "admin", password: "adminpassword" },
    studentPassword: studentPlainPassword,
    exam: { id: exam.id, name: exam.name },
    students: students.map((s) => ({ username: s.username, className: s.className })),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
