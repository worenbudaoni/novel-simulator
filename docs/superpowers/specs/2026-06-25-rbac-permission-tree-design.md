# RBAC 权限树重构 — 设计文档

> 版本: v1.0
> 日期: 2026-06-25
> 状态: 已定稿

---

## 1. 背景与问题

### 1.1 现状

当前权限管理基于 RBAC0 模型（用户↔角色↔权限），但存在以下问题：

- **permission 表结构扁平**：只有 `code/resource/action` 三个维度，无法表达菜单→按钮→API 的层级关系
- **侧边栏硬编码**：`app-sidebar.tsx` 中菜单的显隐基于 `hasRole('ADMIN')` 角色检查，而非权限驱动
- **前段无声明式权限管控**：按钮显隐全靠手动 `hasPermission()`，没有统一组件
- **权限与菜单分离**：没有表把 permission_code 和前端路由关联起来

### 1.2 目标

- 改造 permission 表为树形结构，支持菜单/按钮两级权限
- 侧边栏由权限树动态渲染，不再硬编码
- 前端提供声明式权限组件控制按钮显隐
- 角色-权限分配页改为树形勾选

---

## 2. 权限表设计

### 2.1 表结构

```sql
CREATE TABLE permission (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id   BIGINT DEFAULT 0 NOT NULL,      -- 0=根节点
    name        VARCHAR(100) NOT NULL,           -- 显示名称
    code        VARCHAR(100) NOT NULL,           -- 权限标识，全局唯一
    type        TINYINT NOT NULL DEFAULT 1,      -- 1=菜单 2=按钮
    route       VARCHAR(200) DEFAULT NULL,       -- 前端路由（仅 type=1）
    status      TINYINT DEFAULT 1,               -- 1=有效 0=无效
    sort_order  INT DEFAULT 0,                   -- 排序
    created_by  BIGINT DEFAULT 0 NOT NULL,       -- 逻辑外键→user.id
    created_at  DATETIME,
    updated_at  DATETIME
);

CREATE UNIQUE INDEX uk_code ON permission(code);
```

### 2.2 字段说明

| 字段 | 说明 |
|------|------|
| `parent_id` | 父级 ID，0 表示根节点。构成无限级树 |
| `name` | UI 显示名称，如"用户管理"、"新建用户" |
| `code` | 权限标识，全局唯一。菜单以 `menu:` 为前缀，如 `menu:users`；按钮保持 `resource:action`，如 `user:create` |
| `type` | 1=菜单（对应前端路由和侧边栏项），2=按钮（对应页面内操作和后端 API 权限注解） |
| `route` | 仅菜单需要，如 `/admin/users`，用于路由守卫和侧边栏跳转 |
| `status` | 禁用后前端自动隐藏、后端鉴权拒绝 |

### 2.3 设计原则

- **菜单有 code，与路由守卫联动**：`<ProtectedRoute code="menu:users">` 拦截页面级访问
- **按钮和 API 共用同一个 code**：`novel:create` 既控按钮显隐，也控 `@PreAuthorize`，一条 code 管两端
- **管理员拥有全部权限**：登录时动态查出所有 `status=1` 的权限 code，不在 `role_permission` 显式维护

---

## 3. 数据迁移

### 3.1 新增菜单节点（type=1）

```
系统管理 (menu:admin, route=/admin)
├── 作品管理 (menu:novels, route=/admin)
├── 用户管理 (menu:users, route=/admin/users)
├── 角色管理 (menu:roles, route=/admin/roles)
├── 权限管理 (menu:permissions, route=/admin/permissions)
└── Prompt 配置 (menu:prompts, route=/admin)
```

### 3.2 现有 21 条按钮权限（type=2，不变）

原来按 resource/action 分组的按钮权限，更新 parent_id 指向对应菜单节点：

| 菜单 | 包含的按钮权限 |
|------|--------------|
| 作品管理 | novel:create, novel:read, novel:update, novel:delete, novel:set_visibility, node:read, node:create, node:update, node:delete, event:read, event:create, event:update, event:delete |
| 用户管理 | user:read, user:update_role, user:disable |
| 角色管理 | role:read, role:manage |
| 游玩端 | player:play, player:save, player:spin |

### 3.3 旧字段处理

`resource` / `action` 字段保留不动，前端逐步迁移到树形展示后再清理。

---

## 4. API 设计

### 4.1 权限树（给角色分配权限用）

```
GET /api/admin/permissions/tree
Authorization: Bearer {sessionId}

Response:
[
  {
    "id": 1,
    "parentId": 0,
    "name": "系统管理",
    "code": "menu:admin",
    "type": 1,
    "route": "/admin",
    "sortOrder": 1,
    "status": 1,
    "children": [...]
  }
]
```

递归返回全量权限树，仅包含 `status=1` 的节点。

### 4.2 当前用户菜单（给侧边栏用）

```
GET /api/auth/menus
Authorization: Bearer {sessionId}

Response:
[
  {
    "id": 1,
    "name": "系统管理",
    "code": "menu:admin",
    "route": "/admin",
    "children": [...]
  }
]
```

