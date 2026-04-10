"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";

import { SignOutButton } from "@/components/SignOutButton";

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
  enableClassRank: boolean;
  createdAt: string;
};

type Student = {
  id: string;
  name: string;
  className: string | null;
  plainPassword: string | null;
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

  // 学生列表
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  // 管理员改密
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

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

  async function loadStudents() {
    setLoadingStudents(true);
    const res = await fetch("/api/admin/students", { cache: "no-store" });
    setLoadingStudents(false);

    if (!res.ok) {
      toast.error("加载学生列表失败");
      return;
    }

    const data = await res.json();
    setStudents(data.students);
  }

  useEffect(() => {
    loadExams();
    loadStudents();
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

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!studentName.trim() || !studentClass.trim() || !studentPassword.trim()) {
      toast.error("请填写学生姓名、班级、密码");
      return;
    }

    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: studentName,
        className: studentClass,
        password: studentPassword,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "添加学生失败");
      return;
    }

    toast.success("学生已添加");
    setStudentName("");
    setStudentClass("");
    setStudentPassword("");
    await loadStudents();
  }

  async function deleteStudent(id: string) {
    const ok = confirm("确定要删除该学生吗？该学生所有成绩也会被删除。");
    if (!ok) return;

    const res = await fetch("/api/admin/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "删除失败");
      return;
    }

    toast.success("已删除");
    await loadStudents();
  }

  function exportStudents() {
    window.location.href = "/api/admin/students/export";
  }

  async function toggleRank(examId: string, enableClassRank: boolean) {
    const res = await fetch(`/api/admin/exams/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enableClassRank }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "更新失败");
      return;
    }

    setExams((prev) => prev.map((e) => (e.id === examId ? { ...e, enableClassRank } : e)));
  }

  async function changeAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPassword || newPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    if (newPassword !== newPassword2) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setChangingPwd(true);
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    setChangingPwd(false);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "修改失败");
      return;
    }

    toast.success("管理员密码已更新");
    setOldPassword("");
    setNewPassword("");
    setNewPassword2("");
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId) || null;

  return (
    <div className="min-h-[calc(100vh-1px)] p-6 md:p-10 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">管理员后台</h1>
          <p className="text-muted-foreground">创建考试、维护动态科目、导入 CSV 成绩</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadExams} disabled={loadingExams}>
            {loadingExams ? "刷新中…" : "刷新考试列表"}
          </Button>
          <SignOutButton />
        </div>
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
              CSV 前两列必须为“姓名”“班级”（或兼容“学号”“班级”），后续列名自动识别为科目。若学生不存在，将自动创建并生成 6 位随机密码。
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
                            <TableHead className="w-40">姓名/学号</TableHead>
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
                <TableHead className="w-32">班级排名</TableHead>
                <TableHead className="w-24">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                    <TableCell>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={e.enableClassRank}
                          onChange={(ev) => toggleRank(e.id, ev.target.checked)}
                        />
                        <span className="text-muted-foreground">
                          {e.enableClassRank ? "开启" : "关闭"}
                        </span>
                      </label>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/exams/${e.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
                      >
                        查看
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>修改管理员密码</CardTitle>
            <CardDescription>仅修改当前登录管理员的密码</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changeAdminPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">旧密码</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword2">确认新密码</Label>
                <Input
                  id="newPassword2"
                  type="password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={changingPwd} className="w-full">
                {changingPwd ? "提交中…" : "修改密码"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>学生列表</CardTitle>
            <CardDescription>学生使用“姓名 + 密码”登录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="secondary" onClick={loadStudents} disabled={loadingStudents}>
                {loadingStudents ? "刷新中…" : "刷新学生列表"}
              </Button>
              <Button variant="outline" onClick={exportStudents}>导出学生名单（CSV）</Button>
            </div>

            <form onSubmit={addStudent} className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="studentName">姓名</Label>
                <Input
                  id="studentName"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="例如：张三"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentClass">班级</Label>
                <Input
                  id="studentClass"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder="例如：九年级7班"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentPassword">密码</Label>
                <Input
                  id="studentPassword"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="至少 6 位"
                />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" className="w-full">添加学生</Button>
              </div>
            </form>

            <Separator />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead className="w-40">班级</TableHead>
                  <TableHead className="w-40">密码</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      暂无学生
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Input
                          value={s.className || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStudents((prev) => prev.map((x) => (x.id === s.id ? { ...x, className: v } : x)));
                          }}
                          placeholder="班级"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.plainPassword || ""}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const res = await fetch("/api/admin/students", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: s.id, className: s.className || "" }),
                            });
                            const data = await res.json().catch(() => null);
                            if (!res.ok) {
                              toast.error(data?.message || "更新失败");
                              return;
                            }
                            toast.success("班级已更新");
                          }}
                        >
                          保存
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteStudent(s.id)}>
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
