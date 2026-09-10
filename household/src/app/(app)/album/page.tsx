import { AlbumBrowser } from "@/components/AlbumBrowser";

export default async function AlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;
  return <AlbumBrowser folderId={folder ?? null} />;
}
