# Frontend Sidebar Redesign

> 基于 shadcn/ui sidebar-01 重构前端布局，替换当前扁平化的卡片占位页面
> 日期: 2026-06-23

---

## 1. 问题陈述

当前前端存在的问题：

- **无实质布局** — PlayerHome 和 AdminHome 是两张居中占位卡片，显示"功能将在下一阶段实现"
- **导航单一** — 仅有一个顶部 Navbar，无侧边栏多级导航
- **路径分裂** — `npx shadcn@latest add sidebar-01` 将组件安装到了 `@/` 目录，与已有的 `src/` 源码目录分裂

## 2. 方案概述

使用 shadcn/ui 的 sidebar 组件构建完整的侧边栏布局系统，采用 **AuthLayout / SidebarLayout 双层布局结构**，根据登录状态和角色动态渲染侧边栏菜单。

## 3. 布局架构

### 3.1 双层路由布局

```
App (BrowserRouter + AuthProvider)
├── AuthLayout (无侧边栏，居中窄布局)
│   ├── /login         → LoginPage
│   ├── /register      → RegisterPage
│   └── *              → NotFoundPage
│
└── SidebarLayout (侧边栏 + 内容区)
    ├── /              → redirect → /player
    ├── /player        → PlayerHome
    └── /admin         → ProtectedRoute → AdminHome
```

### 3.2 AuthLayout

- 作用：包裹不需要侧边栏的页面
- 样式：垂直居中，水平居中，窄卡片布局（`max-w-md`）
- 包含页面：登录、注册、404
- 无导航栏、无侧边栏

### 3.3 SidebarLayout

- 作用：为已登录用户提供侧边栏 + 内容区的标准布局
- 结构：

```tsx
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <header className="sticky top-0 border-b bg-background/95 backdrop-blur">
      <SidebarTrigger />
      <span className="text-sm font-medium">{pageTitle}</span>
    </header>
    <main className="p-6">
      <Outlet />
    </main>
  </SidebarInset>
</SidebarProvider>
```

## 4. 侧边栏导航 (AppSidebar)

### 4.1 根据角色动态渲染

**未登录状态：**
- Logo + 应用名
- 分隔线
- 作品浏览（公开作品列表）
- 底部：登录/注册按钮

**普通用户 (USER)：**
- Logo + 应用名 + 版本选择器
- 🔍 搜索框
- 分隔线
- 📖 作品列表（默认 active）
- ▶  继续游戏
- 📜 游戏历史
- 分隔线
- 底部用户区：头像 + 昵称 → 下拉菜单（设置、退出登录）

**管理员 (ADMIN)：**
- Logo + 应用名 + 版本选择器
- 🔍 搜索框
- 分隔线
- 📦 管理后台
  - 📖 作品管理
  - 🔗 节点管理
  - 🎲 事件管理
- 👥 用户管理
  - 👤 用户列表
  - 🛡 角色管理
  - 🔑 权限设置
- 分隔线
- 🎮 切换到玩家端
- 分隔线
- 底部用户区：头像 + 昵称 → 下拉菜单（退出登录）

### 4.2 实现逻辑

```typescript
const { user, hasRole } = useAuth();
const location = useLocation();

// 根据角色构造导航项
const navigation = user
  ? buildAuthenticatedNav(user.roles)
  : buildGuestNav();
```

- 当前路由高亮：`isActive = location.pathname.startsWith(item.url)`
- 分组折叠：使用 shadcn `SidebarGroup` + `Collapsible`
- 移动端自动切换为 sheet 模式（sidebar 内置 `useIsMobile`）

## 5. 组件迁移方案

### 5.1 路径统一

将 components.json 中的 aliases 更新，使后续 `npx shadcn@latest add` 安装到 `src/` 下：

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

### 5.2 新增组件迁移

从 `@/` 迁移到 `src/` 的文件：

| 文件 | 源路径 | 目标路径 |
|------|--------|---------|
| sidebar 核心 | `@/components/ui/sidebar.tsx` | `src/components/ui/sidebar.tsx` |
| breadcrumb | `@/components/ui/breadcrumb.tsx` | `src/components/ui/breadcrumb.tsx` |
| sheet | `@/components/ui/sheet.tsx` | `src/components/ui/sheet.tsx` |
| skeleton | `@/components/ui/skeleton.tsx` | `src/components/ui/skeleton.tsx` |
| tooltip | `@/components/ui/tooltip.tsx` | `src/components/ui/tooltip.tsx` |
| app-sidebar | `@/components/app-sidebar.tsx` | `src/components/app-sidebar.tsx` |
| search-form | `@/components/search-form.tsx` | `src/components/search-form.tsx` |
| version-switcher | `@/components/version-switcher.tsx` | `src/components/version-switcher.tsx` |
| use-mobile | `@/hooks/use-mobile.ts` | `src/hooks/use-mobile.ts` |

### 5.3 删除重复组件

已有 `src/components/ui/` 下保留，删除 `@/` 下副本：
- `button.tsx` ✓ 保留 src 版本
- `input.tsx` ✓ 保留 src 版本
- `label.tsx` ✓ 保留 src 版本
- `separator.tsx` ✓ 保留 src 版本
- `dropdown-menu.tsx` ✓ 保留 src 版本

### 5.4 修改内部 import

迁移后的 app-sidebar.tsx 等文件中的 `@/components/` 路径需要改为相对路径 `../../components/` 或通过 tsconfig paths 解析。

## 6. 文件变更清单

### 新增文件
- `src/components/SidebarLayout.tsx` — 侧边栏布局组件
- `src/components/AuthLayout.tsx` — 无侧边栏布局组件
- `src/components/app-sidebar.tsx` — 应用侧边栏（从 @/ 迁移并改造）
- `src/components/search-form.tsx` — 侧边栏搜索组件（从 @/ 迁移并改造）
- `src/components/version-switcher.tsx` — 版本切换器（从 @/ 迁移并改造）
- `src/components/ui/sidebar.tsx` — shadcn sidebar 组件（从 @/ 迁移）
- `src/components/ui/breadcrumb.tsx` — shadcn breadcrumb 组件（从 @/ 迁移）
- `src/components/ui/sheet.tsx` — shadcn sheet 组件（从 @/ 迁移）
- `src/components/ui/skeleton.tsx` — shadcn skeleton 组件（从 @/ 迁移）
- `src/components/ui/tooltip.tsx` — shadcn tooltip 组件（从 @/ 迁移）
- `src/hooks/use-mobile.ts` — 移动端检测 hook（从 @/ 迁移）

### 修改文件
- `src/App.tsx` — 改为嵌套路由结构，引入 AuthLayout / SidebarLayout
- `components.json` — 更新 aliases 指向 src/
- `src/components/Navbar.tsx` — 替换为侧边栏布局（或移除）
- `src/pages/LoginPage.tsx` — 移除内边距，适配 AuthLayout
- `src/pages/RegisterPage.tsx` — 移除内边距，适配 AuthLayout
- `src/main.tsx` — 包裹 TooltipProvider
- `tsconfig.json` / `tsconfig.app.json` — 添加 `@/*` → `./src/*` paths

### 删除文件
- `@/components/` 下的重复组件（迁移后的文件）

## 7. 引用源

- shadcn/ui sidebar-01 block: 自动生成的 `@/` 目录组件
- 现有前端设计系统: `docs/superpowers/frontend-design.md`
- 旧版 API 通用状态码: `docs/superpowers/frontend-design.md#8-api-响应格式`
