import { useAuth } from '@/hooks/useAuth';
import { useLocation, Link } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchForm } from '@/components/search-form';
import { VersionSwitcher } from '@/components/version-switcher';
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
  LogOut,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const VERSIONS = ['1.0.0', '1.1.0-alpha'];

export default function AppSidebar(
  props: React.ComponentProps<typeof Sidebar>
) {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  const isActive = (url: string) => location.pathname.startsWith(url);

  const guestNav: NavGroup[] = [
    {
      title: '浏览',
      items: [{ title: '公开作品', url: '/player', icon: BookOpen }],
    },
  ];

  const userNav: NavGroup[] = [
    {
      title: '作品',
      items: [
        { title: '作品列表', url: '/player', icon: BookOpen },
        { title: '继续游戏', url: '/player/continue', icon: Play },
        { title: '游戏历史', url: '/player/history', icon: History },
      ],
    },
  ];

  const adminNav: NavGroup[] = [
    {
      title: '管理后台',
      items: [
        { title: '作品管理', url: '/admin/novels', icon: BookOpen },
        { title: '节点管理', url: '/admin/nodes', icon: GitBranch },
        { title: '事件管理', url: '/admin/events', icon: Zap },
      ],
    },
    {
      title: '用户管理',
      items: [
        { title: '用户列表', url: '/admin/users', icon: Users },
        { title: '角色管理', url: '/admin/roles', icon: Shield },
        { title: '权限设置', url: '/admin/permissions', icon: KeyRound },
      ],
    },
  ];

  const buildNav = (): NavGroup[] => {
    if (!user) return guestNav;

    const nav: NavGroup[] = [...userNav];
    if (hasRole('ADMIN')) {
      nav.push(...adminNav);
    }
    return nav;
  };

  const nav = buildNav();
  const initials = user?.nickname?.charAt(0)?.toUpperCase() || 'G';

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher versions={VERSIONS} defaultVersion={VERSIONS[0]} />
        <SearchForm />
      </SidebarHeader>

      <SidebarContent>
        {nav.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive(item.url)}
                      render={<Link to={item.url} />}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {user && hasRole('ADMIN') && (
          <>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/player') && !isActive('/admin')}
                  render={<Link to="/player" />}
                  tooltip="切换到玩家端"
                >
                  <Gamepad2 />
                  <span>切换到玩家端</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator />
          </>
        )}

        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.nickname}</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right" className="w-48">
                  <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive">
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex flex-col gap-1 px-2 py-1">
                <Link to="/login">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    登录
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="w-full justify-start">
                    注册
                  </Button>
                </Link>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
