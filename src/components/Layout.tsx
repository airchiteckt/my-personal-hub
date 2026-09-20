import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { AiAssistant } from '@/components/AiAssistant';
import { useAutoReschedule } from '@/hooks/use-auto-reschedule';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

export function Layout() {
  useAutoReschedule();
  const { isFeatureEnabled } = useFeatureFlags();
  const { pathname } = useLocation();
  const isCalendar = pathname === '/calendar';

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-[100dvh] flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 shrink-0">
            <SidebarTrigger />
          </header>
          {isFeatureEnabled('feature_ai_assistant') && <AiAssistant variant="fab" />}
          <main
            className={
              isCalendar
                ? 'flex-1 min-h-0 overflow-hidden p-4 pb-28 md:p-5 md:pb-5'
                : 'flex-1 overflow-auto p-4 md:p-6 pb-28 md:pb-6'
            }
          >
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
