export type DashboardNavItem = {
  label: string;
  href: string;
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Meds", href: "/my-meds" },
  { label: "Consultations", href: "/consultations" },
  // { label: "Document Center", href: "/document-center" },
  { label: "Billing", href: "/billing" },
  { label: "Shop", href: "/shop" },
  { label: "Profile", href: "/profile" },
];

export const DASHBOARD_FOOTER_NAV: DashboardNavItem[] = [{ label: "Settings", href: "/settings" }];

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
