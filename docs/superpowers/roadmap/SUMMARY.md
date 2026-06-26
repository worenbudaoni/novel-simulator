# Novel Interactive Story Simulator — 进度总览

> 总设计文档: `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md` (v3.0)
> 最后更新: 2026-06-26

---

## 📊 进度概况

| 阶段 | 状态 | 说明 |
|------|------|--------|
| **P1 基础架构** | ✅ 已完成 | 后端代码 + 前端脚手架全部完成 |
| **P2 内容管理** | ✅ 已完成 | Novel/Node/Event CRUD, LLM导入, Admin页面完整 |
| **RBAC 权限树重构** | ✅ 已完成 | 树形权限表、动态侧边栏、Authorized 组件 |
| **P3 核心玩法** | ✅ **已完成** | 包含玩法流程重构(因果链系统) |
| P4 叙事与评分 | ⏳ 待开始 | |
| P5 管理完善与移动端 | ⏳ 待开始 | |

---

## 🎯 最新阶段：玩法流程重构（因果链系统）

### 改造内容

将旧版散乱的"选择→随机转盘→故事"流程，重构为"选择→检定→机械结果→叙事"的因果链：

| 旧版 | 新版 |
|------|------|
| 选项无风险区分 | 选项带 riskLevel (safe/risky/daring) |
| 转盘概率随机触发（和选择无关） | 由选项 riskLevel 决定（daring=强制触发） |
| 属性仅 LLM prompt 软提示 | 属性参与 d20 检定公式（硬作用） |
| choose + spin 两个 API | 统一 resolve 端点，一次返回全部结果 |
| 转盘独立弹窗需点击 | 轮盘自动播放，扇区由后端决定 |
| 故事不知道机械结果 | StoryChain 收到完整 ResolutionResult |

### 文件改动

**后端（10 文件）：** OptionVO, ResolutionResult(新), OptionChain, ActionEngine(重写), EventChain, StoryChain, PlayerController, 删除 3 个旧 DTO

**前端（7 文件）：** ChoicePanel(重写), ResolutionDisplay(新), WheelOfFortune(重写), CharacterPanel, useStory, page-player-story(重写), types

---

## 📚 文档索引

### 设计文档
| 文档 | 内容 |
|------|------|
| `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md` | **总设计** (v3.0) — 架构、RBAC、数据模型、Chain 设计 |
| `docs/superpowers/specs/2026-06-26-gameplay-flow-redesign.md` | **玩法流程重构设计** — 因果链系统 |
| `docs/superpowers/specs/2026-06-26-optionchain-design.md` | OptionChain 设计 |
| `docs/superpowers/gameplay/gameplay-logic.md` | **流程定义 v2.0** — 完整游戏循环、数据流、检定公式 |
| `docs/superpowers/gameplay/gameplay-mechanics-design.md` | **玩法机制** — 属性驱动、骨架血肉分离 |
| `docs/superpowers/gameplay/llm-deep-participation.md` | **LLM 方案** — Chain 设计、Prompt |
| `docs/superpowers/specs/2026-06-25-rbac-permission-tree-design.md` | RBAC 权限树设计 |

### 实施计划（历史）
| 计划 | 阶段 |
|------|------|
| `docs/superpowers/plans/2026-06-18-P1-基础架构.md` | P1 |
| `docs/superpowers/plans/2026-06-24-P2-content-management.md` | P2 |
| `docs/superpowers/plans/2026-06-25-P3-A-player-basics.md` | P3-A |
| `docs/superpowers/plans/2026-06-25-P3-B-core-gameplay.md` | P3-B |
| `docs/superpowers/plans/2026-06-25-P3-C-llm-deep-participation.md` | P3-C |
| `docs/superpowers/plans/2026-06-26-gameplay-flow-redesign.md` | **玩法流程重构** |

### 各阶段详情
- [P1 基础架构](P1-基础架构.md)
- [P2 内容管理](P2-内容管理.md)
- [P3 核心玩法](P3-核心玩法.md)
- [P4 叙事与评分](P4-叙事与评分.md)
- [P5 管理完善与移动端](P5-管理完善与移动端.md)

---

## 📝 最近提交

```
da7ce20 fix: missing Loader2Icon import in page-player-story causing blank screen
76e01db fix: ResolutionDisplay heading shows actual sector icon/name
2f130ef fix: EventChain stub add sector, global loading overlay
c8067b0 fix: backend pass sector from EventChain through to frontend wheel
672d75a fix: char-position split for StoryViewer, immediate scroll on continue
b4dc540 fix: comprehensive UX rewrite - HTML comment divider, StoryViewer always mounted
6d823b0 fix: prevent blank screen - only show divider when new content exists
2b231ca fix: story scroll UX - scroll to new content start, '📖 故事继续' divider
ab49913 fix: UX - loading state, manual ResolutionDisplay, wheel sector, waiting state
2ab7dfc feat: frontend gameplay flow redesign - all 6 components rewritten
2335410 feat: ActionEngine resolve() with d20 check formula
```
