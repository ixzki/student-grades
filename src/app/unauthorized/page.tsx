import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[calc(100vh-1px)] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">无权限访问</h1>
        <p className="text-muted-foreground">你当前登录的账号没有权限访问该页面。</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            返回首页
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            重新登录
          </Link>
        </div>
      </div>
    </div>
  );
}
