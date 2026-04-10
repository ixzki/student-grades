"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Exam = {
  id: string;
  name: string;
  date: string;
  subjects: string[];
  createdAt: string;
};

type ImportResult = {
  upserted: number;
  skipped: number;
  importedSubjects: string[];
  unknownSubjects: string[];
  errors: Array<{ row: number; username?: string; message: string }>;
};

export default function AdminPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  // 创建考试
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [subjects, setSubjects] = useState<string[]>(["语文", "数学"]);
  const [newSubject, setNewSubject] = useState("");
  const uniqSubjects = useMemo(
    () => Array.from(new Set(subjects.map((s) => s.trim()).filter(Boolean))),
    [subjects],
  );

  // CSV 导入
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function loadExams() {
    setLoadingExams(true);
    const res = await fetch("/api/admin/exams", { cache: "no-store" });
    setLoadingExams(false);

    if (!res.ok) {
      toast.error("加载考试列表失败");
      return;
    }

    const data = await res.json();
    setExams(data.exams);

    if (!selectedExamId && data.exams?.[0]?.id) {
      setSelectedExamId(data.exams[0].id);
    }
  }

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createExam(e: React.FormEvent) {
    e.preventDefault();

    if (!examName.trim() || !examDate || uniqSubjects.length === 0) {
      toast.error("请填写考试名称、日期，并至少添加 1 个科目");
      return;
    }

    const res = await fetch("/api/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: examName,
        date: examDate,
        subjects: uniqSubjects,
      }),
    });

    if (!res.ok) {
      const msg = (await res.json().catch(() => null))?.message || "创建考试失败";
      toast.error(msg);
      return;
    }

    toast.success("考试创建成功");
    setExamName("");
    setExamDate("");
    setNewSubject("");
    setImportResult(null);
    await loadExams();
  }

  function addSubject() {
    const s = newSubject.trim();
    if (!s) return;
    setSubjects((prev) => [...prev, s]);
    setNewSubject("");
  }

  function removeSubject(s: string) {
    setSubjects((prev) => prev.filter((x) => x !== s));
  }

  async function importCsv(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExamId) {
      toast.error("请先选择一次考试");
      return;
    }
    if (!file) {
      toast.error("请选择 CSV 文件");
      return;
    }

    setImporting(true);
    setImportResult(null);

    const fd = new FormData();
    fd.set("examId", selectedExamId);
    fd.set("file", file);

    const res = await fetch("/api/admin/import-grades", {
      method: "POST",
      body: fd,
    });

    setImporting(false);

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      toast.error(data?.message || "导入失败");
      return;
    }

    setImportResult(data);
    toast.success(`导入完成：写入/更新 ${data.upserted} 条，跳过 ${data.skipped} 条`);
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId) || null;

  return (
    <div className="min-h-[calc(100vh-1px)] p-6 md:p-10 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">管理员后台</h1>
          <p className="text-muted-foreground">创建考试、维护动态科目、导入 CSV 成绩</p>
        </div>
        <Button variant="secondary" onClick={loadExams} disabled={loadingExams}>
          {loadingExams ? "刷新中…" : "刷新考试列表"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>创建考试</CardTitle>
            <CardDescription>科目列表为动态数组（写入 Exam.subjects）</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createExam} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="examName">考试名称</Label>
                <Input
                  id="examName"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="例如：2025学年第一学期期末考试"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="examDate">考试日期</Label>
                <Input
                  id="examDate"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>本次考试科目</Label>
                <div className="flex flex-wrap gap-2">
                  {uniqSubjects.length === 0 ? (
                    <span className="text-sm text-muted-foreground">尚未添加科目</span>
                  ) : (
                    uniqSubjects.map((s) => (
                      <Badge key={s} variant="secondary" className="gap-2">
                        {s}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => removeSubject(s)}
                          aria-label={`移除科目 ${s}`}
                        >
                          ×
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="输入科目名，例如：物理"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubject();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addSubject}>
                    添加
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  提示：导入 CSV 时，会动态读取表头列名作为科目。
                </p>
              </div>

              <Button type="submit" className="w-full">
                创建考试
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSV 成绩导入</CardTitle>
            <CardDescription>
              CSV 第一列必须为“学号”，后续列名自动识别为科目
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={importCsv} className="space-y-4">
              <div className="space-y-2">
                <Label>选择考试</Label>
                <Select
                  value={selectedExamId}
                  onValueChange={(v) => setSelectedExamId(v || "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择考试" />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedExam ? (
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(selectedExam.date), "yyyy-MM-dd")} · 科目：
                    {selectedExam.subjects.join("、")}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv">上传 CSV 文件</Label>
                <Input
                  id="csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  建议编码为 UTF-8；空分数会按缺考处理，前端显示 “-”。
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={importing}>
                {importing ? "导入中…" : "开始导入"}
              </Button>
            </form>

            {importResult ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="font-medium">导入结果</div>
                  <div className="text-sm text-muted-foreground">
                    写入/更新 {importResult.upserted} 条，跳过 {importResult.skipped} 条
                  </div>

                  <div className="text-sm">
                    <div className="mb-1">识别到的科目：</div>
                    <div className="flex flex-wrap gap-2">
                      {importResult.importedSubjects.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    {importResult.unknownSubjects?.length ? (
                      <p className="text-xs text-amber-600 mt-2">
                        注意：以下科目不在 Exam.subjects 中（仍会写入 scores）：
                        {importResult.unknownSubjects.join("、")}
                      </p>
                    ) : null}
                  </div>

                  {importResult.errors?.length ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">错误/跳过详情（最多展示 20 条）</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">行号</TableHead>
                            <TableHead className="w-40">学号</TableHead>
                            <TableHead>原因</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResult.errors.slice(0, 20).map((er, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{er.row}</TableCell>
                              <TableCell>{er.username || "-"}</TableCell>
                              <TableCell>{er.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>考试列表</CardTitle>
          <CardDescription>按日期倒序</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>考试名称</TableHead>
                <TableHead className="w-32">日期</TableHead>
                <TableHead>科目</TableHead>
                <TableHead className="w-40">ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    暂无考试
                  </TableCell>
                </TableRow>
              ) : (
                exams.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{format(new Date(e.date), "yyyy-MM-dd")}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {e.subjects.map((s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.id}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
