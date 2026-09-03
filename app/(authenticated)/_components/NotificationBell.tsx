"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getMyNotifications } from "@/lib/actions/notifications";
import { formatPortalDate } from "@/lib/date-format";
import type { PatientNotificationDto } from "@/lib/notifications/service-data";
import { cn } from "@/lib/utils";

const SEEN_AT_KEY = "patient_notifications_seen_at";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatPortalDate(iso);
}

function readSeenAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SEEN_AT_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function writeSeenAt(ms: number) {
  window.localStorage.setItem(SEEN_AT_KEY, String(ms));
}

type NotificationBellProps = {
  className?: string;
  iconClassName?: string;
};

export default function NotificationBell({
  className,
  iconClassName = "h-5 w-5 text-[#152A51]",
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  /** Cutoff for the unread badge (updated when the panel opens). */
  const [badgeSeenAt, setBadgeSeenAt] = useState(0);
  /** Cutoff for unread styling inside the open panel (previous seen time). */
  const [listSeenAt, setListSeenAt] = useState(0);

  const notificationsQuery = useQuery({
    queryKey: ["patient-notifications"],
    queryFn: async (): Promise<PatientNotificationDto[]> => {
      const result = await getMyNotifications();
      return result.ok ? result.data : [];
    },
  });
  const items = notificationsQuery.data ?? [];
  const loading = notificationsQuery.isLoading && items.length === 0;

  useEffect(() => {
    const seen = readSeenAt();
    setBadgeSeenAt(seen);
    setListSeenAt(seen);
  }, []);

  const unreadCount = items.filter((n) => new Date(n.createdAt).getTime() > badgeSeenAt).length;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      void notificationsQuery.refetch();
      const prev = readSeenAt();
      setListSeenAt(prev);
      const now = Date.now();
      writeSeenAt(now);
      setBadgeSeenAt(now);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className={cn(
            "relative shrink-0 rounded-full p-1.5 text-[#152A51] transition-colors hover:bg-[#E8EEED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#152A51]/30",
            className,
          )}
        >
          <Bell className={iconClassName} strokeWidth={1.8} />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6A9B9C] px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-2rem,360px)] border-[#E8EEED] bg-white p-0 shadow-lg"
      >
        <div className="border-b border-[#E8EEED] px-4 py-3">
          <p className="text-sm font-semibold text-[#152A51]">Notifications</p>
          <p className="text-xs text-[#152A51]/60">Updates about your care and orders</p>
        </div>

        <div className="max-h-[min(60vh,360px)] overflow-y-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-[#152A51]/60">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#152A51]/60">
              You&apos;re all caught up — no new updates yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#E8EEED]">
              {items.map((item) => {
                const isUnread = new Date(item.createdAt).getTime() > listSeenAt;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block px-4 py-3 transition-colors hover:bg-[#F3F6F6]",
                        isUnread && "bg-[#F3F6F6]/80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#152A51]">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-[#152A51]/70">{item.body}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-[#152A51]/50">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-[#E8EEED] px-4 py-2.5">
          <Link
            href="/my-meds"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-[#152A51] underline-offset-2 hover:underline"
          >
            View medication requests
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
