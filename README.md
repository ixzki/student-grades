# 学生成绩查询与管理（Next.js App Router）

## 技术栈

- Next.js（App Router）
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma
- NextAuth.js v4（Credentials Provider）
- CSV 解析：papaparse
- 成绩趋势图：Recharts
- 日期处理：date-fns
- Toast 通知：sonner

## 功能概览

- **角色**：学生（STUDENT）/ 管理员（ADMIN）
- **动态科目**：每次考试的科目存储在 `Exam.subjects: String[]`，成绩存储在 `Grade.scores: Json`，前端动态渲染
- **管理员端**：
  - 创建考试（动态科目）
  - CSV 成绩导入（第一列姓名、第二列班级；动态读取表头作为科目）
  - 学生管理：查看/新增/删除学生、编辑班级、导出学生名单（CSV）、重置学生密码（生成新的 6 位随机数字密码）、批量删除学生、分页列表（每页 20 条）
  - 考试列表：考试详情（查看本次考试所有学生成绩表）、班级排名开关（控制学生是否能查看排名）、隐藏/取消隐藏考试、删除考试
  - 系统设置：修改管理员密码、自定义登录页标题
- **学生端**：
  - 登录：**姓名 + 密码**
  - Dashboard：成绩卡片列表（按考试日期倒序）、动态科目显示、成绩趋势折线图（含总分），可选展示班级并列排名

## 环境变量

复制 `.env.example` 为 `.env`。

- `DATABASE_URL`：PostgreSQL 连接串（Vercel Postgres / Neon / Supabase / 本地均可）
- `NEXTAUTH_URL`：本地为 `http://localhost:3000`，线上为你的域名
- `NEXTAUTH_SECRET`：生产环境必须设置

## 本地开发

### 1) 启动项目

```bash
pnpm install
pnpm dev
```

### 2) 初始化数据库（db push + seed）

```bash
pnpm db:push
pnpm db:seed
```

## 测试账号（seed 写入）

> 注意：线上环境请尽快修改管理员密码，并在管理员后台为学生重置/分发密码。

- 管理员：`admin / adminpassword`
- 学生示例：`张同学 / 123456`（其他学生：李同学、王同学、赵同学、钱同学、孙同学，密码均为 `123456`）

## 登录规则（重要）

- 管理员：使用 `username`（默认 `admin`）登录
- 学生：使用 **姓名（User.name）+ 密码** 登录

> 学生通过姓名登录，因此系统要求学生姓名必须唯一。

## CSV 导入格式（管理员后台）

- 前两列表头必须为：`姓名,班级`
- 后续列名会自动识别为科目名（动态合并到考试科目中）
- 若学生不存在（按姓名查找）：系统会自动创建学生，并生成 **6 位随机数字密码**（可在学生列表中查看/导出，或随时重置）

示例：

```csv
姓名,班级,语文,数学,英语,科学
张同学,九年级7班,92,88,95,90
李同学,九年级7班,85,91,78,84
```

- 空值/缺考会被写入为 `null`，前端显示 `-`，总分计算按 0

## 路由与权限

- `/login`：登录
- `/dashboard`：仅 STUDENT（成绩看板、趋势图）
- `/admin`：仅 ADMIN（考试管理、学生管理、系统设置）
- `/admin/exams/[examId]`：仅 ADMIN（考试详情/成绩表）
- `/unauthorized`：无权限提示页

中间件：`src/middleware.ts`

## API（关键）

- `GET/POST /api/admin/exams`：管理员读取/创建考试（subjects 动态数组）
- `GET/PATCH/DELETE /api/admin/exams/[examId]`：考试详情（含成绩表）/ 更新班级排名开关或隐藏状态 / 删除考试
- `POST /api/admin/import-grades`：管理员上传 CSV 导入成绩
- `GET/POST/PATCH/DELETE /api/admin/students`：学生列表（分页）、创建、编辑班级、重置密码、删除（支持批量）
- `GET /api/admin/students/export`：导出学生名单（姓名/班级/密码）
- `GET/PATCH /api/admin/config`：读取/更新系统配置（登录页标题）
- `POST /api/admin/change-password`：修改管理员密码
- `GET /api/student/exam-rank?examId=...`：学生查询某次考试的班级排名（同分并列；受考试开关控制）

## 一键部署到 Vercel

把仓库推到 GitHub 之后，把下面链接中的 `YOUR_GITHUB` / `YOUR_REPO` 替换为你的仓库信息即可：

```
https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GITHUB/YOUR_REPO
```

也可以做成 README 按钮：

```md
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GITHUB/YOUR_REPO)
```

### 部署必需环境变量

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`（建议：`openssl rand -base64 32`）

## Build 脚本

- `package.json#build`：`prisma generate && next build`
