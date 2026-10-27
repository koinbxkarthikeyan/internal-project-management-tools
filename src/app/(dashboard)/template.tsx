// Re-mounts on every navigation inside the dashboard group, replaying the fade-in.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="anim-page-in">{children}</div>;
}
