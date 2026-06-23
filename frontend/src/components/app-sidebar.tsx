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
  CommandIcon,
} from "lucide-react"

const navMain = [
  { title: "Works", url: "/player", icon: <BookOpen /> },
  { title: "Continue", url: "/player/continue", icon: <Play /> },
  { title: "History", url: "/player/history", icon: <History /> },
]

const documents = [
  { name: "Favorites", url: "/player/favorites", icon: <Heart /> },
  { name: "Recommendations", url: "/player/recommendations", icon: <Star /> },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

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
        <NavMain items={navMain} />
        <NavDocuments items={documents} />
        <NavSecondary items={[]} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {user ? <NavUser /> : (
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex flex-col gap-1 px-2 py-1">
                <Link to="/login">
                  <Button variant="outline" size="sm" className="w-full justify-start">Log in</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="w-full justify-start">Sign up</Button>
                </Link>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
