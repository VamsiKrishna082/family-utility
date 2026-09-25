import { TripPage } from "@/components/trips/TripPage";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripPage id={id} />;
}
