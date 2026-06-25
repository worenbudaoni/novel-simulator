# LLM 深度参与方案

## 核心理念

```
核心节点 = 故事骨架（LLM 导入时生成）
LLM 实时生成 = 血肉（每次选择/事件都调用 LLM）
属性变化 = LLM 根据上下文决定
```

系统不硬编码任何属性变化数值和故事内容，全由 LLM 根据当前上下文实时生成。

---

## 一、EventChain — LLM 生成事件 + 属性变化

### 当前

```java
switch (sector) {
    case 0: hp = -15; atk = 2; content = "固定文本"; break;
    ...
}
```

### 改造后

```
LLM Prompt：
  你是一个互动故事的事件生成器。
  
  世界观：{worldView}
  当前场景：{currentNode.title} - {currentNode.description}
  角色属性：HP={hp}, 攻击={attack}, 防御={defense}, 智力={intelligence}, 魅力={charm}, 运气={luck}
  事件扇区：{sector}（奇遇/宝箱/战斗/诅咒/命运/邂逅）
  
  请生成一个符合世界观的事件，严格返回JSON格式：
  {
    "title": "事件标题",
    "content": "事件描述（50-100字，融入世界观）",
    "hpChange": 整数,
    "attackChange": 整数,
    "defenseChange": 整数,
    "intelligenceChange": 整数,
    "charmChange": 整数,
    "luckChange": 整数
  }
  
  要求：
  - 属性变化数值根据扇区类型和当前角色状态决定
  - 正面扇区属性变化为正，负面为负
  - HP 变化范围 -30 到 +30，其他属性 -5 到 +5
  - 内容要贴合世界观，不要通用模板
```

### 降级策略

LLM 不可用时（无 API Key），回退到当前硬编码的 stub 实现。

---

## 二、StoryChain — LLM 生成故事内容

### 当前

```java
sb.append(currentNode.getDescription());
sb.append("你感到状态很好...");
```

### 改造后

```
LLM Prompt（选择后）：
  你是一个互动故事的叙述者。
  
  世界观：{worldView}
  当前位置：{currentNode.title} - {currentNode.description}
  角色属性：HP={hp}, 攻击={attack}, 防御={defense}, 智力={intelligence}, 魅力={charm}, 运气={luck}
  已做选择：{choicesMade} 次
  操作描述：{actionDescription}
  
  请生成一段故事文本（100-200字），要求：
  - 基于当前场景和角色属性展开叙述
  - 属性值影响叙述方向（HP低→描述伤势，智力高→描述洞察）
  - 融入世界观设定
  - 不要出现"你做出了选择"这类元描述

LLM Prompt（转盘事件后）：
  同上 + 补充：
  发生了以下事件：{eventTitle} - {eventDescription}
  属性变化：HP {hpChange}, 攻击 {atkChange}...
  
  将事件结果融入故事叙述中。
```

### 降级策略

LLM 不可用时，回退到当前 stub。

---

## 三、数据流

```
选择选项
  ↓
ActionEngine.choose() → 导航节点 + 记录选择
  ↓（前端触发）
GET /story/stream/{sessionId}?description=xxx
  ↓
StoryChain.generateStory()
  ├─ LLM 可用 → 调用 LLM，传世界观+属性+场景
  └─ LLM 不可用 → 回退 stub
  ↓
保存到 story_text → SSE 流式返回

转盘抽奖
  ↓
ActionEngine.spin()
  ├─ EventChain.generateEvent()
  │   ├─ LLM 可用 → LLM 生成事件+属性变化
  │   └─ LLM 不可用 → 回退 stub
  ├─ 应用属性变化 → 更新数据库
  └─ 返回事件结果
  ↓（前端触发）
GET /story/stream/{sessionId}?description=事件内容
  ↓
StoryChain.generateStory()（同上）
```

---

## 四、涉及改动

| 文件 | 改动 |
|------|------|
| `StoryChain.java` | 新增 `callLlm()` 方法，构造 prompt 调用 LLM，解析返回文本；降级保留现有 stub |
| `EventChain.java` | 同上，prompt 要求返回 JSON 格式的属性变化；降级保留现有 stub |
| `application.yml` | 已有 LLM 配置，无需改动 |

### 关键设计

- 两个 Chain 都有自己的 `callLlm()`，互相独立
- LLM prompt 中传入选定的 **sector 类型**（仅 EventChain）
- 解析 LLM 返回时：EventChain 解析 JSON，StoryChain 直接取文本
- API Key 为空时不走 LLM，走 stub

---

## 五、不涉及改动的

- ParseChain — 导入时生成节点框架，已用 LLM，不改
- 前端代码 — 不改
- 数据库 — 不改
- ActionEngine — 不改（只调用 EventChain）
- PlayerController — 不改（SSE 端点不变）
