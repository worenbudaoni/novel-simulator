# Novel Interactive Story Simulator — 进度总览

> 总设计文档: `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md`
> 实施计划: `docs/superpowers/plans/2026-06-18-P1-基础架构.md`, `docs/superpowers/plans/2026-06-24-P2-content-management.md`
> 最后更新: 2026-06-25

---

## 进度概况

| 阶段 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **P1 基础架构** | ✅ **已完成** | **代码 100% / 数据库待执行** | 后端代码 + 前端脚手架全部完成，需建表后联调 |
| **P2 内容管理** | ✅ **已完成** | **后端 100% / 前端 100%** | Novel CRUD, Node/Event CRUD, LLM导入(名称+TXT), Admin页面完整 |
| **RBAC 权限树重构** | ✅ **已完成** | **后端 100% / 前端 100%** | 树形权限表、动态侧边栏、声明式权限控制、树形角色权限分配、TanStack Table 权限管理 |
| P3 核心玩法 | 🔄 **进行中** | **P3-C 完成，架构重构中** | 新增架构方向：骨架(节点+连接)与血肉(选项+故事+事件)分离，选项由LLM动态生成 |
| P4 叙事与评分 | ⏳ 待开始 | 0% | - |
| P5 管理完善与移动端 | ⏳ 待开始 | 0% | - |

## 当前阶段

**当前阶段：** P3 核心玩法 🔄 → 架构调整中（骨架血肉分离 + OptionChain + StoryChain 全量对话历史）

### 当前参考文档

| 文档 | 说明 |
|------|------|
| `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md` | 总设计文档，§6 Chain 设计已更新 |
| `docs/superpowers/roadmap/P3-核心玩法.md` | P3 任务清单，已完成/待完成标记清晰 |
| `docs/superpowers/gameplay/llm-deep-participation.md` | **下一步待执行：** StoryChain/EventChain 接入 LLM |
| `docs/superpowers/gameplay/gameplay-mechanics-design.md` | 玩法机制设计（角色创建、属性驱动等） |
| `docs/superpowers/gameplay/gameplay-logic.md` | 当前完整流程定义 |
| `docs/superpowers/plans/2026-06-25-P3-A-player-basics.md` | P3-A 实施计划（已完成） |
| `docs/superpowers/plans/2026-06-25-P3-B-core-gameplay.md` | P3-B 实施计划（已完成） |

### 最新提交

```bash
# 最后一次提交（文档更新）
git log -1 --oneline
# 需要执行的下一个任务：按 llm-deep-participation.md 改造 StoryChain + EventChain
```

## P1 完成情况

### 后端（已完成）
| 任务 | 状态 | 说明 |
|-----|------|------|
| pom.xml 依赖 | ✅ | MyBatisPlus, Spring Security, Redis, LangChain4j, MySQL |
| 配置文件 | ✅ | application.yml, SecurityConfig, RedisConfig, MyBatisPlusConfig |
| 公共工具类 | ✅ | Result.java (统一响应), UserContext.java |
| SQL 文件 | ✅ | `sql/01-ddl.sql` + `sql/02-seed-data.sql` (需要你手动执行) |
| Entity (15个) | ✅ | user, role, permission, user_role, role_permission, novel, novel_role_visibility, node, node_edge, node_option, random_event, user_session, user_character, parse_record, llm_cache |
| Mapper (15个) | ✅ | 全部继承 BaseMapper |
| DTO (3个) | ✅ | LoginRequest, RegisterRequest, AuthResponse |
| AuthFilter | ✅ | Redis 会话验证, 白名单, 自动续期 |
| AuthService | ✅ | 注册(自动分配USER角色), 登录(查询RBAC), 登出, 会话管理 |
| Controllers | ✅ | AuthController (4个接口), TestController (3个测试接口) |

