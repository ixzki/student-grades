"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginClient({ loginTitle }: { loginTitle?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await signIn("credentials", {
      username: name,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!res || res.error) {
      toast.error("姓名或密码错误");
      return;
    }

    toast.success("登录成功");
    router.replace(callbackUrl);
  }

  return (
    <div className="min-h-[calc(100vh-1px)] flex flex-col items-center justify-center gap-6 p-6 bg-muted/30">
      <div className="text-center space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{(loginTitle || "学生成绩管理系统").trim()}</h1>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>请输入姓名与密码登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">姓名</Label>
              <Input
                id="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
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


          </form>
        </CardContent>
      </Card>
    </div>
  );
}
