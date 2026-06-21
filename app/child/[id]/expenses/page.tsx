import { Header } from "@/components/layout/Header";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChildExpensesPage({ params }: Props) {
  const { id } = await params;
  const name = id.startsWith("11") ? "Zayyan" : "Zara";

  return (
    <div className="max-w-[1200px] mx-auto w-full">
      <Header title={`${name}'s Expenses`} />
      <div className="p-5 md:p-8">
        <p className="text-[var(--text-secondary)] text-sm">Expenses — coming in Step 6.</p>
      </div>
    </div>
  );
}
