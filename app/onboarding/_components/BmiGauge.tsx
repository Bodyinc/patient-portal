type BmiGaugeProps = {
  bmi: number;
  category: string;
};

/** Semi-circle BMI gauge — visual only; value comes from existing calculation. */
export default function BmiGauge({ bmi, category }: BmiGaugeProps) {
  // Map ~15–45 BMI onto the arc (clamped).
  const progress = Math.min(Math.max((bmi - 15) / 30, 0), 1);

  const size = 220;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  // Knob sits on the arc at `progress` (0 = left, 1 = right).
  const angle = Math.PI * (1 - progress);
  const knobX = cx + radius * Math.cos(angle);
  const knobY = cy - radius * Math.sin(angle);

  return (
    <div className="mx-auto flex w-full max-w-[260px] flex-col items-center">
      <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
        <svg
          viewBox={`0 0 ${size} ${size / 2 + stroke}`}
          className="h-auto w-full"
          role="img"
          aria-label={`BMI ${bmi}, ${category}`}
        >
          <path
            d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke="#E9EBEF"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke="#6A9B9C"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
          <circle cx={knobX} cy={knobY} r={9} fill="#6A9B9C" />
          <circle cx={knobX} cy={knobY} r={4} fill="white" />
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-1">
          <p className="text-[12px] font-medium leading-none text-[#152A51]">BMI</p>
          <p className="mt-1 text-[40px] font-medium leading-none tracking-[-0.5px] text-[#152A51] sm:text-[44px]">
            {bmi}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[13px] font-normal text-[#152A51]/80">{category}</p>
    </div>
  );
}
