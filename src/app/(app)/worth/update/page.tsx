import { NetWorthUpdateForm } from "@/components/NetWorthUpdateForm";

export default async function WorthUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  return <NetWorthUpdateForm initialMonth={month ?? null} />;
}
