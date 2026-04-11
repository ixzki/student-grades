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
  hidden: boolean;
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
  newSubjects: string[];
  errors: Array<{ row: number; username?: string; message: string }>;
};

type TabType = "exams" | "students" | "settings";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("exams");

  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  // 登录页标题配置
  const [loginTitle, setLoginTitle] = useState("学生成绩管理系统");
  const [savingLoginTitle, setSavingLoginTitle] = useState(false);

  // 学生列表
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsPage, setStudentsPage] = useState(1);
  const studentsPageSize = 20;
  const [studentsTotal, setStudentsTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(studentsTotal / studentsPageSize));

  // 批量删除 - 选中的学生 ID 列表
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

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
    const list: Exam[] = data.exams || [];
    setExams(list);

    // 选择考试（仅允许未隐藏）
    const current = selectedExamId ? list.find((x) => x.id === selectedExamId) : null;
    if (!selectedExamId || current?.hidden) {
      const first = list.find((x) => !x.hidden);
      setSelectedExamId(first?.id || "");
    }
  }

  async function toggleHidden(examId: string, nextHidden: boolean) {
    const tip = nextHidden
      ? "确定要隐藏该考试吗？隐藏后学生端将不可见（成绩会保留，可随时取消隐藏）。"
      : "确定要取消隐藏该考试吗？取消后学生端将恢复可见。";
    const ok = confirm(tip);
    if (!ok) return;

    const res = await fetch(`/api/admin/exams/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: nextHidden }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "操作失败");
      return;
    }

    toast.success(nextHidden ? "已隐藏" : "已取消隐藏");
    await loadExams();
  }

  async function deleteExam(examId: string) {
    const ok = confirm("确定要删除该考试吗？将删除该考试及其全部成绩，此操作不可恢复。");
    if (!ok) return;

    const res = await fetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "删除失败");
      return;
    }

    toast.success("考试已删除");
    await loadExams();
  }

  async function loadConfig() {
    const res = await fetch("/api/admin/config", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "加载系统配置失败");
      return;
    }

    setLoginTitle(String(data?.config?.loginTitle || "学生成绩管理系统"));
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    const v = loginTitle.trim();
    if (!v) {
      toast.error("标题不能为空");
      return;
    }

    setSavingLoginTitle(true);
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginTitle: v }),
    });
    setSavingLoginTitle(false);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message || "保存失败");
      return;
    }

    toast.success("登录页标题已更新");
    setLoginTitle(String(data?.config?.loginTitle || v));
  }

  async function loadStudents(page = studentsPage) {
    setLoadingStudents(true);
    const res = await fetch(`/api/admin/students?page=${page}&pageSize=${studentsPageSize}`, { cache: "no-store" });
    setLoadingStudents(false);

    if (!res.ok) {
      toast.error("加载学生列表失败");
      return;
    }

    const data = await res.json();
    setStudents(data.students || []);
    setStudentsTotal(Number(data.total || 0));
    setStudentsPage(Number(data.page || page));
  }

  useEffect(() => {
    loadExams();
    loadStudents(1);
    loadConfig();
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
    await loadStudents(1);
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
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const nextPage = students.length <= 1 ? Math.max(1, studentsPage - 1) : studentsPage;
    await loadStudents(nextPage);
  }

  // 批量删除
  async function deleteSelectedStudents() {
    if (selectedStudentIds.size === 0) {
      toast.error("请先选择要删除的学生");
      return;
    }

    const count = selectedStudentIds.size;
    const ok = confirm(`确定要删除选中的 ${count} 名学生吗？\n此操作将删除学生及其所有成绩，且不可恢复。`);
    if (!ok) return;

    const idsToDelete = Array.from(selectedStudentIds);
    const results = await Promise.all(
      idsToDelete.map(async (id) => {
        const res = await fetch("/api/admin/students", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        return { id, success: res.ok };
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (successCount > 0) {
      toast.success(`成功删除 ${successCount} 名学生`);
      setSelectedStudentIds(new Set());
      await loadStudents(studentsPage);
    }
    if (failCount > 0) {
      toast.error(`有 ${failCount} 名学生删除失败`);
    }
  }

  // 切换单个学生选中状态
  function toggleStudentSelection(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // 全选/取消全选
  function toggleSelectAll() {
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
    }
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
    <div className="min-h-[calc(100vh-1px)] flex flex-col">
      {/* 顶部导航栏 */}
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">管理员后台</h1>
              <p className="text-xs md:text-sm text-muted-foreground">考试管理 · 学生管理 · 系统设置</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={loadExams} disabled={loadingExams}>
                {loadingExams ? "刷新中…" : "刷新"}
              </Button>
              <SignOutButton />
            </div>
          </div>

          {/* 标签页切换 - 移动端横向滚动 */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 md:mx-0 md:px-0 md:overflow-visible">
            <Button
              variant={activeTab === "exams" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("exams")}
              className="whitespace-nowrap min-w-fit"
            >
              考试管理
            </Button>
            <Button
              variant={activeTab === "students" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("students")}
              className="whitespace-nowrap min-w-fit"
            >
              学生管理
            </Button>
            <Button
              variant={activeTab === "settings" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("settings")}
              className="whitespace-nowrap min-w-fit"
            >
              系统设置
            </Button>
          </div>
        </div>
      </header>

      {/* 内容区域 */}
      <main className="flex-1 p-4 md:p-6 space-y-4 overflow-auto">
        {/* 考试管理 */}
        {activeTab === "exams" && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* 创建考试 */}
              <Card>
                <CardHeader>
                  <CardTitle>创建考试</CardTitle>
                  <CardDescription>添加新的考试并配置科目</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={createExam} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="examName">考试名称</Label>
                      <Input
                        id="examName"
                        value={examName}
                        onChange={(e) => setExamName(e.target.value)}
                        placeholder="例如：2025 学年第一学期期末考试"
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
                    </div>

                    <Button type="submit" className="w-full">
                      创建考试
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* CSV 导入 */}
              <Card>
                <CardHeader>
                  <CardTitle>CSV 成绩导入</CardTitle>
                  <CardDescription>批量导入学生成绩</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={importCsv} className="space-y-4">
                    <div className="space-y-2">
                      <Label>选择考试</Label>
                      <Select
                        value={selectedExamId}
                        onValueChange={(v) => setSelectedExamId(v || "")}
                      >
                        <SelectTrigger className="w-full">
                          {selectedExam && selectedExamId ? (
                            <span className="truncate">{selectedExam.name}</span>
                          ) : (
                            <SelectValue placeholder={exams.length === 0 ? "暂无考试" : "请选择考试"} />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {exams.filter((e) => !e.hidden).map((e) => (
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
                        支持 UTF-8、GBK/GB2312（WPS ANSI）、UTF-16 编码，自动检测
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
                        <div className="text-sm">
                          写入/更新 <strong>{importResult.upserted}</strong> 条，跳过 <strong>{importResult.skipped}</strong> 条
                        </div>
                        {importResult.newSubjects?.length ? (
                          <p className="text-xs text-amber-600">
                            新增科目：{importResult.newSubjects.join("、")}
                          </p>
                        ) : null}
                        {importResult.errors?.length ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-red-600">查看 {importResult.errors.length} 条错误</summary>
                            <div className="mt-2 space-y-1 max-h-40 overflow-auto">
                              {importResult.errors.slice(0, 20).map((er, idx) => (
                                <div key={idx}>
                                  行{er.row}: {er.username || "未知"} - {er.message}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* 考试列表 */}
            <Card>
              <CardHeader>
                <CardTitle>考试列表</CardTitle>
                <CardDescription>{exams.length} 场考试</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>考试名称</TableHead>
                        <TableHead className="w-32">日期</TableHead>
                        <TableHead className="hidden md:table-cell">科目</TableHead>
                        <TableHead className="w-24 hidden md:table-cell">排名</TableHead>
                        <TableHead className="w-20">状态</TableHead>
                        <TableHead className="w-48 md:w-72">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            暂无考试，请点击上方"创建考试"
                          </TableCell>
                        </TableRow>
                      ) : (
                        exams.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium max-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{e.name}</span>
                                {e.hidden ? (
                                  <Badge variant="outline" className="text-amber-700 border-amber-200 shrink-0">已隐藏</Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>{format(new Date(e.date), "yyyy-MM-dd")}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {e.subjects.slice(0, 4).map((s) => (
                                  <Badge key={s} variant="outline" className="text-xs">
                                    {s}
                                  </Badge>
                                ))}
                                {e.subjects.length > 4 && (
                                  <Badge variant="outline" className="text-xs">+{e.subjects.length - 4}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
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
                              <Badge variant={e.hidden ? "outline" : "secondary"} className={e.hidden ? "text-amber-700" : ""}>
                                {e.hidden ? "隐藏" : "正常"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 md:gap-2">
                                <Link
                                  href={`/admin/exams/${e.id}`}
                                  className="inline-flex h-7 md:h-8 items-center justify-center rounded-md border border-border bg-background px-2 md:px-3 text-xs md:text-sm font-medium hover:bg-muted shrink-0"
                                >
                                  详情
                                </Link>
                                <Button
                                  size="sm"
                                  variant={e.hidden ? "secondary" : "outline"}
                                  className="h-7 md:h-8 shrink-0"
                                  onClick={() => toggleHidden(e.id, !e.hidden)}
                                >
                                  {e.hidden ? "取消隐藏" : "隐藏"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 md:h-8 shrink-0"
                                  onClick={() => deleteExam(e.id)}
                                >
                                  删除
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 学生管理 */}
        {activeTab === "students" && (
          <div className="space-y-4">
            {/* 添加学生 + 快捷操作 */}
            <Card>
              <CardHeader>
                <CardTitle>添加学生</CardTitle>
                <CardDescription>学生使用"姓名 + 密码"登录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="secondary" size="sm" onClick={() => loadStudents(studentsPage)} disabled={loadingStudents}>
                    {loadingStudents ? "刷新中…" : "刷新列表"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportStudents}>
                    导出学生名单（CSV）
                  </Button>
                </div>

                <Separator />

                <form onSubmit={addStudent} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      placeholder="例如：九年级 7 班"
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
                  <div className="flex items-end">
                    <Button type="submit" className="w-full">
                      添加学生
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 学生列表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle>学生列表</CardTitle>
                    <CardDescription>
                      共 {studentsTotal} 名学生 · 第 {studentsPage}/{totalPages} 页
                      {selectedStudentIds.size > 0 && (
                        <span className="ml-2 text-primary">已选择 {selectedStudentIds.size} 名</span>
                      )}
                    </CardDescription>
                  </div>
                  {selectedStudentIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={deleteSelectedStudents}
                      className="shrink-0"
                    >
                      批量删除 ({selectedStudentIds.size})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 分页控件 */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    每页 {studentsPageSize} 条
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingStudents || studentsPage <= 1}
                      onClick={() => loadStudents(1)}
                    >
                      首页
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingStudents || studentsPage <= 1}
                      onClick={() => loadStudents(studentsPage - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingStudents || studentsPage >= totalPages}
                      onClick={() => loadStudents(studentsPage + 1)}
                    >
                      下一页
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingStudents || studentsPage >= totalPages}
                      onClick={() => loadStudents(totalPages)}
                    >
                      末页
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={students.length > 0 && selectedStudentIds.size === students.length}
                            onChange={toggleSelectAll}
                            className="h-4 w-4"
                          />
                        </TableHead>
                        <TableHead className="w-32">姓名</TableHead>
                        <TableHead className="w-40 md:w-48">班级</TableHead>
                        <TableHead className="w-28 md:w-36">密码</TableHead>
                        <TableHead className="w-56 md:w-80">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            暂无学生
                          </TableCell>
                        </TableRow>
                      ) : (
                        students.map((s) => (
                          <TableRow
                            key={s.id}
                            className={selectedStudentIds.has(s.id) ? "bg-muted/50" : ""}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.has(s.id)}
                                onChange={() => toggleStudentSelection(s.id)}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell className="font-medium max-w-32 truncate">{s.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={s.className || ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setStudents((prev) => prev.map((x) => (x.id === s.id ? { ...x, className: v } : x)));
                                  }}
                                  placeholder="班级"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {s.plainPassword || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 md:gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 md:h-8 shrink-0"
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

                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 md:h-8 shrink-0"
                                  onClick={async () => {
                                    const ok = confirm("确定要重置该学生密码吗？将生成新的 6 位数字密码。");
                                    if (!ok) return;
                                    const res = await fetch("/api/admin/students", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: s.id, resetPassword: true }),
                                    });
                                    const data = await res.json().catch(() => null);
                                    if (!res.ok) {
                                      toast.error(data?.message || "重置失败");
                                      return;
                                    }
                                    const newPwd = data?.newPassword || "";
                                    toast.success(`密码已重置：${newPwd}`);
                                    await loadStudents(studentsPage);
                                  }}
                                >
                                  重置密码
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 md:h-8 shrink-0"
                                  onClick={() => deleteStudent(s.id)}
                                >
                                  删除
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 系统设置 */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-4">
            {/* 修改管理员密码 */}
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

            {/* 登录页标题设置 */}
            <Card>
              <CardHeader>
                <CardTitle>登录页标题</CardTitle>
                <CardDescription>学生/管理员登录页顶部显示的主标题</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveConfig} className="space-y-3">
                  <Input
                    value={loginTitle}
                    onChange={(e) => setLoginTitle(e.target.value)}
                    placeholder="例如：XX 学校成绩查询系统"
                  />
                  <Button type="submit" disabled={savingLoginTitle} className="w-full" variant="secondary">
                    {savingLoginTitle ? "保存中…" : "保存标题"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
