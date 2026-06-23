import { useAuth } from '@/hooks/useAuth';
import { useLocation, Link } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from 'src/components/ui/sidebar';
import { NavMain } from 'src/components/nav-main';
import { NavSecondary } from 'src/components/nav-secondary';
import { NavUser } from 'src/components/nav-user';
import {
  BookOpen,
  Play,
  History,
  Users,
  Shield,
  KeyRound,
  GitBranch,
  Zap,
  Gamepad2,
  CommandIcon,
} from 'lucide-react';

interface NavItem {
  title: string;
  url: string;
  icon: React.ReactNode;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, hasRole } = useAuth();
  const location = useLocation();

  const isActive = (url: string) => location.pathname.startsWith(url);

  // Main navigation items - shown to all authenticated users
  const userNavItems: NavItem[] = [
    { title: '作品列表', url: '/player', icon: <BookOpen /> },
    { title: '继续游戏', url: '/player/continue', icon: <Play /> },
    { title: '游戏历史', url: '/player/history', icon: <History /> },
  ];

  // Admin-only navigation items
  const adminNavItems: NavItem[] = [
    { title: '作品管理', url: '/admin/novels', icon: <BookOpen /> },
    { title: '节点管理', url: '/admin/nodes', icon: <GitBranch /> },
    { title: '事件管理', url: '/admin/events', icon: <Zap /> },
    { title: '用户列表', url: '/admin/users', icon: <Users /> },
    { title: '角色管理', url: '/admin/roles', icon: <Shield /> },
    { title: '权限设置', url: '/admin/permissions', icon: <KeyRound /> },
  ];

  // Secondary nav - shown at the bottom of sidebar
  const secondaryItems: NavItem[] = [];
  if (hasRole('ADMIN')) {
    secondaryItems.push({
      title: '切换到玩家端',
      url: '/player',
      icon: <Gamepad2 />,
    });
  }

  // Build the nav items based on role
  const navItems = user
    ? [
        ...(hasRole('ADMIN')
          ? [{ title: '管理后台', items: adminNavItems }]
          : []),
        { title: '作品', items: userNavItems },
      ]
    : [{ title: '浏览', items: [{ title: '公开作品', url: '/player', icon: <BookOpen /> }] }];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={
                <Link to={user ? '/player' : '/login'} />
              }
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Novel Simulator</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} user={user} />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
