# Novel Interactive Story Simulator — 设计文档

> 版本: v2.1
> 日期: 2026-06-18
> 状态: 已定稿

---

## 1. 项目概述

### 1.1 产品定位

一个基于小说/动漫/漫画世界观的互动叙事模拟器。用户选择一部作品，在网状节点结构中通过**选择**和**转盘抽奖**推进剧情，结合 LLM 动态生成故事分支与随机事件，最终获得完整的个性化故事结局。

### 1.2 核心玩法

1. 选择一部作品（小说/动漫/漫画）作为背景世界
2. 在网状节点图中从一个核心节点开始探索
3. 每个节点提供 2-4 个选项 + 转盘抽奖按钮
4. 用户选择或转盘 → 可能触发随机事件（含死亡率）
5. LLM 根据选择+事件实时生成故事段落（SSE 流式输出）
6. 用户到达结局节点或死亡 → 生成完整故事 + 属性评分

### 1.3 目标用户

- 小说/动漫爱好者，希望在自己喜欢的作品中体验自定义剧情
- 喜欢互动叙事、跑团、文字冒险游戏的用户

---

## 2. 技术栈

| 层级 | 技术 | 版本/说明 |
|------|------|----------|
| 前端框架 | React + Vite + TypeScript | SPA |
| UI 框架 | shadcn/ui + Tailwind CSS | 原子化组件，可定制主题，内置响应式 |
| 节点可视化 | React Flow | 网状节点图渲染（内置触摸事件支持） |
| 后端框架 | Spring Boot | 2.6.13 |
| ORM | MyBatisPlus | - |
| AI 框架 | LangChain4j | Java 版，LLM 调用封装 |
| 数据库 | MySQL | 持久化 |
| 缓存/会话 | Redis | 有状态会话/缓存/LLM 结果去重 |
| 密码加密 | BCrypt | Spring Security |
| LLM API | OpenAI 协议兼容 | 用户可配置（支持 ChatGPT/DeepSeek/通义千问 等） |

---

## 3. 系统架构

### 3.1 整体架构（双模式 + 认证）

```
┌─────────────────────────────────────────────────────────────────┐
│                      前端层 (React + Vite)                       │
│  ┌────────────┐ ┌──────────────────┐  ┌──────────────────────┐ │
│  │  Auth Pages│ │  Admin Panel      │  │  Player Panel         │ │
│  │  · 登录     │ │  · 世界观/节点管理  │  │  · 节点图探索          │ │
│  │  · 注册     │ │  · 事件池管理      │  │  · 选择/转盘交互       │ │
│  │            │ │  · Prompt 配置     │  │  · 故事流式阅读       │ │
│  │            │ │  · 作品可见性管理    │  │  · 角色属性面板       │ │
│  │            │ │  · 用户角色管理      │  │                     │ │
│  │            │ └──────────────────┘  │  · 存档管理            │ │
│  └────────────┘                       └──────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │
                    RESTful API (共用, 需登录)
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│                    后端层 (Spring Boot)                          │
│  ┌──────────┐ ┌─────────────┐ ┌──────────────┐ ┌───────────┐  │
│  │AuthFilter│ │ Controller   │ │ Service      │ │LangChain4j│  │
│  │(拦截所有  │ │ · AuthAPI   │ │ · 节点引擎    │ │4 Chain    │  │
│  │ 请求,    │ │ · NovelAPI  │ │ · 事件引擎    │ │           │  │
│  │ Redis验  │ │ · NodeAPI   │ │ · 叙事引擎    │ │           │  │
│  │ 证会话)  │ │ · StoryAPI  │ │ · 评分引擎    │ │           │  │
│  │         │ │ · AdminAPI  │ │ · 用户服务    │ │           │  │
│  └──────────┘ └─────────────┘ └──────────────┘ └───────────┘  │
│         │               │                      │               │
│  ┌──────┴───────────────┴──────────────────────┴──────────┐    │
│  │           MyBatisPlus + MySQL                           │    │
│  │  user │ user_role │ role │ permission         │    │
│  │  role_permission │ novel │ novel_role_visibility │ node          │    │
│  │  node_edge │ node_option │ random_event               │    │
│  │  user_session │ user_character │ parse_record         │    │
│  │  llm_cache                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                       │
│  ┌──────┴─────────────────────────────────────────────────┐     │
│  │   Redis                                                 │     │
│  │   · auth:sessions:{sessionId} → 用户登录会话 (24h TTL)    │     │
│  │   · cache:novel:{id}:tree → 节点树缓存                   │     │
│  │   · cache:session:{id}:settings → 用户设置               │     │
│  │   · cache:llm:{hash} → LLM 结果缓存                      │     │
│  │   · cache:events:{novelId}:{nodeId} → 事件池             │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 设计原则

- **前后端严格分离**：Admin 和 Player 共用同一套 RESTful API，后续转小程序只需替换 Player 前端
- **LLM 调用集中管理**：所有 AI 调用收口在 LangChain4j Service，便于切换模型和缓存
- **用户设置覆盖默认**：用户可配置 LLM 地址/Key/模型，运行时动态替换
- **缓存优先**：Redis 缓存 LLM 结果和节点树，减少重复调用
- **有状态会话认证**：所有 API 经 AuthFilter 拦截，Redis 验证会话，而非 JWT 无状态
- **移动端适配**：Player 前端采用 Mobile-First 设计，Admin 后台 PC 优先但基础可用

### 3.3 权限体系（RBAC0）

采用标准 RBAC0 模型：**用户 ↔ 角色 ↔ 权限**，同时**角色 ↔ 作品可见性**。

#### 关系总览

```
用户 ──┬──→ 角色 ──┬──→ 权限（能做什么操作）
       │          │
       │          └──→ 作品可见性（能看哪些作品）
       │
       ├── 用户可拥有多个角色（多对多）
       └── 游客（未登录）视为 GUEST 角色
