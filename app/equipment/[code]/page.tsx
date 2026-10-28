import EquipmentClient from "./equipment-client";
import { todayWorkDate } from "@/lib/utils";

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const date = sp.date || todayWorkDate();
  return <EquipmentClient code={decodeURIComponent(code)} initialDate={date} />;
}
