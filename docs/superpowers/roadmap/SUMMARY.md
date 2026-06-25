# Novel Interactive Story Simulator — 进度总览

> 总设计文档: `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md` (v3.0)
> 最后更新: 2026-06-26

---

## 📊 进度概况

| 阶段 | 状态 | 说明 |
|------|------|--------|
| **P1 基础架构** | ✅ 已完成 | 后端代码 + 前端脚手架全部完成，需建表后联调 |
| **P2 内容管理** | ✅ 已完成 | Novel/Node/Event CRUD, LLM导入, Admin页面完整 |
| **RBAC 权限树重构** | ✅ 已完成 | 树形权限表、动态侧边栏、权限组件 |
| **P3 核心玩法** | 🔄 进行中 | **P3-C 完成**，下一步实现 **OptionChain** |
| P4 叙事与评分 | ⏳ 待开始 | |
| P5 管理完善与移动端 | ⏳ 待开始 | |

---

## 🎯 当前阶段：P3 核心玩法

### 最新架构决策（v3.0）

**骨架血肉分离** — `specs/...-design.md` §6.4

| 层 | 负责方 | 内容 |
|----|--------|------|
| 骨架 | Admin | 节点 + 连接（故事地图） |
| 血肉 | LLM | 选项 + 故事 + 事件（叙事填充） |

选项不再存库，改为每次到达节点时由 **OptionChain(LLM)** 实时生成，约束为只能指向已连接的节点。

### 对话历史方案

全量 OpenAI chat 格式存 Redis（`cache:session:{id}:chat_history`），每次生成发送全部消息给 LLM。EventChain 读同一份历史保证上下文一致。

---

## ✅ 已完成内容

### P3-C LLM 深度参与（2026-06-26）
| 组件 | 状态 | 说明 |
|------|------|--------|
| StoryChain | ✅ | Redis 全量对话历史，OpenAI chat 格式，model.generate(messages) |
| EventChain | ✅ | 读取共享对话历史，含世界观约束，事件内容走 Redis 中转 |
| SSE 流式 | ✅ | flushSync 逐段渲染 |
| 转盘流程 | ✅ | 动画1s + 停留1s = 2s关，异步不阻塞API |
| Redis 上下文 | ✅ | chat_history + pending_event + story_context |
| 导入 preview 缓存 | ✅ | preview→name 共享缓存，不重复调 LLM |

### 之前已完成
- P3-A: 作品列表、会话管理、角色创建、故事主界面
- P3-B: ActionEngine、StoryChain(stub)、EventChain(stub)、SSE、转盘、选项过滤、存档、结局
- 面包屑导航
- 菜单树按用户 sessionId 缓存

---

## ⏳ 待执行（按优先级）

### 1. OptionChain（最高优先级）
- 新组件，玩家到达节点时 LLM 生成选项
- 输入：当前节点 + 连接列表 + 对话历史 + 角色属性
- 约束：targetNodeId 必须在连接列表中
- Prompt 见 `gameplay/llm-deep-participation.md` §三
- 涉及：后端（OptionChain.java）+ 前端（节点加载时调选项接口）
- 去掉 ChoicePanel 的 min_intelligence 硬过滤

### 2. 死亡判定 + DeathModal
- HP ≤ 0 时触发死亡
- 复用 EndingModal

### 3. 移动端适配
- 故事页面响应式布局

---

## 📚 文档索引

### 设计文档
| 文档 | 内容 |
|------|------|
| `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md` | **总设计** (v3.0) — 架构、RBAC、数据模型、Chain 设计 |
| `docs/superpowers/gameplay/gameplay-mechanics-design.md` | **玩法机制** — 属性驱动、选项类型、骨架血肉分离 |
| `docs/superpowers/gameplay/gameplay-logic.md` | **流程定义** — 完整游戏循环、数据流 |
| `docs/superpowers/gameplay/llm-deep-participation.md` | **LLM 方案** — OptionChain/StoryChain/EventChain 设计、Prompt |
| `docs/superpowers/specs/2026-06-25-rbac-permission-tree-design.md` | RBAC 权限树设计 |

### 实施计划（历史）
| 计划 | 阶段 |
|------|------|
| `docs/superpowers/plans/2026-06-18-P1-基础架构.md` | P1 |
| `docs/superpowers/plans/2026-06-24-P2-content-management.md` | P2 |
| `docs/superpowers/plans/2026-06-25-P3-A-player-basics.md` | P3-A |
| `docs/superpowers/plans/2026-06-25-P3-B-core-gameplay.md` | P3-B |
| `docs/superpowers/plans/2026-06-25-P3-C-llm-deep-participation.md` | P3-C |

### 各阶段详情
- [P1 基础架构](P1-基础架构.md)
- [P2 内容管理](P2-内容管理.md)
- [P3 核心玩法](P3-核心玩法.md)
- [P4 叙事与评分](P4-叙事与评分.md)
- [P5 管理完善与移动端](P5-管理完善与移动端.md)

---

## 🚀 启动指引

```bash
# 1. 建表
mysql -u root -p novel_simulator < sql/01-ddl.sql
mysql -u root -p novel_simulator < sql/02-seed-data.sql

# 2. 配置 application.yml
#    - 数据库密码
#    - Redis 密码（如有）
#    - llm.api-key（空 = 走 stub，有值 = 走 LLM）

# 3. 启动后端
mvn spring-boot:run

# 4. 启动前端
cd frontend && npm run dev
```

---

## 📝 最近提交

```
ce857ad docs: update all docs to reflect skeleton+flesh architecture
1b1aeab fix: close wheel after fixed 2s independent of API; show sector result
efb4e07 fix: ensure wheel stays visible for at least 2s from click
5d0699c fix: store event content in Redis to avoid URL length limit in SSE
e072f91 fix: EventChain reads shared Redis chat history
```
