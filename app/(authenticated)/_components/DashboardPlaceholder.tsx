type DashboardPlaceholderProps = {
  title: string;
  description?: string;
};

export default function DashboardPlaceholder({
  title,
  description = "Content coming soon. Replace this page with your full UI when ready.",
}: DashboardPlaceholderProps) {
  return (
    <main className="min-w-0 flex-1 p-3">
      <div className="rounded-xl border border-[#DDD4FF] bg-white p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-[#2E00AB] sm:text-2xl lg:text-[34px]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-[#2E00AB]/80 sm:text-base">{description}</p>
      </div>
    </main>
  );
}
