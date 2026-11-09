import { GoalDetailView } from "@/components/views/GoalDetailView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoalDetailView goalId={id} />;
}
