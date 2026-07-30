export default function AuthenticatedLoading() {
  return (
    <main className="min-w-0 flex-1 bg-[#F3F6F6] p-3 sm:p-4">
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-md bg-[#E8EEED]" />
        <div className="h-7 w-48 rounded-md bg-[#E8EEED]" />
        <div className="h-40 rounded-md bg-[#E8EEED]/70" />
        <div className="h-64 rounded-md bg-[#E8EEED]/50" />
      </div>
    </main>
  );
}
