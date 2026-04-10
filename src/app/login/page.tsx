import { Suspense } from "react";
import LoginClient from "./LoginClient";
import { getLoginTitleSafe } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const loginTitle = await getLoginTitleSafe();

  return (
    <Suspense fallback={null}>
      <LoginClient loginTitle={loginTitle} />
    </Suspense>
  );
}