### 前端（已完成）
| 任务 | 状态 | 说明 |
|-----|------|------|
| Vite + React 项目 | ✅ | TypeScript, react-router-dom, axios |
| Tailwind CSS | ✅ | @tailwindcss/vite 插件 |
| useAuth hook | ✅ | sessionId 管理, 登录/注册/登出, 权限检查 |
| useApi | ✅ | axios 封装, 自动附加 Authorization header |
| LoginPage | ✅ | 表单验证, 错误提示, 登录后跳转 |
| RegisterPage | ✅ | 表单验证, 确认密码, 注册后跳转登录 |
| Navbar | ✅ | 用户菜单, 角色显示, 退出按钮, Admin 链接 |
| ProtectedRoute | ✅ | 权限守卫, 403 页面, 未登录重定向 |
| 构建 | ✅ | `npm run build` 成功 |

## P2 完成情况

### 后端（已完成）
| 任务 | 状态 | 说明 |
|-----|------|------|
| Novel CRUD | ✅ | NovelController + NovelService (create/list/detail/update/delete) |
| Novel 可见角色配置 | ✅ | PUT /api/admin/novel/{id}/visibility |
| Node CRUD | ✅ | NodeController + NodeService (list + batch save) |
| Event CRUD | ✅ | EventController + EventService (list + batch save) |
| LLM 解析 (ParseChain) | ✅ | LangChain4j 封装, 支持 OpenAI 协议兼容模型 |
| TXT上传导入 | ✅ | POST /api/admin/novel/import/upload — LLM解析TXT内容 |
| 名称导入 | ✅ | POST /api/admin/novel/import/name — LLM直接根据名称生成框架 |
| 解析记录 | ✅ | 写入 parse_record + llm_cache, 缓存7天 |
| 新增依赖 | ✅ | langchain4j-open-ai, commons-io, 文件上传配置 |

### 前端（已完成）
| 任务 | 状态 | 说明 |
|-----|------|------|
| Admin 作品列表页 | ✅ | 表格展示, 搜索, 分页, 新建, 删除 |
| Admin 导入页面 | ✅ | 名称导入 + TXT上传, LLM结果预览 |
| Admin 节点编辑器 | ✅ | 列表节点编辑 (标题/描述/起止点), 排序/增删 |
| Admin 事件管理 | ✅ | 事件表格, 新建/编辑弹窗, 批量保存 |
| 路由配置 | ✅ | /admin/novel/:id/import, /nodes, /events |
| 侧边栏导航 | ✅ | Admin 管理分组, 列表页操作按钮导航 |

### 待你完成
1. **执行 SQL**：`mysql -u root -p novel_simulator < sql/01-ddl.sql` 和 `sql/02-seed-data.sql`
2. **确认 MySQL + Redis 连接**：修改 `application.yml` 中的密码
3. **配置 LLM**：修改 `application.yml` 中的 `llm.api-key` 和 `llm.model-name`
4. **启动后端**：`mvn spring-boot:run`
5. **启动前端**：`cd frontend && npm run dev`

## RBAC 权限树重构完成情况

### 后端（已完成）
| 任务 | 说明 |
|------|------|
| permission 表树形化 | parent_id/type/route/status/sort_order/created_by/updated_at 字段 |
| 数据迁移 | 7个菜单节点 + 21个按钮权限，role_permission 映射 |
| PermissionService | buildTree 递归构建、getMenuTree 按用户权限过滤菜单 |
| PermissionController | /tree 返回全量权限树、CRUD 接口（含递归删除子节点） |
| AuthController /menus | 返回当前用户可见菜单树，侧边栏驱动 |
| AuthService | 管理员查询 status=1 的有效权限 |

### 前端（已完成）
| 任务 | 说明 |
|------|------|
| usePermission hook | hasPermission/hasAnyPermission/hasAllPermissions |
| Authorized 组件 | 声明式按钮级权限控制 |
| ProtectedRoute 组件 | 路由守卫支持 code 参数，403页面 |
| useMenuTree hook | 模块级缓存，仅首次请求菜单树 |
| PermissionTree 组件 | 树形勾选（全选/半选/父节点联动），支持搜索过滤 |
| SearchSelect 组件 | 可搜索的树形 Select（Command+Popover 实现） |
| 侧边栏动态渲染 | 从 /api/auth/menus 驱动，isActive 高亮，去重 |
| 路由守卫改造 | ProtectedRoute 替换内联 ProtectedAdmin |
| 权限管理页 | TanStack Table 树形表格、行点击展开、新建/编辑/删除弹窗、react-hook-form + zod 表单校验 |
| 角色管理页 | 权限分配弹窗改为 PermissionTree 树形勾选 |

