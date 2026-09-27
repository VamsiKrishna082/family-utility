import { AlbumBrowser } from "@/components/AlbumBrowser";

export default async function AlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; open?: string }>;
}) {
  const { folder, open } = await searchParams;
  return <AlbumBrowser folderId={folder ?? null} openId={open ?? null} />;
}
