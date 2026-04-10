# 学生成绩查询与管理（Next.js App Router）

## 技术栈

- Next.js（App Router）
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma
- NextAuth.js v4（Credentials Provider）
- CSV 解析：papaparse

## 功能概览

- **角色**：学生（STUDENT）/ 管理员（ADMIN）
- **动态科目**：每次考试的科目存储在 `Exam.subjects: String[]`，成绩存储在 `Grade.scores: Json`，前端动态渲染
- **管理员端**：创建考试（动态科目）、CSV 成绩导入（动态读取表头）
- **学生端**：成绩卡片列表（按考试日期倒序）、动态科目显示、班级并列排名

## 环境变量

复制 `.env.example` 为 `.env`。

- `DATABASE_URL`：PostgreSQL 连接串（Vercel Postgres / Supabase / 本地均可）
- `NEXTAUTH_URL`：本地为 `http://localhost:3000`，线上为你的域名
- `NEXTAUTH_SECRET`：生产环境必须设置

## 本地开发（含本地 PostgreSQL）

> 本仓库在沙箱里为了满足“优先 db push”的要求，安装并初始化了本地 PostgreSQL。

### 1. 启动项目

```bash
pnpm install
pnpm dev
```

### 2. 初始化数据库（db push + seed）

```bash
pnpm db:push
pnpm db:seed
```

### 3. 测试账号

- 管理员：`admin / adminpassword`
- 学生：`20250701 / 123456`

## CSV 导入格式

- 第一列表头必须为：`学号`
- 后续列名会自动识别为科目名（动态）

示例：

```csv
学号,语文,数学,英语,科学
20250701,92,88,95,90
20250702,85,91,78,84
```

- 空值/缺考会被写入为 `null`，前端显示 `-`，总分计算按 0

## 路由与权限

- `/login`：登录
- `/dashboard`：仅 STUDENT
- `/admin`：仅 ADMIN

中间件：`src/middleware.ts`

## API（关键）

- `GET/POST /api/admin/exams`：管理员读取/创建考试（subjects 动态数组）
- `POST /api/admin/import-grades`：管理员上传 CSV 导入成绩
- `GET /api/student/exam-rank?examId=...`：学生查询某次考试的班级排名（同分并列）

## 部署到 Vercel（准备）

## 一键部署（Deploy Button）

把仓库推到 GitHub 之后，把下面链接中的 `YOUR_GITHUB` / `YOUR_REPO` 替换为你的仓库信息即可：

```
https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GITHUB/YOUR_REPO
```

你也可以把它做成 README 的按钮：

```md
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_GITHUB/YOUR_REPO)
```

## 环境变量

- `DATABASE_URL`：Vercel Postgres 或任意 PostgreSQL
- `NEXTAUTH_URL`：部署域名（Vercel 会给你一个 `https://xxx.vercel.app`）
- `NEXTAUTH_SECRET`：生产环境必须（建议 `openssl rand -base64 32`）

## Build 脚本

- `package.json#build` 已配置：`prisma generate && next build`

> 数据库推荐使用 **Vercel Postgres**（或任何兼容 PostgreSQL 的服务）。
