"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!res || res.error) {
      toast.error("账号或密码错误");
      return;
    }

    toast.success("登录成功");
    router.replace(callbackUrl);
  }

  return (
    <div className="min-h-[calc(100vh-1px)] flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>学生/管理员使用账号密码登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">学号 / 账号</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例如：20250701 或 admin"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "登录中…" : "登录"}
            </Button>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>测试账号：</p>
              <p>管理员：admin / adminpassword</p>
              <p>学生：20250701 / 123456</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
