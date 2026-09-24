import { DocumentDetail } from "@/components/DocumentDetail";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { id } = await params;
  const { share } = await searchParams;
  return <DocumentDetail id={id} openShareOnLoad={share === "1"} />;
}
