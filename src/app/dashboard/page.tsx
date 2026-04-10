import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/SignOutButton";

function formatScore(v: unknown) {
  const n = typeof v === "number" ? v : v === null || v === undefined ? null : Number(v);
  if (n === null || Number.isNaN(n)) return "-";
  return String(n);
}

function computeRank(all: Array<{ studentId: string; totalScore: number }>, meId: string) {
  const sorted = [...all].sort((a, b) => b.totalScore - a.totalScore);
  let rank = 0;
  let lastScore: number | null = null;
  let lastRank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    rank = i + 1;
    if (lastScore === null || s.totalScore !== lastScore) {
      lastRank = rank;
      lastScore = s.totalScore;
    }
    if (s.studentId === meId) return { rank: lastRank, total: sorted.length };
  }
  return { rank: 0, total: sorted.length };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    // middleware 会拦截，这里兜底
    return null;
  }

  const meId = session.user.id;
  const className = session.user.className || "";

  const grades = await prisma.grade.findMany({
    where: { studentId: meId },
    include: { exam: true },
    orderBy: [{ exam: { date: "desc" } }, { createdAt: "desc" }],
  });

  // 计算每场考试的班级排名（同分并列）
  const rankMap = new Map<string, { rank: number; total: number }>();
  for (const g of grades) {
    const classmates = await prisma.grade.findMany({
      where: {
        examId: g.examId,
        student: { className },
      },
      select: { studentId: true, totalScore: true },
    });
    rankMap.set(g.examId, computeRank(classmates, meId));
  }

  return (
    <div className="min-h-[calc(100vh-1px)] p-6 md:p-10 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">学生成绩</h1>
          <p className="text-muted-foreground">
            {session.user.name} · {session.user.className || "未设置班级"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            首页
          </Link>
          <SignOutButton />
        </div>
      </div>

      {grades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">暂无成绩记录</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {grades.map((g) => {
            const scores = (g.scores || {}) as Record<string, unknown>;
            const subjects = Array.from(
              new Set([...(g.exam.subjects || []), ...Object.keys(scores || {})]),
            );
            const rank = rankMap.get(g.examId);

            return (
              <Card key={g.id}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-xl">{g.exam.name}</CardTitle>
                      <div className="text-sm text-muted-foreground">
                        {new Date(g.exam.date).toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">总分：{g.totalScore}</Badge>
                      {rank ? (
                        <Badge variant="outline">
                          班级排名：{rank.rank}/{rank.total}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {subjects.map((sub) => (
                      <div
                        key={sub}
                        className="rounded-md border bg-background px-3 py-2 flex items-center justify-between"
                      >
                        <div className="text-sm text-muted-foreground truncate">{sub}</div>
                        <div className="font-medium tabular-nums">{formatScore(scores[sub])}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    缺考/空值显示为 “-”，总分计算时按 0。
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
