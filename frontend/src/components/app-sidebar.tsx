import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { NavMain } from "src/components/nav-main"
import { NavSecondary } from "src/components/nav-secondary"
import { NavUser } from "src/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "src/components/ui/sidebar"
import {
  BookOpen,
  Play,
  History,
  GitBranch,
  Shield,
  Gamepad2,
  CommandIcon,
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const location = useLocation();
  const isActive = (url: string) => location.pathname.startsWith(url);

  const mainNav = [
    { title: "Works", url: "/player", icon: <BookOpen />, isActive: isActive('/player') && !isActive('/admin') },
    { title: "Continue", url: "/player/continue", icon: <Play />, isActive: isActive('/player/continue') },
    { title: "History", url: "/player/history", icon: <History />, isActive: isActive('/player/history') },
  ];

  const adminNav = [
    { title: "Novels", url: "/admin/novels", icon: <BookOpen />, isActive: isActive('/admin/novels') },
    { title: "Nodes", url: "/admin/nodes", icon: <GitBranch />, isActive: isActive('/admin/nodes') },
    { title: "Roles", url: "/admin/roles", icon: <Shield />, isActive: isActive('/admin/roles') },
  ];

  const secondaryNav = user?.roles?.includes('ADMIN')
    ? [{ title: "Player Mode", url: "/player", icon: <Gamepad2 /> }]
    : [];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link to="/player" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Novel Simulator</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNav} />
        {user?.roles?.includes('ADMIN') && <NavMain title="Admin" items={adminNav} />}
        <NavSecondary items={secondaryNav} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
