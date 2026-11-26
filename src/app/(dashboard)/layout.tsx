import { ToastProvider } from "@/components/ui/Toast";
import PageTransitions from "@/components/layout/PageTransitions";
import Sidebar from "@/components/layout/Sidebar";
import AuthGate from "@/features/auth/components/AuthGate";
// import SignInApprovalGate from "@/features/auth/components/SignInApprovalGate"; // multi-computer approval pop-up: switched off, see lib/server/rpc.ts
import { BacklogProvider } from "@/features/backlog/context/BacklogContext";
import CreateBacklogDrawer from "@/features/backlog/components/CreateBacklogDrawer";
import BacklogDataGate from "@/features/backlog/components/BacklogDataGate";
import BacklogSidebar from "@/features/backlog/components/BacklogSidebar";
import LeaveLoader from "@/features/work/components/LeaveLoader";
import NotificationTicker from "@/features/notifications/components/NotificationTicker";
import NotificationFeed from "@/features/notifications/components/NotificationFeed";
import QuickCreateShortcuts from "@/features/backlog/components/QuickCreateShortcuts";
import ArrowDisclosure from "@/features/backlog/components/ArrowDisclosure";
import QuickSearch from "@/features/search/QuickSearch";
import TypeToSearch from "@/features/backlog/components/TypeToSearch";
import RecentPageTracker from "@/features/overview/components/RecentPageTracker";
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
      {/* Multi-computer approval (switched off): <SignInApprovalGate /> asks, on every page, whether a sign-in waiting on another computer is allowed. */}
      <CreateBacklogDrawer />
      <QuickCreateShortcuts />
      <PageTransitions />
      <TypeToSearch />
      <QuickSearch />
      <ArrowDisclosure />
      <SprintNotifications />
      <RecentPageTracker />
      <LeaveLoader />
      <NotificationFeed />
      <main id="main" tabIndex={-1} className="sb-main focus:outline-none min-w-0 px-4 pb-8 pt-16 sm:px-6 lg:pl-80 lg:pr-8 lg:pt-4">
        <NotificationTicker />
        <BacklogDataGate>{children}</BacklogDataGate>
      </main>
    </div>
    </BacklogProvider>
    </AuthGate>
    </ToastProvider>
  );
}
