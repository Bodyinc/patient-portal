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
    <div className="rounded-[16px] border border-[#2E00AB]/20 bg-white p-4">
      <div className="mb-3 flex items-center justify-between border-b border-[#2E00AB]/10 pb-2">
        <h2 className="text-lg font-semibold text-[#2E00AB]">{title}</h2>
        <button type="button" className="text-sm font-medium text-[#2E00AB] hover:underline">
          Edit
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-sm text-[#2E00AB]/70">{item.label}</p>
            <p className="mt-0.5 text-base font-medium text-[#2E00AB]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
