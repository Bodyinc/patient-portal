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
    <div className="rounded-[14px] border border-[#E8E8E8] bg-white p-4 onboarding-font">
      <div className="mb-3 flex items-center justify-between border-b border-[#E8E8E8] pb-2">
        <h2 className="text-[15px] font-medium text-[#152A51] sm:text-[16px]">{title}</h2>
        {/* <button
          type="button"
          className="text-[12px] font-medium text-[#152A51] underline underline-offset-2 hover:opacity-80"
        >
          Edit
        </button> */}
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-[12px] text-[#152A51]/70">{item.label}</p>
            <p className="truncate text-[14px] font-medium text-[#152A51]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#F3F8F8] px-2.5 py-1 text-[11px] font-medium text-[#6A9B9C]">
        <span aria-hidden>✓</span>
        Your data is secure and encrypted
      </div>
    </div>
  );
}
