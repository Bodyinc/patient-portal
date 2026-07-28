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
      <div className="rounded-[24px] border border-[#E8EEED] bg-white p-6 sm:p-8">
        <h1 className="text-xl font-medium tracking-[-0.5px] text-[#152A51] sm:text-2xl lg:text-[32px]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[#152A51]/80 sm:text-base">{description}</p>
      </div>
    </main>
  );
}
