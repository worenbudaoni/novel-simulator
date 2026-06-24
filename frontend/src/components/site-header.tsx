import { useLocation, Link } from 'react-router-dom';
import { Separator } from "src/components/ui/separator";
import { SidebarTrigger } from "src/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";

const adminLabels: Record<string, string> = {
  '': '作品管理',
  users: '用户管理',
  roles: '角色管理',
};

const breadcrumbMap: Record<string, string> = {
  '/player': '作品列表',
  '/player/guest': '游客浏览',
  '/player/continue': '继续游戏',
  '/player/history': '游戏历史',
  '/player/favorites': '我的收藏',
  '/player/recommendations': '为你推荐',
};

export function SiteHeader() {
  const { pathname } = useLocation();

  const buildBreadcrumb = () => {
    const path = pathname.replace(/\/$/, '');

    // /admin/novel/:id/xxx
    const novelMatch = path.match(/^\/admin\/novel\/(\d+)\/(.+)$/);
    if (novelMatch) {
      const sub = novelMatch[2];
      const subNames: Record<string, string> = {
        import: '导入',
        nodes: '节点编辑',
        events: '事件管理',
      };
      return [
        { label: '管理后台', href: '/admin' },
        { label: '作品管理', href: '/admin' },
        { label: subNames[sub] || sub, href: path },
      ];
    }

    // /admin/xxx
    const adminMatch = path.match(/^\/admin(?:\/(\w+))?$/);
    if (adminMatch !== null) {
      const sub = adminMatch[1] || '';
      return [
        { label: '管理后台', href: '/admin' },
        { label: adminLabels[sub] || sub, href: path },
      ];
    }

    // Direct match
    if (breadcrumbMap[path]) {
      return [{ label: breadcrumbMap[path], href: path }];
    }

    // Fallback
    const parent = path.substring(0, path.lastIndexOf('/')) || '/';
    if (parent !== path && breadcrumbMap[parent]) {
      return [
        { label: breadcrumbMap[parent], href: parent },
        { label: path.substring(path.lastIndexOf('/') + 1), href: path },
      ];
    }

    return [{ label: 'Novel Simulator', href: '/' }];
  };

  const crumbs = buildBreadcrumb();

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <nav className="flex items-center gap-1 text-sm">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon className="size-3.5 text-muted-foreground" />}
              {i < crumbs.length - 1 ? (
                <Link to={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
