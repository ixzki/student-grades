"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ExamDetail = {
  id: string;
  name: string;
  date: string;
  subjects: string[];
  enableClassRank: boolean;
  grades: Array<{
    id: string;
    scores: Record<string, number | null>;
    totalScore: number;
    student: { id: string; name: string; className: string | null };
  }>;
};

type SortDirection = "asc" | "desc";

export default function AdminExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const examId = params?.examId || "";

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [sortKey, setSortKey] = useState<string>("totalScore");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/exams/${examId}`, { cache: "no-store" });
    setLoading(false);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "加载失败");
      return;
    }

    setExam(data.exam);
  }

  useEffect(() => {
    if (examId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const subjects = useMemo(() => exam?.subjects || [], [exam]);

  function toggleSort(nextKey: string) {
    setSortKey((prevKey) => {
      if (prevKey === nextKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("desc");
      return nextKey;
    });
  }

  const sortedGrades = useMemo(() => {
    const grades = (exam?.grades || []).slice();
    const key = sortKey;
    const dir = sortDir;

    function getValue(g: ExamDetail["grades"][number]): number | null {
      if (key === "totalScore") return typeof g.totalScore === "number" ? g.totalScore : null;
      const v = g.scores?.[key];
      return typeof v === "number" ? v : null;
    }

    grades.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);

      // 规则：空值（缺考）永远排在最后
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (av === bv) return 0;
      return dir === "asc" ? av - bv : bv - av;
    });

    return grades;
  }, [exam?.grades, sortDir, sortKey]);

  function SortableHead({ label, k }: { label: string; k: string }) {
    const active = sortKey === k;
    const indicator = active ? (sortDir === "asc" ? "↑" : "↓") : "";
    return (
      <TableHead className="w-24">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 text-left hover:underline ${active ? "font-semibold" : ""}`}
          title="点击切换正序/倒序"
        >
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">{indicator}</span>
        </button>
      </TableHead>
    );
  }

  return (
    <div className="min-h-[calc(100vh-1px)] p-6 md:p-10 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">考试详情</h1>
          <p className="text-muted-foreground">查看本次考试所有学生成绩</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            返回后台
          </Link>
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{exam?.name || "-"}</CardTitle>
          <CardDescription>
            {exam ? format(new Date(exam.date), "yyyy-MM-dd") : ""} · 班级排名：{exam?.enableClassRank ? "开启" : "关闭"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
            <Badge variant="outline">总分</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">姓名</TableHead>
                <TableHead className="w-40">班级</TableHead>
                {subjects.map((s) => (
                  <SortableHead key={s} label={s} k={s} />
                ))}
                <SortableHead label="总分" k="totalScore" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGrades.length ? (
                sortedGrades.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.student.name}</TableCell>
                    <TableCell>{g.student.className || "-"}</TableCell>
                    {subjects.map((s) => (
                      <TableCell key={s}>{typeof g.scores?.[s] === "number" ? g.scores[s] : "-"}</TableCell>
                    ))}
                    <TableCell className="font-semibold">{g.totalScore}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={subjects.length + 3} className="text-center text-muted-foreground">
                    暂无成绩数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <p className="text-xs text-muted-foreground">提示：点击表头的科目名可切换正序/倒序（缺考/空值默认排在最后）。</p>
        </CardContent>
      </Card>
    </div>
  );
}