```

#### 角色定义

| 角色编码 | 说明 | 预设 |
|---------|------|------|
| `ADMIN` | 系统管理员 | 系统预设 |
| `EDITOR` | 内容编辑（可管理作品/节点/事件，不可管理用户） | 系统预设 |
| `USER` | 普通注册用户 | 系统预设 |
| `GUEST` | 游客（未登录） | 系统预设，不可手动分配 |

> Admin 可在「角色管理」页面新增自定义角色，并分配权限。

#### 权限清单

| 权限编码 | 说明 | 资源 | 操作 |
|---------|------|------|------|
| `novel:create` | 新建作品 | novel | create |
| `novel:read` | 读取作品列表/详情 | novel | read |
| `novel:update` | 修改作品 | novel | update |
| `novel:delete` | 删除作品 | novel | delete |
| `novel:set_visibility` | 设置作品可见角色 | novel | manage |
| `node:read` | 查看节点 | node | read |
| `node:create` | 新建节点 | node | create |
| `node:update` | 编辑节点 | node | update |
| `node:delete` | 删除节点 | node | delete |
| `event:read` | 查看事件 | event | read |
| `event:create` | 新建事件 | event | create |
| `event:update` | 编辑事件 | event | update |
| `event:delete` | 删除事件 | event | delete |
| `user:read` | 查看用户列表 | user | read |
| `user:update_role` | 修改用户角色 | user | update |
| `user:disable` | 启用/禁用用户 | user | manage |
| `role:read` | 查看角色列表 | role | read |
| `role:manage` | 新建/编辑角色及权限分配 | role | manage |
| `player:play` | 游玩作品（进入冒险） | player | read |
| `player:save` | 存档读档 | player | create |
| `player:spin` | 转盘抽奖 | player | create |

#### 初始角色权限分配

| 角色 | 拥有的权限 |
|------|-----------|
| **ADMIN** | 全部权限 |
| **EDITOR** | `novel:read`, `novel:update`, `node:*`, `event:*`, `role:read` |
| **USER** | `novel:read`, `node:read`, `event:read`, `player:play`, `player:save`, `player:spin` |
| **GUEST** | `novel:read`, `node:read`, `event:read`, `player:play`, `player:save`, `player:spin` |

#### 作品可见性（角色级）

作品通过 `novel_role_visibility` 表关联角色，决定哪些角色能看到该作品：

```
作品A → [GUEST, USER, ADMIN]  → 所有人可见
作品B → [USER, ADMIN]          → 仅登录用户可见
作品C → [ADMIN]                → 仅管理员可见
作品D → [EDITOR, ADMIN]        → 编辑和管理员可见
```

Admin 配置时可直接勾选角色，也可使用快捷设置：
- **公开** → 勾选 GUEST + USER + EDITOR + ADMIN
- **仅登录用户** → 勾选 USER + EDITOR + ADMIN
- **仅管理员** → 勾选 ADMIN

#### 登录流程

```
未登录用户访问 /player
      │
      ▼
┌────────────────────────────────────┐
│  首页: 仅展示 GUEST 角色可见作品     │
│  右上角: [登录 / 注册]              │
│                                    │
│  作品可点击"试玩"                    │
│  → 以 GUEST 角色进入               │
│  → 提示"登录后可永久保存进度"         │
└────────────────────────────────────┘

登录流程:
用户输入 用户名 + 密码
      │
      ▼
  后端验证用户名密码 (BCrypt)
      │
      ▼
  查询 user_role → 查出用户的角色列表
  查询 role_permission → 查出角色的权限列表
      │
      ▼
  生成 sessionId (UUID)
  → 存储 Redis: auth:sessions:{sessionId}
     Value: { userId, username, roles: ["ADMIN","USER"], permissions: [...] }
  → 返回 sessionId 给前端
  → 前端存入 cookie / localStorage
      │
      ▼
  后续请求: 在 Authorization header 携带 sessionId
  → AuthFilter 从 Redis 查询会话，设置 SecurityContext
  → 有效则放行，无效返回 401
      │
      ▼
  退出登录: 删除 Redis 会话
```

#### Redis 会话存储

```
Key:   auth:sessions:{sessionId}
Value: {
  "userId": 1,
  "username": "admin",
  "nickname": "管理员",
  "roles": ["ADMIN", "EDITOR"],
  "permissions": ["novel:*", "node:*", "event:*", "user:*", ...]
}
TTL:  24 小时（每次请求自动续期）
```

> 注意：Redis 中缓存的 roles 和 permissions 在 Admin 修改用户角色后需失效重建，确保权限即时生效。

#### 授权机制（双层鉴权）

```
第一层: AuthFilter 做身份认证 (Authentication)
┌─────────────────────────────────────────────┐
│  1. 从请求头取 sessionId                      │
│  2. 查 Redis: auth:sessions:{sessionId}       │
│  3. 存在 → 续期 TTL, 设置 SecurityContext     │
│  4. 不存在 → 返回 401 (未登录)                │
│  5. 白名单: /api/auth/login, /api/auth/register │
└─────────────────────────────────────────────┘
                          │
                          ▼
