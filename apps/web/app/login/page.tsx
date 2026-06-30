import { Suspense } from "react";
import LoginPage from "./login-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Loading sign in…</div>}>
      <LoginPage />
    </Suspense>
  );
}
