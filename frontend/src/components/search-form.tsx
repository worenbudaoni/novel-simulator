import { SidebarGroup, SidebarGroupContent, SidebarInput } from '@/components/ui/sidebar';
import { SearchIcon } from 'lucide-react';

export function SearchForm({ ...props }: React.ComponentProps<'form'>) {
  return (
    <form {...props}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <SidebarInput id="search" placeholder="搜索作品..." className="pl-8" />
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 opacity-50 select-none" />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  );
}
