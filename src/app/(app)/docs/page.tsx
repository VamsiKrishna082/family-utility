import { DocsBrowser } from "@/components/DocsBrowser";

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;
  return <DocsBrowser folderId={folder ?? null} />;
}
