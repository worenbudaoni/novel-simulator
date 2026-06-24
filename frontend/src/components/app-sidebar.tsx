import { Link } from 'react-router-dom';
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
import {
  BookOpen,
  Play,
  History,
  Heart,
  Star,
  LayoutDashboard,
  GitBranch,
  Zap,
  Users,
  CommandIcon,
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, hasRole } = useAuth();

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
        {user ? (
          <>
            <NavMain items={[
              { title: "作品列表", url: "/player", icon: <BookOpen /> },
              { title: "继续游戏", url: "/player/continue", icon: <Play /> },
              { title: "游戏历史", url: "/player/history", icon: <History /> },
            ]} />
            <NavDocuments items={[
              { name: "我的收藏", url: "/player/favorites", icon: <Heart /> },
              { name: "为你推荐", url: "/player/recommendations", icon: <Star /> },
            ]} />
            {hasRole('ADMIN') && (
              <NavMain title="管理后台" items={[
                { title: "作品管理", url: "/admin", icon: <LayoutDashboard /> },
                { title: "节点管理", url: "/admin", icon: <GitBranch /> },
                { title: "事件管理", url: "/admin", icon: <Zap /> },
                { title: "用户管理", url: "/admin", icon: <Users /> },
              ]} />
            )}
          </>
        ) : (
          <NavMain items={[
            { title: "公开作品", url: "/player", icon: <BookOpen /> },
          ]} />
        )}
        <NavSecondary items={[]} className="mt-auto" />
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
