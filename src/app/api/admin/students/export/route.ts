import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvEscape(v: string) {
  const s = v ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: [{ className: "asc" }, { name: "asc" }],
    select: { name: true, className: true, plainPassword: true },
  });

  const header = ["姓名", "班级", "密码"].join(",");
  const lines = students.map((s) =>
    [csvEscape(s.name), csvEscape(s.className || ""), csvEscape(s.plainPassword || "")].join(","),
  );

  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=students.csv",
    },
  });
}
