# Frontend Sidebar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat placeholder-card layout with a shadcn sidebar-based navigation system (AuthLayout / SidebarLayout), with role-aware menus for guests, USER, and ADMIN roles.

**Architecture:** Two layout wrappers wrap route groups: `AuthLayout` (centered narrow card, no sidebar — for login/register/404) and `SidebarLayout` (sidebar + top bar + content area — for /player and /admin). Sidebar-01 components are migrated from `@/` to `src/`. The global `Navbar.tsx` is removed; navigation lives entirely in the sidebar.

**Tech Stack:** React 19, React Router v7, shadcn/ui (sidebar-01 block), Tailwind CSS v4, Vite

**Spec:** `docs/superpowers/specs/2026-06-23-frontend-sidebar-redesign.md`

---

### Task 1: Update components.json aliases

**Files:**
- Modify: `frontend/components.json`

**Why:** The sidebar-01 block installed components under `@/` (resolved to `./@/`), but the project's source root is `src/`. We need future `npx shadcn@latest add` commands to install into `src/`.

- [ ] **Update aliases in components.json**

In `frontend/components.json`, change the `aliases` block:

```json
{
  "aliases": {
    "components": "src/components",
    "utils": "src/lib/utils",
    "ui": "src/components/ui",
    "lib": "src/lib",
    "hooks": "src/hooks"
  }
}
```

- [ ] **Commit**

```bash
cd frontend
git add components.json
git commit -m "chore: update shadcn aliases to use src/ directory"
```

---

### Task 2: Migrate sidebar-01 components from @/ to src/

**Files:**
- Move: `@/components/ui/sidebar.tsx` → `src/components/ui/sidebar.tsx`
- Move: `@/components/ui/breadcrumb.tsx` → `src/components/ui/breadcrumb.tsx`
- Move: `@/components/ui/sheet.tsx` → `src/components/ui/sheet.tsx`
- Move: `@/components/ui/skeleton.tsx` → `src/components/ui/skeleton.tsx`
- Move: `@/components/ui/tooltip.tsx` → `src/components/ui/tooltip.tsx`
- Move: `@/hooks/use-mobile.ts` → `src/hooks/use-mobile.ts`
- Move: `@/components/version-switcher.tsx` → `src/components/version-switcher.tsx`
- Move: `@/components/search-form.tsx` → `src/components/search-form.tsx`
- Move: `@/components/app-sidebar.tsx` → `src/components/app-sidebar.tsx`

**Note:** The expanded `@/` imports (e.g. `import ... from "@/components/ui/..."`) will resolve correctly because:
- `vite.config.ts` already has `alias: { '@': path.resolve(__dirname, './src') }`
- `tsconfig.app.json` already has `"paths": { "@/*": ["./src/*"] }`
- So `@/components/ui/button` → `src/components/ui/button`

- [ ] **Move UI primitive files**

```bash
cd frontend
cp @/components/ui/sidebar.tsx src/components/ui/sidebar.tsx
cp @/components/ui/breadcrumb.tsx src/components/ui/breadcrumb.tsx
cp @/components/ui/sheet.tsx src/components/ui/sheet.tsx
cp @/components/ui/skeleton.tsx src/components/ui/skeleton.tsx
cp @/components/ui/tooltip.tsx src/components/ui/tooltip.tsx
```

- [ ] **Move hook**

```bash
cp @/hooks/use-mobile.ts src/hooks/use-mobile.ts
```

- [ ] **Move block-level components** (these will be rewritten in later tasks, so just stage them)

```bash
cp @/components/version-switcher.tsx src/components/version-switcher.tsx
cp @/components/search-form.tsx src/components/search-form.tsx
cp @/components/app-sidebar.tsx src/components/app-sidebar.tsx
```

- [ ] **Commit**

```bash
git add src/components/ui/sidebar.tsx src/components/ui/breadcrumb.tsx src/components/ui/sheet.tsx
git add src/components/ui/skeleton.tsx src/components/ui/tooltip.tsx
git add src/hooks/use-mobile.ts
git add src/components/version-switcher.tsx src/components/search-form.tsx src/components/app-sidebar.tsx
git commit -m "feat: migrate sidebar-01 components from @/ to src/"
```

---

