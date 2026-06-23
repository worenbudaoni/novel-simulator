import { SidebarProvider } from 'src/components/ui/sidebar';
import { SidebarInset } from 'src/components/ui/sidebar';
import { Outlet } from 'react-router-dom';
import AppSidebar from '@/components/app-sidebar';
import { SiteHeader } from 'src/components/site-header';

export default function SidebarLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
