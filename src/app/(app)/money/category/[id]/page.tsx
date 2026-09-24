import { MoneyCategoryDetail } from "@/components/MoneyCategoryDetail";

export default async function MoneyCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;
  return <MoneyCategoryDetail categoryId={id} month={month ?? null} />;
}
