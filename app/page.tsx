import { Suspense } from "react";
import DashboardClient from "./dashboard-client";
import { todayWorkDate } from "@/lib/utils";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; factory?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date || todayWorkDate();
  const factory = sp.factory || "";
  return (
    <Suspense fallback={<div className="text-slate-500">로딩 중...</div>}>
      <DashboardClient initialDate={date} initialFactory={factory} />
    </Suspense>
  );
}
