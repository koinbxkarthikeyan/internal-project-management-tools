export type NavItem = {
  label: string;
  href: string;
};

/** Top-level app routes. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Backlog", href: "/backlog" },
  { label: "Projects", href: "/projects" },
  { label: "Team Members", href: "/users" },
  { label: "Bulk Upload", href: "/bulk-upload" },
  { label: "Settings", href: "/settings" },
];
