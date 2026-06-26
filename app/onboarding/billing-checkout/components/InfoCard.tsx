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
    <div className="rounded-xl border border-[#2E00AB]/20 bg-white p-6">
      <div className="mb-5 flex items-center justify-between border-b border-[#2E00AB]/10 pb-3">
        <h2 className="text-2xl font-semibold text-[#2E00AB]">{title}</h2>

        <button className="text-sm text-[#2E00AB] hover:underline">Edit</button>
      </div>

      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-base text-[#2E00AB]/70">{item.label}</p>

            <p className="mt-1 text-lg font-medium text-[#2E00AB]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
