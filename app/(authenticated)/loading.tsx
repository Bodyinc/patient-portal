export default function AuthenticatedLoading() {
  return (
    <main className="min-w-0 flex-1 bg-[#FAF8FF] p-3 sm:p-4">
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-md bg-[#EDE7FA]" />
        <div className="h-7 w-48 rounded-md bg-[#EDE7FA]" />
        <div className="h-40 rounded-md bg-[#EDE7FA]/70" />
        <div className="h-64 rounded-md bg-[#EDE7FA]/50" />
      </div>
    </main>
  );
}