仅返回 `type=1` 且当前用户拥有权限（或其子节点拥有权限）的菜单。

### 4.3 角色-权限关联（现有接口，更新参数）

```
GET /api/admin/role/{id}/permissions
→ 返回当前角色的 permission id 列表 [1, 2, 3, ...]

PUT /api/admin/role/{id}/permissions
Body: [1, 2, 3, ...]
→ 先删后插，更新 role_permission 表
```

---

## 5. 前端改造

### 5.1 侧边栏动态渲染（app-sidebar.tsx）

**当前：**
```tsx
{hasRole('ADMIN') && <NavMain items={[...硬编码...]} />}
```

**改造后：**
```tsx
const [menuTree, setMenuTree] = useState<MenuItem[]>([]);

useEffect(() => {
  api.get('/api/auth/menus').then(res => {
    if (res.data.code === 200) setMenuTree(res.data.data);
  });
}, []);

// 递归渲染菜单树
<DynamicSidebar items={menuTree} />
```

### 5.2 声明式权限组件

```tsx
// 方式一：组件封装
<Authorized code="novel:create">
  <Button>新建作品</Button>
</Authorized>

// 方式二：hook
const canCreate = usePermission('novel:create');
```

逻辑：检查当前用户的 permissions 列表中是否包含该 code，不包含则 `children` 不渲染。

### 5.3 路由守卫改造

```tsx
<Route path="/admin/users" element={
  <ProtectedRoute code="menu:users">
    <AdminUsersPage />
  </ProtectedRoute>
} />
```

### 5.4 角色-权限分配页改树形勾选

新增 `<PermissionTree>` 组件：

```tsx
<PermissionTree
  data={permissionTree}       // 从 GET /api/admin/permissions/tree 获取
  selectedIds={selectedIds}   // 当前角色已有的权限 ID 列表
  onSelectChange={setSelectedIds}
/>
```

交互行为：

| 操作 | 行为 |
|------|------|
| 勾选父节点 | 全部子节点自动勾选 |
| 取消父节点 | 全部子节点自动取消 |
| 部分子节点勾选 | 父节点显示半选状态（indeterminate） |

### 5.5 权限管理页改造

新建/编辑权限的弹窗：

| 字段 | 控件 |
|------|------|
| 类型 | Select：菜单 / 按钮 |
| 父节点 | TreeSelect：选择树形父节点 |
| 名称 | Input |
| 权限标识 | Input（自动根据路径生成建议值） |
| 路由 | Input（仅 type=1） |
| 排序 | Number Input |
| 状态 | Switch |

---

## 6. 涉及文件清单

### 后端

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `sql/01-ddl.sql` | 修改 | permission 表加 parent_id / type / route / sort_order / created_by / updated_at |
| `sql/02-seed-data.sql` | 修改 | 新增菜单节点，现有权限加 parent_id |
| `entity/Permission.java` | 修改 | 加字段 + children 树形属性 |
| `mapper/PermissionMapper.java` | 修改 | 可能需要树形查询方法 |
| `service/PermissionService.java` | 新增 | 构建权限树、按用户过滤菜单 |
| `controller/PermissionController.java` | 新增 | `/tree` 返回全量树 |
| `controller/AuthController.java` 或新 Controller | 新增 | `/api/auth/menus` 返回当前用户菜单 |
| `dto/PermissionTreeNode.java` | 新增 | 树形节点 DTO |

### 前端

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `components/PermissionTree.tsx` | 新增 | 树形权限勾选组件 |
| `components/Authorized.tsx` | 新增 | 声明式权限控制组件 |
| `hooks/usePermission.ts` | 新增 | 权限检查 hook |
| `hooks/useMenuTree.ts` | 新增 | 菜单树加载 hook |
| `pages/page-admin-permissions.tsx` | 改造 | 新建弹窗适配新字段，列表改为树形展示 |
| `pages/page-admin-roles.tsx` | 改造 | 权限分配弹窗改为 `<PermissionTree />` |
| `components/app-sidebar.tsx` | 改造 | 从硬编码改为动态渲染 |
| `App.tsx` | 改造 | ProtectedRoute 改用 `menu:` code |
| `components/ProtectedRoute.tsx` | 改造 | 支持 code 参数 |

---

## 7. 管理员全部权限机制（保留不变）

```java
// AuthService 登录时
if (roleCodes.contains("ADMIN")) {
    // 查出所有 status=1 的 permission code
    permissionCodes = permissionMapper.selectList(
        new LambdaQueryWrapper<Permission>().eq(Permission::getStatus, 1)
    ).stream().map(Permission::getCode).collect(Collectors.toList());
}
```

不在 `role_permission` 表显式维护 `ADMIN→所有权限` 的关联。

---

## 8. 未解决的问题（后续迭代）

- Prompt 配置页尚未开发，本次新增 `menu:prompts` 菜单节点但指向 `/admin`
- `player:play` / `player:save` / `player:spin` 放在"游玩端"组下，后续 P3 再细化 Player 侧边栏
- 本次不涉及 P3 相关的 Player 端菜单渲染
