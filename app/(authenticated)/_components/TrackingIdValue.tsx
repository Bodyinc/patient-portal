function trackingHref(value: string): string | null {
  return /^https?:\/\//i.test(value) ? value : null;
}

export default function TrackingIdValue({
  trackingNumber,
  labeled = true,
}: {
  trackingNumber: string;
  labeled?: boolean;
}) {
  const value = trackingNumber.trim();
  if (!value) return null;
  const href = trackingHref(value);

  return (
    <p className="min-w-0 text-sm text-[#152A51]">
      {labeled ? <span className="text-[#152A51]/60">Tracking ID: </span> : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium break-all underline underline-offset-2 hover:text-[#152A51]/80"
        >
          {value}
        </a>
      ) : (
        <span className="font-medium break-all">{value}</span>
      )}
    </p>
  );
}