### 设计文档
- 设计: `docs/superpowers/specs/2026-06-25-rbac-permission-tree-design.md`
- 实施计划: `docs/superpowers/plans/2026-06-25-rbac-permission-tree.md`

## P3 核心玩法完成情况

### P3-A Player 基础（已完成）
| 任务 | 说明 |
|------|------|
| PlayerController | novel/list, novel/full, node, session CRUD, action/choose, action/spin, story/stream |
| SessionService | 会话创建/获取/存档/读档/重新开始，角色属性创建 |
| useStory hook | 管理游戏状态、动作 dispatch |
| 作品选择页 | 卡片网格，按角色可见性过滤 |
| 角色创建页 | 名称输入 + 属性抽奖转盘 + 6种角色模板 + 词条系统 |
| 故事主界面 | 节点展示、故事阅读区、选项面板、角色属性面板 |
| 存档管理 | 存档列表 + 读档弹窗 |
| 结局弹窗 | 结局展示 + 完整故事回顾 + 再来一次/返回 |

### P3-B 核心玩法循环（已完成）
| 任务 | 说明 |
|------|------|
| ActionEngine | 选择导航节点 + 属性微增，转盘 LLM 事件 + 多维属性变化 |
| EventChain | 6扇区（奇遇/宝箱/战斗/诅咒/命运/邂逅），属性变化 + 事件描述 |
| StoryChain | 基于节点、角色属性、事件描述的上下文故事生成 |
| SSE 流式 | 逐段推送故事，支持 description 参数传递事件内容 |
| WheelOfFortune | 静态转盘 + 旋转指针，6扇区，点击中心抽奖 |
| ChoicePanel | 3-4个选项，按属性解锁，属性不足显示提示 |
| 选项过滤 | 智力/魅力不足的选项置灰 |
| 转盘概率触发 | 选择后按 randomRate 概率弹出转盘 |

### P3-C 待完成
- 死亡判定 + DeathModal
- LLM 深度参与（StoryChain/EventChain 调用真实 LLM）
- 移动端适配

### 设计文档
- 玩法机制: `docs/superpowers/gameplay/gameplay-mechanics-design.md`
- 玩法逻辑: `docs/superpowers/gameplay/gameplay-logic.md`
- LLM 深度参与: `docs/superpowers/gameplay/llm-deep-participation.md`
- P3-A 计划: `docs/superpowers/plans/2026-06-25-P3-A-player-basics.md`
- P3-B 计划: `docs/superpowers/plans/2026-06-25-P3-B-core-gameplay.md`

## 阶段完成记录

| 日期 | 阶段 | 完成内容 |
|------|------|---------|
| 2026-06-18 | P1 基础架构 | 全部代码编写完成（待数据库建表后联调） |
| 2026-06-24 | P2 内容管理 | Novel/Node/Event CRUD, LLM导入(TXT+名称), Admin前端页面完整 |
| 2026-06-25 | RBAC 权限树重构 | 树形权限表、动态侧边栏、权限组件、树形角色权限分配、TanStack Table、表单校验、可搜索 Select |
| 2026-06-25 | P3-A 基础 | 作品列表、会话管理、角色创建、故事主界面骨架 |
| 2026-06-25 | P3-B 核心循环 | ActionEngine、EventChain、StoryChain、SSE流式、转盘、选项过滤、存档、结局 |

## 快速导航

- [P1 基础架构](P1-基础架构.md)
- [P2 内容管理](P2-内容管理.md)
- [P3 核心玩法](P3-核心玩法.md)
- [P4 叙事与评分](P4-叙事与评分.md)
- [P5 管理完善与移动端](P5-管理完善与移动端.md)
- [RBAC 权限树设计](../specs/2026-06-25-rbac-permission-tree-design.md)
- [RBAC 权限树实施计划](../plans/2026-06-25-rbac-permission-tree.md)
- [玩法机制设计](../gameplay/gameplay-mechanics-design.md)
- [玩法逻辑流程](../gameplay/gameplay-logic.md)
- [LLM 深度参与方案](../gameplay/llm-deep-participation.md)
