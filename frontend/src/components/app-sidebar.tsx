import { Link } from 'react-router-dom';
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
  CommandIcon,
} from "lucide-react"

const data = {
  navMain: [
    { title: "Works", url: "/player", icon: <BookOpen /> },
    { title: "Continue", url: "/player/continue", icon: <Play /> },
    { title: "History", url: "/player/history", icon: <History /> },
  ],
  navSecondary: [],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
