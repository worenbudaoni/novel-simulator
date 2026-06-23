import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/components/app-sidebar';

const pageTitles: Record<string, string> = {
  '/player': '作品列表',
  '/admin': '管理后台',
};

export default function SidebarLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Novel Simulator';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger />
          <span className="text-sm font-medium">{title}</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