第二层: @PreAuthorize("hasAuthority('xxx')") + Service 做授权
┌─────────────────────────────────────────────┐
│  Controller 层:                               │
│  @PreAuthorize("hasAuthority('novel:create')")│
│  @PreAuthorize("hasAuthority('user:read')")   │
│  → 权限不足直接返回 403                        │
│                                              │
│  Service 层:                                  │
│  → novelService.listByRoles(userRoles)        │
│    通过 novel_role_visibility 找出可见作品     │
│  → sessionService.validateAccess(user,novel)  │
│    校验用户是否有权玩该作品                    │
└─────────────────────────────────────────────┘
```

**各层职责：**

| 接口范围 | Controller 层（@PreAuthorize） | Service 层 |
|---------|------------------------------|-----------|
| `/api/admin/novel/**` | `hasAuthority('novel:create/update/delete')` | 无额外校验 |
| `/api/admin/user/**` | `hasAuthority('user:read/update_role/disable')` | 无额外校验 |
| `/api/admin/role/**` | `hasAuthority('role:manage')` | 无额外校验 |
| `/api/player/novel/list` | 放行（或 `hasAuthority('novel:read')`） | 按角色列表过滤可见作品 |
| `/api/player/**` | `hasAuthority('player:play')` | 按 `novel_role_visibility` 过滤可见作品 |
| `/api/auth/**` | 放行（白名单） | 无需校验 |

---

## 4. 数据模型

### 4.1 表结构

#### user（用户表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| username | VARCHAR(50) UNIQUE | 用户名 |
| password | VARCHAR(255) | BCrypt 加密密码 |
| nickname | VARCHAR(100) | 昵称 |
| is_enabled | BOOLEAN DEFAULT TRUE | 是否启用 |
| created_at | DATETIME | - |
| updated_at | DATETIME | - |

#### role（角色表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| code | VARCHAR(50) UNIQUE | 角色编码（ADMIN/USER/GUEST/EDITOR） |
| name | VARCHAR(100) | 角色名称（管理员/用户/游客/编辑） |
| description | VARCHAR(255) | 角色描述 |
| is_system | BOOLEAN DEFAULT FALSE | 是否系统预设（不可删除） |
| created_at | DATETIME | - |

#### permission（权限表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| code | VARCHAR(100) UNIQUE | 权限编码（如 `novel:create`） |
| name | VARCHAR(100) | 权限名称 |
| resource | VARCHAR(50) | 所属资源（novel/user/node/event/player/role） |
| action | VARCHAR(50) | 操作（create/read/update/delete/manage） |
| created_at | DATETIME | - |

#### user_role（用户-角色关联表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| user_id | BIGINT FK | 用户 |
| role_id | BIGINT FK | 角色 |
| UNIQUE KEY (user_id, role_id) | | 一个用户对同一角色只能关联一次 |

#### role_permission（角色-权限关联表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| role_id | BIGINT FK | 角色 |
| permission_id | BIGINT FK | 权限 |
| UNIQUE KEY (role_id, permission_id) | | 一个角色对同一权限只能关联一次 |

#### novel（小说表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| title | VARCHAR(100) | 小说/作品名称 |
| author | VARCHAR(100) | 原作者 |
| world_view | TEXT | 世界观设定（结构化文本） |
| content_type | TINYINT | 0=小说 1=动漫 2=漫画 |
| source_type | TINYINT | 0=TXT上传 1=联网搜索 |
| raw_content | LONGTEXT | 原始小说文本（仅小说TXT导入时） |
| cover_url | VARCHAR(500) | 封面图 |
| status | TINYINT | 0=草稿 1=已发布 |
| parse_status | TINYINT | 0=未解析 1=解析中 2=已完成 |
| parsed_at | DATETIME | 最近解析时间 |
| created_by | BIGINT FK | 创建者（关联 user.id） |
| created_at | DATETIME | - |
| updated_at | DATETIME | - |

#### novel_role_visibility（作品-角色可见性表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| novel_id | BIGINT FK | 作品 |
| role_id | BIGINT FK | 角色（该角色对此作品可见） |
| UNIQUE KEY (novel_id, role_id) | | 一个作品对同一角色只存一次 |

#### node（核心节点表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| novel_id | BIGINT FK | 所属小说 |
| title | VARCHAR(200) | 节点名称 |
| description | TEXT | 节点描述/场景介绍 |
| node_type | TINYINT | 0=核心节点（人工/LLM解析） 1=LLM动态生成 |
| is_start | BOOLEAN | 是否为起始节点 |
| is_end | BOOLEAN | 是否为结局节点 |
| min_intelligence | INT | 最小智力要求（解锁条件，0=不限制） |
| min_charm | INT | 最小魅力要求（解锁条件，0=不限制） |
| required_title | VARCHAR(100) | 需要称号解锁（NULL=不限制） |
| sort_order | INT | 排序 |
| created_at | DATETIME | - |

#### node_edge（节点连接表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| novel_id | BIGINT FK | 所属小说 |
| source_node_id | BIGINT FK | 来源节点 |
| target_node_id | BIGINT FK | 目标节点 |
| condition_desc | VARCHAR(500) | 解锁条件描述 |
| edge_type | TINYINT | 0=固定 1=条件解锁 2=随机解锁 |

#### node_option（节点选项表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| node_id | BIGINT FK | 所属节点 |
| label | VARCHAR(200) | 选项文字 |
| target_node_id | BIGINT | 指向节点（NULL=LLM动态生成） |
| trigger_event | BOOLEAN | 选择后是否触发随机事件 |
| risk_hint | VARCHAR(200) | 风险提示（如"危险！"） |
| created_at | DATETIME | - |

#### random_event（随机事件表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| novel_id | BIGINT FK | 所属小说 |
| node_id | BIGINT | NULL=全局事件, 非NULL=节点专属 |
| title | VARCHAR(200) | 事件标题 |
| content | TEXT | 事件描述 |
| event_type | TINYINT | 0=正面 1=负面 2=中立 |
| death_probability | INT | 该事件的额外死亡率（0-100） |
| attr_changes | TEXT | 属性变化 JSON（如 {"hp": -30, "attack": +5}） |
| is_llm_gen | BOOLEAN | 是否LLM生成 |
| weight | INT | 权重（影响随机抽取概率，默认10） |
| created_at | DATETIME | - |

#### user_session（用户存档表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| session_id | VARCHAR(64) UNIQUE | 游戏会话标识（非登录会话） |
| **user_id** | **BIGINT FK** | **所属用户（NULL=游客）** |
| novel_id | BIGINT FK | 所选小说 |
| current_node_id | BIGINT | 当前所在节点 |
| history_path | TEXT | 走过的节点路径 JSON 数组 |
| story_text | LONGTEXT | 已生成的故事全文 |
| story_summary | TEXT | 故事摘要（用于控制上下文长度） |
| settings_json | TEXT | 用户设置（随机率/死亡率/LLM配置等） |
| node_state_json | TEXT | 节点状态（已访问/未访问/锁定/已解锁等） |
| last_save_at | DATETIME | 最近手动存档时间 |
| is_active | BOOLEAN | 是否活跃 |
| created_at | DATETIME | - |
| updated_at | DATETIME | - |

> 游客同样创建 session 记录，但 `user_id = NULL`，退出登录后存档不可恢复

#### user_character（角色属性表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| session_id | VARCHAR(64) FK UNIQUE | 关联游戏会话 |
| hp | INT DEFAULT 100 | 生命值 |
| attack | INT DEFAULT 10 | 攻击力 |
| defense | INT DEFAULT 10 | 防御力 |
| intelligence | INT DEFAULT 50 | 智力 |
| charm | INT DEFAULT 50 | 魅力 |
| luck | INT DEFAULT 50 | 运气 |
| current_title | VARCHAR(100) | 当前称号 |
| titles_json | TEXT | 已获得称号列表 JSON |
| choices_made | INT DEFAULT 0 | 做出选择次数 |
| events_triggered | INT DEFAULT 0 | 触发事件次数 |
| times_died | INT DEFAULT 0 | 死亡次数 |
| final_score | INT | 最终分数（0-1000） |
| final_rank | VARCHAR(10) | 评级: SSS/S/A/B/C/D |
| rank_reason | TEXT | 评级理由（LLM生成） |
| updated_at | DATETIME | - |

#### parse_record（LLM解析记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| novel_id | BIGINT FK | 所属作品 |
| prompt_type | VARCHAR(50) | full_parse / reparse_nodes 等 |
| input_summary | VARCHAR(500) | 输入摘要 |
| raw_response | LONGTEXT | LLM 原始返回 |
| result_json | LONGTEXT | 解析后的结构化数据 |
| tokens_used | INT | 消耗 tokens |
| status | TINYINT | 0=成功 1=失败 |
| created_at | DATETIME | - |

#### llm_cache（LLM 生成缓存）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 主键 |
| cache_key | VARCHAR(128) UNIQUE | 输入摘要哈希 |
| prompt_type | VARCHAR(50) | story / branch / event / parse |
| result_text | LONGTEXT | 生成结果 |
| created_at | DATETIME | - |
| expired_at | DATETIME | 过期时间 |

### 4.2 Redis 缓存设计

| Key 模式 | 说明 | TTL |
|----------|------|-----|
| `auth:sessions:{sessionId}` | 用户登录会话（含角色和权限列表） | 24h（每次请求续期） |
| `auth:user:{userId}` | 用户基本信息缓存 | 1h |
| `auth:permissions:{roleId}` | 角色权限列表缓存 | 1h |
| `cache:novel:{id}:tree` | 完整节点树 | 1h |
| `cache:session:{id}:settings` | 用户设置 | 24h |
| `cache:session:{id}:character` | 角色属性 | 24h |
| `cache:events:{novelId}:{nodeId}` | 节点事件池 | 30min |
| `cache:llm:{hash}` | LLM 生成结果 | 7d |

---

## 5. 导入模块设计

### 5.1 作品导入流程

```
用户进入 Admin → 新建 → 选择类型（小说/动漫/漫画）
                                            │
         ┌──────────────────────────────────┘
         │
    [小说] │                                  [动漫/漫画]
         ▼                                      │
  ┌──────────────┐                              ▼
  │ 选择导入方式   │                     ┌──────────────┐
  │ ● 上传 TXT   │                     │ 仅支持联网搜索 │
  │ ○ 联网搜索   │                     │ 输入作品名称   │
  └──────┬───────┘                     └──────┬───────┘
         │                                    │
         ▼                                    ▼
  ┌────────────────┐                 ┌─────────────────┐
  │ TXT: 文件上传   │                 │ LLM 联网搜索     │
  │ LLM 解析全文    │                 │ ─────────────── │
  └──────┬─────────┘                 │ 搜到足够信息?     │
         │                           ├── 是 → 生成 JSON │
         ▼                           └── 否 → 提示不存在 │
  ┌────────────────┐
  │ 联网搜索:       │
  │ 搜索作品信息    │
  │ 搜到足够信息?   │
  ├── 是 → 生成 JSON│
  └── 否 → 提示不存在│
         │
         ▼
  ┌────────────────┐
  │ 预览解析结果    │
  │ · 世界观       │
  │ · 节点列表     │
  │ · 关系图       │
  │ · 事件池       │
  │ · 属性模板     │
  │                │
  │ [确认导入]      │
  │ [配置可见角色]    │ ← Admin 勾选角色（GUEST/USER/EDITOR/ADMIN）
  └────────────────┘
```

### 5.2 不存在处理

所有内容类型（小说/动漫/漫画）在联网搜索时，如果 LLM 搜索后判断信息不足以构建框架，统一返回：

> ❌ 未找到「作品名称」的足够信息，无法生成故事框架。
> 建议：检查作品名称拼写，或换成更常见的名称。小说可以尝试上传 TXT 文件导入。

### 5.3 Admin 管理功能

**作品可见性管理（novel_role_visibility）：**
- 列表展示所有作品，为每个作品配置可见角色（多选）
- 从 `role` 表中选择角色（GUEST/USER/EDITOR/ADMIN 等）
- 快捷设置：公开 / 仅登录用户 / 仅管理员
- 未勾选任何角色的作品默认仅 ADMIN 可见

**用户角色管理（user_role）：**
- 列表展示所有注册用户
- 为用户分配角色（多选，用户可拥有多个角色）
- 启用/禁用用户账号（禁用后该用户无法登录）

**角色管理（role）：**
- 列表展示所有角色（系统预设不可删除）
- 新建自定义角色
- 为角色分配权限（勾选 permission 表）
- 系统预设角色：ADMIN、EDITOR、USER、GUEST

---

## 6. LangChain4j Chain 设计

### 6.1 ParseChain（作品解析）

- **触发时机**：Admin 导入作品时
- **输入**：小说 TXT 内容 / 联网搜索到的作品信息
- **输出**：结构化 JSON（世界观/节点/关系/事件/属性模板）
- **作用**：将非结构化内容解析为数据库可存的框架数据

### 6.2 StoryChain（故事生成）

- **触发时机**：用户每次做出选择或触发事件后
- **输入**：世界观 + 当前节点 + 角色属性 + 事件描述（可选）+ 历史选择数
- **输出**：故事文本（100-200字），SSE 流式推送
- **运作方式**：
  - **LLM 模式**（API Key 已配置）：调用 LLM，prompt 包含世界观、当前场景、角色属性
    - 属性值影响叙述方向（HP 低→描述伤势，智力高→描述洞察）
    - 事件描述融入故事（如有）
  - **Stub 模式**（API Key 未配置）：基于节点描述和属性状态生成固定模板文本
- **结局生成**：`generateEnding()` — 到达结局节点时生成完整冒险回顾

### 6.3 EventChain（随机事件生成）

- **触发时机**：玩家点击转盘抽奖时
- **输入**：世界观 + 当前节点 + 角色属性 + 扇区类型
- **输出**：事件 JSON（title, content, 6维属性变化）
- **运作方式**：
  - **LLM 模式**：调用 LLM，返回 JSON 格式的事件内容和属性变化数值
    - 属性变化由 LLM 根据当前角色状态和扇区类型动态决定
    - 正面扇区属性变化为正，负面为负
    - HP 变化范围 -30 到 +30，其他属性 -5 到 +5
  - **Stub 模式**：6扇区硬编码属性变化 + 通用事件文本
- **6 扇区**：✨奇遇 💎宝箱 ⚔️战斗 💀诅咒 🌀命运 💕邂逅

### 6.4 BranchChain（分支节点生成）

- **触发时机**：用户走向未定义目标节点（target_node_id = NULL）
- **输入**：世界观 + 当前节点 + 用户历史 + 角色属性
- **输出**：新节点 + 选项 + 关联事件
- **作用**：动态扩展故事世界，补充核心骨架之外的分支

### 6.5 设计原则

- **LLM 负责**：故事内容、事件描述、属性变化数值
- **代码负责**：调用 LLM、解析结果、应用变化、降级策略
- **降级策略**：API Key 未配置时自动回退到 stub 实现，系统不报错
- **核心节点定义框架**，LLM 填充血肉内容

---

## 7. 玩家交互流程

### 7.1 主循环

```
开始冒险
  │
  ▼
创建角色 → 输入名称 → 属性抽奖转盘 → 确认
  │
  ▼
┌──────────────────────────────────────────────────┐
│  节点探索循环                                      │
│                                                  │
│  ① 显示当前节点描述 + 展示3-4个选项                │
│  ② 玩家选择                                       │
│  ③ 按概率触发转盘？                                │
│     ├─ 是 → 转盘弹窗 → 抽奖 → EventChain(LMM)     │
│     │         生成事件+属性变化                     │
│     └─ 否 → 跳过                                  │
│  ④ SSE 流式：StoryChain(LLM) 生成故事段落          │
│  ⑤ 更新角色属性                                   │
│  ⑥ 到达结局节点？                                  │
│     ├─ 是 → StoryChain 生成结局总结                │
│     │      → 弹出结局弹窗（完整故事+属性回顾）      │
│     └─ 否 → 回到①                                 │
└──────────────────────────────────────────────────┘
```

- **StoryChain**：LLM（或 stub）根据世界观+节点+角色属性生成连贯故事
- **EventChain**：LLM（或 stub）根据扇区+角色状态生成事件及属性变化
- **属性过滤**：智力/魅力不足的选项置灰不可选
- **每次选择**：微增属性（随机 1-2 点）

### 7.2 随机事件 / 死亡率规则

- 事件类型分布：正面 40%、负面 60%（默认）
- 负面事件中死亡率：默认 30%，用户可配置（0-100%）
- 死亡率影响角色属性变化和故事走向
- 随机率和死亡率在冒险开始后锁定
- 角色死亡时游戏结束，进入结局页面（按已完成的进度评分）

### 7.3 用户设置

- 创建存档时进入设置页配置：
  - 随机事件概率（滑块 0-100%）
  - 死亡率（滑块 0-100%）
  - LLM 配置（API 地址 / Key / 模型名称）
- 点击「开始冒险」后锁定所有设置
- 设置存储于 Redis（游戏会话级别）

### 7.4 游客 vs 登录用户差异

| 功能 | 游客 (未登录) | 已登录用户 |
|------|-------------|-----------|
| 可玩作品 | 仅 GUEST 角色可见作品 | 用户拥有的角色（如 USER/EDITOR）可见作品 |
| 转盘抽奖 | ✅ | ✅ |
| 存档/读档 | ✅（但退出后不可恢复） | ✅（永久保存） |
| 角色属性保存 | ✅（当次有效，刷新丢失） | ✅（永久保存） |
| 个人中心 | ❌ | ✅ 查看历史评分/存档 |

---

## 8. API 接口设计

### 8.1 Auth API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | 无需登录 |
| POST | `/api/auth/login` | 用户登录（返回 sessionId） | 无需登录 |
| POST | `/api/auth/logout` | 退出登录（清除 Redis 会话） | 需登录 |
| GET | `/api/auth/me` | 获取当前登录用户信息 | 需登录 |

### 8.2 Player API

Player API 的全部接口通过 AuthFilter 身份认证后即可访问（需登录或携带 GUEST 会话）。角色/权限的差异体现在：

- **Service 层**：按 `novel_role_visibility` 过滤可见作品
- **数据持久化**：GUEST 会话 `user_id = NULL`，退出后不可恢复
- **权限编码** `player:*` 主要用于前端功能开关（如显示/隐藏功能按钮）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/player/novel/list` | 作品列表（按角色返回可见作品） | `player:play` |
| POST | `/api/player/session/create` | 创建游戏存档 | `player:play` |
| GET | `/api/player/session/{id}` | 获取存档状态 | `player:play` |
| GET | `/api/player/novel/{novelId}/full` | 获取完整节点树 | `player:play` |
| GET | `/api/player/node/{nodeId}` | 获取节点详情+选项 | `player:play` |
| POST | `/api/player/action/choose` | 做出选择 | `player:play` |
| POST | `/api/player/action/spin` | 转盘抽奖 | `player:play` |
| GET | `/api/player/story/stream/{sessionId}` | SSE流式获取故事 | `player:play` |
| POST | `/api/player/session/settings` | 保存用户设置 | `player:play` |
| POST | `/api/player/session/save` | 手动存档 | `player:play` |
| POST | `/api/player/session/load` | 读档 | `player:play` |
| GET | `/api/player/session/{id}/saves` | 存档列表 | `player:play` |
| POST | `/api/player/session/restart` | 重新开始 | `player:play` |

### 8.3 Admin API

Admin API 全部通过 `@PreAuthorize` 校验具体权限，而非简单角色校验。

| 方法 | 路径 | 说明 | 所需权限 |
|------|------|------|---------|
| POST | `/api/admin/novel` | 新建作品 | `novel:create` |
| GET | `/api/admin/novel/list` | 全部作品列表 | `novel:read` |
| PUT | `/api/admin/novel/{id}` | 修改作品 | `novel:update` |
| DELETE | `/api/admin/novel/{id}` | 删除作品 | `novel:delete` |
| PUT | `/api/admin/novel/{id}/visibility` | 设置可见角色 | `novel:set_visibility` |
| POST | `/api/admin/novel/import/upload` | TXT上传导入 | `novel:create` |
| POST | `/api/admin/novel/import/search` | 联网搜索导入 | `novel:create` |
| POST | `/api/admin/novel/import/check` | 检查作品是否存在 | `novel:create` |
| POST | `/api/admin/novel/parse` | LLM 解析作品 | `novel:create` |
| PUT | `/api/admin/novel/{id}/nodes` | 批量更新节点 | `node:update` |
| PUT | `/api/admin/novel/{id}/events` | 批量更新事件 | `event:update` |
| GET | `/api/admin/user/list` | 用户列表 | `user:read` |
| PUT | `/api/admin/user/{id}/roles` | 分配用户角色 | `user:update_role` |
| PUT | `/api/admin/user/{id}/status` | 启用/禁用用户 | `user:disable` |
| GET | `/api/admin/role/list` | 角色列表 | `role:read` |
| POST | `/api/admin/role` | 新建角色 | `role:manage` |
| PUT | `/api/admin/role/{id}/permissions` | 分配角色权限 | `role:manage` |

### 8.4 认证方式

```
请求头: Authorization: Bearer {sessionId}

第一层 — AuthFilter (身份认证):
  ① 从请求头提取 sessionId
  ② 查询 Redis: GET auth:sessions:{sessionId}
  ③ 若存在 → 续期 TTL, 放行, 设置 SecurityContext
     (SecurityContext 中包含用户 roles 和 permissions)
  ④ 若不存在 → 返回 401
  ⑤ 白名单路径: /api/auth/login, /api/auth/register 不拦截

第二层 — @PreAuthorize + Service (权限授权):
  Admin Controller 层:
    @PreAuthorize("hasAuthority('novel:create')")
    @PreAuthorize("hasAuthority('user:read')")
    → 检查 SecurityContext 中的 permissions 列表
    → 不包含该权限则返回 403

  Player Controller 层:
    @PreAuthorize("hasAuthority('player:play')")
    → 所有玩家功能由此统一入口控制
    → `player:save` / `player:spin` 等细粒度权限用于前端功能开关

  Player Service 层:
    → novelService.listByRoles(userRoles)
       通过 novel_role_visibility 查出当前角色可见作品
    → sessionService.validateAccess(user, novelId)
       校验角色是否有权游玩该作品
    → GUEST 会话 user_id = NULL，退出后不可恢复
```

---

## 9. 前端组件结构

```
src/
├── auth/
│   ├── pages/
│   │   ├── LoginPage.tsx              # 登录页面
│   │   └── RegisterPage.tsx           # 注册页面
│   ├── components/
│   │   └── AuthGuard.tsx              # 路由守卫组件
│   └── hooks/
│       └── useAuth.ts                 # 认证状态管理 (session)
│
├── admin/
│   ├── pages/
│   │   ├── NovelList.tsx              # 作品列表（CRUD + 可见角色配置）
│   │   ├── NovelImport.tsx            # 导入/解析（TXT上传/联网搜索）
│   │   ├── NodeEditor.tsx             # 节点编辑器（React Flow 拖拽）
│   │   ├── EventPool.tsx              # 随机事件池管理
│   │   ├── UserManage.tsx             # 用户管理（分配角色/启用禁用）
│   │   ├── RoleManage.tsx             # 角色管理（新建角色/分配权限）
│   │   └── PromptConfig.tsx           # LLM Prompt 模板配置
│   └── components/
│       └── NodeGraph.tsx              # 节点关系图编辑器
│
├── player/
│   ├── pages/
│   │   ├── NovelSelect.tsx            # 作品列表（按角色过滤）
│   │   ├── SettingsPage.tsx           # 冒险前设置（随机率/死亡率/LLM）
│   │   ├── StoryPlay.tsx              # 主游戏页面
│   │   └── StoryEnding.tsx            # 结局页面（评分+全书）
│   ├── components/
│   │   ├── NodeMap.tsx                # 节点地图（React Flow 简化版，移动端触摸适配）
│   │   ├── NodeCard.tsx               # 节点卡片展示
│   │   ├── ChoicePanel.tsx            # 选项面板
│   │   ├── WheelOfFortune.tsx         # 转盘抽奖组件
│   │   ├── StoryViewer.tsx            # 故事阅读区（MD流式渲染）
│   │   ├── CharacterPanel.tsx         # 角色属性面板（侧边栏）
│   │   ├── SettingsDrawer.tsx         # 设置抽屉（冒险前）
│   │   ├── GuestBanner.tsx            # 游客提示（登录后可永久保存）
│   │   └── DeathModal.tsx             # 死亡弹窗
│   │   └── UserCenter.tsx             # 个人中心（历史评分/存档管理）
│   └── hooks/
│       ├── useSSE.ts                  # SSE 流式接收
│       ├── useAuth.ts                 # 认证状态
│       └── useStory.ts                # 故事状态管理
│
├── common/
│   ├── components/
│   │   ├── MarkdownRenderer.tsx       # MD 渲染（react-markdown）
│   │   ├── LoadingSpinner.tsx         # 加载动画
│   │   ├── Navbar.tsx                 # 导航栏（含登录状态/用户菜单）
│   │   └── ProtectedRoute.tsx         # 角色权限路由封装
│   ├── api/
│   │   └── client.ts                  # API 封装（自动携带 sessionId）
│   └── types/
│       └── index.ts                   # TypeScript 类型定义
│
└── App.tsx                            # 路由
```

### 路由设计

```
/                       → 重定向到 /player（或登录页）
/login                  → 登录
/register               → 注册

/player                 → 作品列表（按角色过滤可见作品）
/player/:novelId        → 故事主界面
/player/ending/:sessionId → 结局页面
/player/center          → 个人中心（需登录）

/admin                  → 作品管理（需 ADMIN）
/admin/novel/:id/import  → 导入/解析
/admin/novel/:id/nodes   → 节点编辑
/admin/novel/:id/events  → 事件管理
/admin/users             → 用户管理（分配角色）
/admin/roles             → 角色管理（权限分配）
/admin/settings          → Prompt 配置
```

### 路由守卫逻辑

```
<Route path="/admin/*" element={
  <ProtectedRoute permissions={["novel:read", "user:read", "role:read"]}>
    <AdminLayout />
  </ProtectedRoute>
} />

<Route path="/player" element={
  <PlayerLayout />
} />

<Route path="/player/center" element={
  <ProtectedRoute permissions={["player:save"]}>
    <UserCenter />
  </ProtectedRoute>
} />
```

### 游客体验关键交互

```
① 未登录访问 /player
   显示 GUEST 角色可见的作品列表 + 登录/注册按钮
   作品右下角: "游客可玩"

② 点击作品 → 进入设置页
   短暂提示: "当前为游客模式，登录后可永久保存进度"
   所有功能正常可用（转盘/存档等）
   点开始冒险 → 进入游戏

③ 游戏过程中
   底部悬浮栏: "登录后可永久保存本次进度 → [去登录]"

④ 游戏结束
   正常展示评分+全书
   存档按钮提示: "登录后可永久保存本次记录"
```

---

## 10. 结局评分系统

### 10.1 评分公式

```
最终分数 = 基础分(200)
         + 存活节点数 × 10
         + 获得称号数 × 50
         + 触发事件数 × 15
         - 死亡次数 × 80
         + LLM 评价分 (0-200)
         + 故事完整度 (0-100)
```

### 10.2 评级

| 评级 | 分数范围 |
|------|---------|
| SSS | ≥ 950 |
| S | ≥ 800 |
| A | ≥ 650 |
| B | ≥ 500 |
| C | ≥ 300 |
| D | < 300 |

### 10.3 结局页面内容

- 角色信息卡（称号 / 六维属性）
- 评分结果（评级 + 分数 + 数据统计）
- LLM 评价（对玩家整体表现的文字点评）
- 完整故事全文（Markdown 渲染）
- 操作按钮（再来一次 / 导出故事 / 返回作品选择）

---

## 11. 故事长度管理与 Token 预算

- 全程保留完整故事文本，最终呈现给用户
- LLM 生成上下文：使用**故事摘要 + 最近 3 次交互 + 角色属性 + 世界观**作为上下文
  - 每次新生成前，将已有故事压缩为 300 字以内的摘要（由 LLM 在上次生成时附带输出）
- 故事摘要存储于 `user_session.story_summary`
- LLM 生成结果缓存于 Redis，相同输入不重复调用

---

## 12. 前端状态覆盖规范

每个组件需覆盖以下状态：

| 状态 | 表现 |
|------|------|
| loading | Skeleton / Spinner |
| empty | 占位提示（如"暂无节点"） |
| error | 错误提示 + 重试按钮 |
| success | 正常展示内容 |
| disabled | 置灰+提示（如冒险开始后设置禁用） |
| unauthorized | 提示登录/无权限 |

---

## 13. 交互/UI流程

### 13.1 导入作品（Admin）

```
新建作品 → 选择类型(小说/动漫/漫画)
  ├─ 小说: 选择导入方式
  │   ├─ TXT上传 → 选择文件 → 上传 → LLM解析 → 预览 → 确认
  │   └─ 联网搜索 → 输入名称 → LLM搜索+解析 → 预览 → 确认
  ├─ 动漫: 输入名称 → LLM搜索 → 存在?→生成 / 不存在→提示
  └─ 漫画: 输入名称 → LLM搜索 → 存在?→生成 / 不存在→提示
确认时可选: [配置可见角色]  ← 勾选 GUEST/USER/EDITOR/ADMIN 等
```

### 13.2 冒险流程（Player）

```
┌─ 未登录 (GUEST 角色) ────────────────┐
│  首页 (仅 GUEST 可见作品)              │
│  → 试玩（功能全开放）                  │
│  → 登录 → 根据角色可见更多作品         │
└──────────────────────────────────────┘

选择作品 → 配置设置(随机率/死亡率/LLM) → 开始冒险
  → 起始节点 (节点描述 + 选项 + 转盘)
  → 选择或转盘
  → (可能触发随机事件)
  → SSE 流式生成故事段落
  → 更新角色属性
  → (重复) 或到达结局 / 死亡
  → 结局页面 (评分 + 全书 + 属性)
```

### 13.3 用户设置

```
时间点: 选择作品后，开始冒险前
内容: 随机事件概率(滑块) / 死亡率(滑块) / LLM配置(API地址+Key+模型)
锁定: 点"开始冒险"后不可修改
```

---

## 14. 移动端适配

### 14.1 总体策略

Player 端采用 **Mobile-First 响应式设计**，Tailwind CSS 的 `sm`/`md`/`lg` 断点适配：

| 断点 | 目标设备 | 布局策略 |
|------|---------|---------|
| < 640px | 手机竖屏 | 单列布局，全屏沉浸 |
| 640-1024px | 手机横屏/平板 | 自适应双列，转盘放大 |
| > 1024px | PC/大屏 | 完整双面板（地图+故事） |

### 14.2 核心页面适配

**作品选择页：**
- 手机：卡片网格 1 列
- 平板：2 列
- PC：3-4 列

**故事主界面（核心挑战）：**
```
手机 (<640px):
┌────────────────────┐
│  节点图 (顶栏可收起) │
├────────────────────┤
│  故事阅读区 (主区域) │
│  流式 MD 渲染       │
├────────────────────┤
│  选项/转盘 (底栏)    │
└────────────────────┘
      ↓ 横屏/平板
┌──────────┬─────────┐
│ 节点图    │ 故事区  │
│ (左侧缩略)│         │
│          │ 选项+转盘│
└──────────┴─────────┘
```

| 组件 | 移动端处理 |
|------|-----------|
| 节点图 (NodeMap) | React Flow 支持触摸事件；手机默认收起，摇杆式拖动；点击节点展开详情 |
| 转盘 (WheelOfFortune) | 触摸旋转兼容；全屏弹窗模式（手机），侧栏模式（PC） |
| 故事阅读 (StoryViewer) | 全宽沉浸式阅读；字体大小自适应；滑动翻页手势 |
| 设置抽屉 (SettingsDrawer) | 底部弹出 Drawer（手机），侧边 Drawer（PC） |
| 结局页面 | 评分 + 全书 + 属性，卡片垂直堆叠 |

### 14.3 管理后台

Admin 面板 **PC 优先但基础响应**：
- 在手机上可查看和操作核心管理功能
- 复杂操作（如节点拖拽编辑器）提示"建议在 PC 上操作"
- 表格自动水平滚动

### 14.4 后续升级路径

当前 Player 端移动适配后，后续转**微信小程序**时：
- 前端直接用 Tailwind 样式迁移（class 复用）
- React 组件逻辑重写为小程序组件
- API 层和数据模型完全复用后端

---

## 15. 非功能需求

- 流式输出延迟：SSE 首字节 < 2s
- LLM 结果缓存：Redis TTL 7 天
- 节点树缓存：Redis TTL 1 小时
- 登录会话超时：24 小时无操作自动过期
- 支持同时进行多个冒险会话
- 所有 LLM 调用支持用户自定义模型切换
- 密码使用 BCrypt 加密存储
- Player 前端全面适配移动端（Mobile-First）
- Admin 前端 PC 优先但保证基础移动可用