### Task 3: Delete @/ directory

**Files:**
- Delete: `@/` directory tree (43 files — all sidebar-01 originals + duplicated button/input/etc.)

- [ ] **Delete @/ directory**

```bash
cd frontend
rm -rf @/
```

- [ ] **Verify build still works** (should, since nothing imports from @/ any more)

```bash
npx tsc -b --noEmit 2>&1 | head -20
# Expected: 0 errors (or only pre-existing errors not related to @/)
```

- [ ] **Add `@/` to frontend .gitignore** (prevent accidental future installs to wrong path)

Append to `frontend/.gitignore`:

```
# shadcn installed to wrong path (should use src/)
@/
```

- [ ] **Commit**

```bash
git add frontend/.gitignore
git commit -m "chore: remove @/ directory, add to .gitignore"
```

---

### Task 4: Create AuthLayout layout component

**Files:**
- Create: `frontend/src/components/AuthLayout.tsx`

**Why:** Auth pages (login, register, 404) share the same layout: centered narrow card in full viewport, no sidebar, no top nav. This layout replaces the inline `min-h-screen flex items-center justify-center` that each page currently duplicates.

- [ ] **Create AuthLayout.tsx**

```tsx
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Outlet />
    </div>
  );
}
```

- [ ] **Update LoginPage.tsx** — remove outer wrapper

Replace the entire return of `LoginPage.tsx` with just the Card, because AuthLayout now provides the centering container.

Old outer wrapper (remove):
```tsx
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      ...
    </div>
```

The component should return only:
```tsx
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <CardTitle className="text-2xl">登录</CardTitle>
          <p className="text-sm text-muted-foreground">登录继续你的冒险</p>
        </CardHeader>
        <CardContent>
          {/* form content — stays exactly the same */}
        </CardContent>
      </Card>
```

- [ ] **Update RegisterPage.tsx** — remove outer wrapper

Same change as LoginPage: remove `min-h-screen flex items-center justify-center...` div, keep just the Card.

- [ ] **Update NotFoundPage.tsx** — remove outer wrapper

Same change: remove `min-h-screen flex items-center justify-center...` div, keep Card.

- [ ] **Commit**

```bash
git add src/components/AuthLayout.tsx src/pages/LoginPage.tsx src/pages/RegisterPage.tsx src/pages/NotFoundPage.tsx
git commit -m "feat: add AuthLayout, strip redundant wrappers from auth pages"
```

---

### Task 5: Create SidebarLayout component

**Files:**
- Create: `frontend/src/components/SidebarLayout.tsx`

**Why:** All authenticated pages share a sidebar + top header + content area. This layout provides the SidebarProvider scaffold.

- [ ] **Create SidebarLayout.tsx**

```tsx
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/components/app-sidebar';

const pageTitles: Record<string, string> = {
  '/player': '作品列表',
  '/admin': '管理后台',
};

export default function SidebarLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Novel Simulator';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger />
          <span className="text-sm font-medium">{title}</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Commit**

```bash
git add src/components/SidebarLayout.tsx
git commit -m "feat: add SidebarLayout with sidebar scaffold"
```

---

### Task 6: Rewrite AppSidebar with role-based navigation

**Files:**
- Modify: `frontend/src/components/app-sidebar.tsx` (complete rewrite of the auto-generated template)

**Why:** The auto-generated sidebar-01 template has hardcoded "Documentation / Getting Started" nav items. We need role-aware navigation for GUEST / USER / ADMIN.

- [ ] **Rewrite app-sidebar.tsx**

```tsx
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
  DropdownMenuSeparator,
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
```

- [ ] **Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: rewrite AppSidebar with role-based navigation"
```

---

### Task 7: Update SearchForm and VersionSwitcher for app context

**Files:**
- Modify: `frontend/src/components/search-form.tsx`
- Modify: `frontend/src/components/version-switcher.tsx`

**Why:** The auto-generated templates have generic placeholder text ("Search the docs...", "Documentation").

- [ ] **Update search-form.tsx** — change placeholder and remove `render` usage

Replace the component with:

```tsx
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
```

- [ ] **Update version-switcher.tsx** — change labels

Replace `"Documentation"` with `"Novel Simulator"` in the VersionSwitcher component.

