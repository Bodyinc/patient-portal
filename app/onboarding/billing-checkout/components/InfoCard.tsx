interface InfoItem {
  label: string;
  value: string;
}

interface InfoCardProps {
  title: string;
  items: InfoItem[];
}

export default function InfoCard({ title, items }: InfoCardProps) {
  return (
    <div className="rounded-[12px] border border-[#2E00AB]/20 bg-white p-3">
      <div className="mb-2 flex items-center justify-between border-b border-[#2E00AB]/10 pb-1.5">
        <h2 className="text-sm font-semibold text-[#2E00AB] sm:text-base">{title}</h2>
        <button type="button" className="text-xs font-medium text-[#2E00AB] hover:underline">
          Edit
        </button>
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-xs text-[#2E00AB]/70">{item.label}</p>
            <p className="truncate text-sm font-medium text-[#2E00AB]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
