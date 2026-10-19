import { ActivityDetailView } from "@/components/views/ActivityDetailView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityDetailView activityId={id} />;
}
