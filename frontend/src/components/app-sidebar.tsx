import { Link, useLocation } from 'react-router-dom';
import { NavMain } from "src/components/nav-main"
import { NavDocuments } from "src/components/nav-documents"
import { NavSecondary } from "src/components/nav-secondary"
import { NavUser } from "src/components/nav-user"
import { Button } from "src/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "src/components/ui/sidebar"
import { useAuth } from '@/hooks/useAuth';
import { useMenuTree } from '@/hooks/useMenuTree';
import { BookOpen, LayoutDashboard, Users, Shield, KeyRound, CommandIcon } from "lucide-react"

const routeIcons: Record<string, React.ReactNode> = {
  '/admin': <LayoutDashboard className="size-4" />,
  '/admin/users': <Users className="size-4" />,
  '/admin/roles': <Shield className="size-4" />,
  '/admin/permissions': <KeyRound className="size-4" />,
};

const defaultIcon = <LayoutDashboard className="size-4" />;

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const { menuTree } = useMenuTree();
  const { pathname } = useLocation();

  const isActive = (url: string) => {
    if (url === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/novel/');
    if (url === '/player') return pathname === '/player' || pathname === '/player/guest';
    return pathname.startsWith(url);
  };

  const adminItems: { title: string; url: string; icon: React.ReactNode; isActive?: boolean }[] = [];
  const seenUrls = new Set<string>();
  const sysGroup = menuTree.find(n => n.code === 'menu:admin');
  if (sysGroup && sysGroup.children) {
    for (const child of sysGroup.children) {
      if (child.type !== 1) continue;
      const url = child.route || '/';
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const icon = routeIcons[url] || defaultIcon;
      adminItems.push({ title: child.name, url, icon, isActive: isActive(url) });
    }
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5! hover:bg-transparent hover:text-inherit active:bg-transparent data-active:bg-transparent cursor-default"
              render={<Link to="/" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Novel Simulator</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {user ? (
          <>
            <NavMain items={[
              { title: "作品列表", url: "/player", icon: <BookOpen />, isActive: isActive('/player') },
            ]} />
            <NavDocuments items={[]} />
            {adminItems.length > 0 && (
              <NavMain title="管理后台" items={adminItems} />
            )}
          </>
        ) : (
          <NavMain items={[
            { title: "公开作品", url: "/player", icon: <BookOpen />, isActive: isActive('/player') },
          ]} />
        )}
        <NavSecondary items={[]} />
      </SidebarContent>
      <SidebarFooter>
        {user ? <NavUser /> : (
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex flex-col gap-1 px-2 py-1">
                <Link to="/login">
                  <Button variant="outline" size="sm" className="w-full justify-start">登录</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="w-full justify-start">注册</Button>
                </Link>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
