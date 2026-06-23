import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from 'src/components/ui/sidebar';
import { Link } from 'react-router-dom';

interface NavItem {
  title: string;
  url: string;
  icon?: React.ReactNode;
}

export function NavMain({
  items,
  user,
}: {
  items: {
    title: string;
    items: NavItem[];
  }[];
  user: { nickname: string } | null;
}) {
  if (!items.length) return null;

  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.title}>
          {user && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link to={item.url} />}
                    tooltip={item.title}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
