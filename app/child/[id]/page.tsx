import { Header } from "@/components/layout/Header";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChildOverviewPage({ params }: Props) {
  const { id } = await params;
  const name = id.startsWith("11") ? "Zayyan" : "Zara";
  const emoji = id.startsWith("11") ? "🌿" : "🌸";

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title={`${emoji} ${name}`} subtitle="Activity overview" />
      <div className="p-5 md:p-8">
        <p className="text-[var(--text-secondary)] text-sm">Child overview — coming in Step 7.</p>
      </div>
    </div>
  );
}
