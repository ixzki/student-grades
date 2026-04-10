import { prisma } from "@/lib/prisma";

export const DEFAULT_LOGIN_TITLE = "学生成绩管理系统";

export async function getLoginTitleSafe(): Promise<string> {
  try {
    const cfg = await prisma.appConfig.findUnique({ where: { id: 1 }, select: { loginTitle: true } });
    return (cfg?.loginTitle || "").trim() || DEFAULT_LOGIN_TITLE;
  } catch (e) {
    console.error(e);
    return DEFAULT_LOGIN_TITLE;
  }
}
