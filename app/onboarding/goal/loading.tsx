export default function GoalLoading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-2 lg:px-6">
      <div className="flex min-h-0 flex-1 flex-col justify-center -translate-y-4 sm:-translate-y-4">
        <div className="mx-auto w-full max-w-7xl text-center">
          <div className="mx-auto h-8 w-64 animate-pulse rounded bg-[#E8EEED] sm:h-9 sm:w-80" />
          <div className="mx-auto mt-10 grid w-full grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="w-full">
                <div className="aspect-[203/231] w-full animate-pulse rounded-[12px] bg-[#E8EEED]" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[#E8EEED]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[#E8EEED]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
