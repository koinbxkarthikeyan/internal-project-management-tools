import { ToastProvider } from "@/components/ui/Toast";
import Sidebar from "@/components/layout/Sidebar";
import AuthGate from "@/features/auth/components/AuthGate";
import { BacklogProvider } from "@/features/backlog/context/BacklogContext";
import CreateBacklogDrawer from "@/features/backlog/components/CreateBacklogDrawer";
import BacklogDataGate from "@/features/backlog/components/BacklogDataGate";
import BacklogSidebar from "@/features/backlog/components/BacklogSidebar";
import NotificationFeed from "@/features/notifications/components/NotificationFeed";
import SprintNotifications from "@/features/backlog/components/SprintNotifications";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
    <AuthGate>
    <BacklogProvider>
    <div className="min-h-screen">
      {/* For keyboard and screen-reader users: the first Tab stop jumps past the sidebar to the page. */}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent focus:shadow-menu focus-visible:outline-2 focus-visible:outline-accent">
        Skip to main content
      </a>
      <Sidebar>
        <BacklogSidebar />
      </Sidebar>
      <CreateBacklogDrawer />
      <SprintNotifications />
      <NotificationFeed />
      <main id="main" tabIndex={-1} className="sb-main focus:outline-none min-w-0 px-4 pb-8 pt-16 sm:px-6 lg:pl-80 lg:pr-8 lg:pt-8">
        <BacklogDataGate>{children}</BacklogDataGate>
      </main>
    </div>
    </BacklogProvider>
    </AuthGate>
    </ToastProvider>
  );
}
