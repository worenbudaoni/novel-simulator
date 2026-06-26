# OptionChain — 动态选项生成设计

> 版本: v1.0
> 日期: 2026-06-26
> 状态: 已定稿

---

## 1. 概述

实现 OptionChain 组件，玩家到达节点时由 LLM 实时生成选项，替代原有的 `node_option` 表静态选项方案。

**核心变化：** 选项不再存库，每次由 LLM 根据当前上下文动态生成，约束为只能指向已连接的节点。

---

## 2. 设计原则

| 原则 | 说明 |
|------|------|
| 骨架血肉分离 | Admin 管节点+连接（骨架），LLM 管选项（血肉） |
| 硬约束 | targetNodeId 必须在可用连接列表中，LLM 不能自由创造目标 |
| 无状态生成 | 每次到达节点实时生成，选项不落库 |
| 自然融入属性 | LLM 根据角色属性自动适配选项风格，无需 min_intelligence 硬过滤 |
| LLM 强依赖 | LLM 不可用时直接报错，不降级 |

---

## 3. 后端改动

### 3.1 新建 OptionChain.java

**包路径：** `com.novel.simulator.service.OptionChain`

**方法签名：**

```java
public List<OptionVO> generateOptions(String sessionId, Long nodeId)
```

**输入（方法内部获取）：**
- 当前节点（title + description）
- 可用连接列表（targetId + targetTitle + targetDescription）
- 角色属性（6维）
- 全量对话历史（Redis 中的完整 chat_history 数组）
- 世界观（worldView）

**输出（OptionVO）：**

```java
public class OptionVO {
    private String label;        // 选项文案
    private Long targetNodeId;   // 目标节点 ID
}
```

**LLM Prompt：** 复用 `docs/superpowers/gameplay/llm-deep-participation.md` §三 的现有 prompt 设计。

**LLM 配置：**
- temperature: 0.7（平衡创意与结构化）
- maxTokens: 1024
- LLM 不可用或调用异常时直接抛异常，前端展示错误提示

**约束校验：** LLM 返回后，逐项检查 `targetNodeId` 是否在可用连接列表中。不在列表中的选项被过滤掉，并记录 warn 日志。过滤后不足 2 个选项时仍返回剩余结果，由前端处理。

### 3.2 新增 Player API

```
GET /api/player/option/generate?sessionId={sessionId}&nodeId={nodeId}
```

- 调用 `optionChain.generateOptions(sessionId, nodeId)`
- 返回 `ApiResult<List<OptionVO>>`
- 权限：`player:play`

### 3.3 Admin 清理

#### ParseChain.java

修改 `buildParsePrompt()`，从 prompt 中去掉 options 相关要求。LLM 不再需要生成 `"options"` 数组。

#### NovelImportController.writeParsedData()

去掉 `parseResult.get("options")` 的处理分支，不再写入 `node_option` 表。

#### NodeController.java

- `GET /{id}/nodes`：返回数据中去掉 `options` 字段
- `PUT /{id}/nodes`：接受参数中去掉 `options` 字段

#### NodeService.java

- `getFullNodes()`：去掉 options 查询
- `saveNodes()`：去掉 options 删除/写入逻辑

#### SaveNodesRequest.java（如不再使用可选删除）

去掉 `List<NodeOption> options` 字段。

### 3.4 PlayerController 调整

`GET /api/player/node/{nodeId}`：当前返回 `node + options`，改为只返回节点详情，选项由新接口获取。原有 `targetRequirements` 逻辑可移除（LLM 自然处理属性适配）。

---

## 4. 前端改动

### 4.1 ChoicePanel.tsx

- 去掉 `min_intelligence` / `min_charm` 硬过滤逻辑
- 选项数据来源从 `node.options` 改为新的 generate 接口
- 保持 loading / error 状态
  - loading：选项骨架屏
  - error：重试按钮 + 提示
  - empty：无可用选项时展示友好提示

### 4.2 数据流

```
到达节点
  → 调 GET /api/player/option/generate?sessionId=X&nodeId=Y
  → OptionChain(LLM) 生成 3-4 个选项
  → 返回给前端渲染
  → 玩家选择 → 调 POST /api/player/action/choose
     (choose 沿用现有逻辑，根据 targetNodeId 导航)
```

### 4.3 page-admin-node-editor.tsx

- 去掉 `dbOptions` 状态定义（useState）
- 去掉加载时 `res.data.data.options` 读取
- 去掉保存时 `options: dbOptions` 发送
- 属性面板不变（只编辑节点标题/描述/类型），无 UI 变化

---

## 5. 数据库

| 变更 | 说明 |
|------|------|
| `node_option` 表 | 保留不动，兼容旧数据 |
| 导入时写入 | 不再写入 |
| Admin 编辑时 | 不再读写 |
| 运行时 | 不再读取 |

旧数据的 `node_option` 行在 OptionChain 上线后不再使用，可通过后续迁移清理。

---

## 6. 不涉及改动的确认

| 模块 | 原因 |
|------|------|
| `ActionEngine.java` | choose() 方法签名不变，仍按 targetNodeId 导航 |
| `StoryChain.java` | 不受影响 |
| `EventChain.java` | 不受影响 |
| 转盘流程 | 不受影响 |
| 存档/读档 | 不受影响 |
| 结局评分 | 不受影响 |
| 作品列表/设置页 | 不受影响 |
| 角色创建 | 不受影响 |
| SSE 流式 | 不受影响 |

---

## 7. 状态覆盖

| 状态 | 表现 |
|------|------|
| loading | ChoicePanel 骨架屏（3-4 个选项占位符） |
| empty | 无可达连接 → 「当前没有可去的方向」提示；过滤后无剩余选项 → 同上 |
| error | 选项生成失败 → 错误提示 + 「重试」按钮（LLM 不可用时提示配置 LLM） |
| success | 正常展示 3-4 个选项 |
| 选项不足 | 过滤后少于 2 个 → 直接返回剩余结果，前端正常展示 |
