import { ToastProvider } from "@/components/ui/Toast";
import Sidebar from "@/components/layout/Sidebar";
import AuthGate from "@/features/auth/components/AuthGate";
import { BacklogProvider } from "@/features/backlog/context/BacklogContext";
import CreateBacklogDrawer from "@/features/backlog/components/CreateBacklogDrawer";
import BacklogDataGate from "@/features/backlog/components/BacklogDataGate";
import BacklogSidebar from "@/features/backlog/components/BacklogSidebar";
import SprintNotifications from "@/features/backlog/components/SprintNotifications";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
    <AuthGate>
    <BacklogProvider>
    <div className="min-h-screen">
      <Sidebar>
        <BacklogSidebar />
      </Sidebar>
      <CreateBacklogDrawer />
      <SprintNotifications />
      <main className="min-w-0 px-4 pb-8 pt-16 sm:px-6 lg:pl-80 lg:pr-8 lg:pt-8">
        <BacklogDataGate>{children}</BacklogDataGate>
      </main>
    </div>
    </BacklogProvider>
    </AuthGate>
    </ToastProvider>
  );
}