In the JSX of `version-switcher.tsx`, change:
```tsx
<span className="font-medium">Documentation</span>
```
to:
```tsx
<span className="font-medium">Novel Simulator</span>
```

- [ ] **Commit**

```bash
git add src/components/search-form.tsx src/components/version-switcher.tsx
git commit -m "feat: adapt SearchForm and VersionSwitcher for app context"
```

---

### Task 8: Wrap app with TooltipProvider in main.tsx

**Files:**
- Modify: `frontend/src/main.tsx`

**Why:** shadcn sidebar uses `Tooltip` internally (for collapsed sidebar icon labels), which requires `TooltipProvider` at the root.

- [ ] **Add TooltipProvider to main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
```

- [ ] **Commit**

```bash
git add src/main.tsx
git commit -m "feat: add TooltipProvider for sidebar tooltip support"
```

---

### Task 9: Restructure App.tsx with nested routes

**Files:**
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/components/Navbar.tsx` (replaced by sidebar)

**Why:** Replace the flat route list with AuthLayout/SidebarLayout nesting. Remove the global Navbar — navigation is now in the sidebar.

- [ ] **Rewrite App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthLayout from './components/AuthLayout';
import SidebarLayout from './components/SidebarLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { BookOpen, LayoutDashboard } from 'lucide-react';

const PlayerHome = () => (
  <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-background px-4">
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-full bg-primary/10">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-xl">作品列表</CardTitle>
        <CardDescription>选择一部作品开始你的冒险</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">功能将在下一阶段实现</p>
      </CardContent>
    </Card>
  </div>
);

const AdminHome = () => (
  <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] bg-background px-4">
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-full bg-primary/10">
            <LayoutDashboard className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-xl">管理后台</CardTitle>
        <CardDescription>管理作品、节点、事件和用户</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">功能将在下一阶段实现</p>
      </CardContent>
    </Card>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* 无侧边栏路由组 */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* 有侧边栏路由组 */}
          <Route element={<SidebarLayout />}>
            <Route path="/" element={<Navigate to="/player" replace />} />
            <Route path="/player" element={<PlayerHome />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute permissions={['novel:read', 'user:read']}>
                  <AdminHome />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Delete Navbar.tsx**

```bash
rm src/components/Navbar.tsx
```

- [ ] **Commit**

```bash
git add src/App.tsx
git add -u src/components/Navbar.tsx
git commit -m "feat: restructure routes with AuthLayout/SidebarLayout, remove Navbar"
```

---

### Task 10: TypeScript build check

**Files:** none (just a build command)

- [ ] **Run TypeScript compiler to catch any type errors**

```bash
cd frontend
npx tsc -b --noEmit 2>&1
```

**Expected:** 0 errors.

If there are errors, fix them — most likely:
- Missing `useAuth` export? Check `AuthContext.tsx` exports `useAuth` (yes, from `hooks/useAuth.ts`)
- `Button` import path issue? The sidebar.tsx imports `Button` from `@/components/ui/button` — this should resolve to `src/components/ui/button`
- `type` import issues: the sidebar.tsx uses `React.ComponentProps` — ensure `React` is imported

- [ ] **Fix any build errors** (document what was fixed)

- [ ] **Commit fixes if any**

```bash
git commit -am "fix: resolve type errors after sidebar migration"
```

---

### Task 11: Final cleanup — verify dev server

**Files:** none

- [ ] **Start dev server and verify**

```bash
cd frontend
npx vite --host 2>&1 &
sleep 3
# Verify the app loads without console errors
curl -s http://localhost:5173 | head -5
```

Expected: HTML page loads, no 500 errors.

Check manually:
1. `/login` — renders centered login card with no sidebar
2. `/register` — renders centered register card with no sidebar
3. `/player` after login — shows sidebar with "作品列表" content area
4. `/admin` with ADMIN role — shows admin nav items in sidebar
5. `/player` without login — redirects to `/login`
6. Sidebar collapse/expand works via hamburger button
7. User dropdown shows in sidebar footer

- [ ] **Kill dev server**

```bash
kill %1 2>/dev/null; true
```

- [ ] **Final commit if any fixes**

```bash
git add -A && git commit -m "chore: final adjustments after sidebar redesign"
```
