# 因果链 v2 — 游戏流程连贯性重构

> 版本: v1.0
> 日期: 2026-06-26
> 状态: 已定稿
> 前置设计: `2026-06-26-gameplay-flow-redesign.md`（因果链 v1）

---

## 1. 问题分析

### 1.1 五个核心断裂点

| # | 断裂点 | 具体表现 | 代码位置 |
|---|--------|---------|---------|
| 1 | **机械结果先于叙事** | ActionEngine 硬编码 hp±10~20 / attr±2~5，StoryChain 被逼编故事解释数字 | `ActionEngine.java:143-167`, `StoryChain.java:314-320` |
| 2 | **属性关联靠关键词匹配** | detectAttr 用"察/读/战/打"猜属性，label 不含关键词就默认 luck | `ActionEngine.java:217-225` |
| 3 | **转盘与世界观脱节** | sector=random(6)，6 扇区是通用武侠风，科幻作品违和；luck 不影响扇区 | `EventChain.java:167` |
| 4 | **三套 Chain 上下文不一致** | OptionChain 截断历史，StoryChain 用全量，EventChain 只取最近一条 assistant | `OptionChain.java:122-123`, `StoryChain.java:243`, `EventChain.java:122-132` |
| 5 | **节点元数据缺失** | DC 只看属性值不看节点，"虎穴"和"客栈" DC 一样；min_intelligence/min_charm/required_title 闲置 | `ActionEngine.java:228-233` |

**UI 层面**：ResolutionDisplay 覆盖 StoryViewer；事件展示后不持久化；节点标题与故事区视觉断层；属性浮动动画与 resolution 生命周期耦合。

---

## 2. 设计目标

1. **关联属性由 LLM 标注**：checkAttr 由 OptionChain 输出，替代 detectAttr 关键词匹配
2. **数值由 LLM 生成**：risky/daring 的属性变化由 EventChain（LLM）根据情境产出，不再硬编码
3. **DC 关联节点危险度**：DC = f(node.dangerLevel, riskLevel)，不同节点不同难度
4. **去转盘**：daring = 强制事件 + 风险警告动画，删除 WheelOfFortune
5. **统一上下文**：新增 SessionContext（Redis），三个 Chain 共享同一份 6 轮未截断滑动窗口
6. **System prompt 动态更新**：StoryChain system prompt 每次节点切换时重建
7. **LLM 不可用即报错**：不降级 stub，直接抛错"LLM 服务不可用"

---

## 3. 改造后数据流

```
节点到达 → SessionContext 重建(worldview + node + character + 最近6轮)
  ↓
OptionChain 输出: label + targetNodeId + riskLevel + checkAttr + attrHint
  ↓                                                          ← checkAttr 由 LLM 标注
玩家选择 → ActionEngine.resolve
  ├─ safe:    代码算小收益(hp+5~10, attr+1)                   ← 省 LLM 调用
  ├─ risky:   d20(checkAttr + node.dangerLevel 算 DC) → 定成败
  │            └─ EventChain(LLM) 生成 事件+数值
  └─ daring:  EventChain(LLM) 生成 事件+数值(luck 偏向)
  ↓                                                          ← 数值由 LLM 出
StoryChain 收 ResolutionResult(含 LLM 事件+数值) → 叙事自然延续
```

---

## 4. 后端组件改造

### 4.1 SessionContext（新增）

Redis key: `cache:session:{sessionId}:context`

```java
public class SessionContext {
    private String worldview;
    private String novelTitle;
    private long currentNodeId;
    private String currentNodeTitle;
    private String currentNodeDescription;
    private int nodeDangerLevel;           // 来自 node.dangerLevel
    private Map<String, Integer> character; // {hp, attack, defense, intelligence, charm, luck}
    private List<Round> recentRounds;      // 最近 6 轮
}

class Round {
    String userAction;    // "选择「探索密道」(risky)"
    String checkResult;   // "检定: 智力=65 骰15+修正1 vs DC13 → 成功 HP+12 智力+3"
    String storyText;     // LLM 生成的故事段落
}
```

- **写入**：StoryChain 每次生成后追加一轮，修剪至 6 轮
- **读取**：OptionChain / EventChain / StoryChain 都读此对象

### 4.2 OptionChain

| 项 | 当前 | 目标 |
|---|---|---|
| 上下文 | 自读 Redis（截断 user 200字 / assistant 500字） | 读 SessionContext（6 轮未截断） |
| checkAttr | 不输出 | **新增输出 checkAttr** |
| Prompt | 无严格世界观约束 | 加"严格限定在《作品名》世界观" |

**OptionVO 新增**：
```java
private String checkAttr;   // "intelligence"|"charm"|"attack"|"defense"|"luck"
```

**Prompt 追加**：
```
6. 用 checkAttr 标注每个选项关联的属性（intelligence/charm/attack/defense/luck）
7. 当前场景危险度 {nodeDangerLevel}/5，选项的 riskLevel 与危险度要匹配
8. 所有选项内容严格限定在《作品名》世界观内
```

**校验**：checkAttr 必须是六维之一，非法值默认 "intelligence"。

### 4.3 ActionEngine — rebuild

**核心改动**：resolveRisky 不再硬编码数值，改调 EventChain。

```java
// checkAttr 不再关键词匹配，从请求参数获取（前端传回 OptionVO.checkAttr）
public ResolutionResult resolve(String sessionId, Long targetNodeId,
                                 String choiceLabel, String riskLevel, String checkAttr) {
    // ...
    switch (riskLevel) {
        case "safe":  return resolveSafe(character, nodeDangerLevel);
        case "risky": return resolveRisky(character, choiceLabel, checkAttr, nodeDangerLevel, session, currentNode);
        case "daring":return resolveDaring(character, session, currentNode, choiceLabel);
    }
}
```

**新 DC 公式**：
```java
DC = baseDangerDC + riskLevelOffset
// baseDangerDC: 1→8, 2→11, 3→13, 4→15, 5→17
// riskLevelOffset: risky→0
```

**safe 保持代码算**（不调 LLM）：
```java
// dangerLevel≥4 时 hp 收益减半
int hpGain = 5 + random(6);
if (nodeDangerLevel >= 4) hpGain /= 2;
int maxHpGain = nodeDangerLevel >= 4 ? 5 : 10;
```

**risky 改调 EventChain**：
```java
d20(checkAttr + nodeDangerLevel) → success/fail
→ eventChain.generateEvent(riskLevel="risky", success, checkAttr, choiceLabel)
→ 返回事件+数值 → 应用 → 组装 ResolutionResult
```

**daring 改调 EventChain**（无 d20）：
```java
→ eventChain.generateEvent(riskLevel="daring", success=null, checkAttr=null, choiceLabel)
→ luck 值传给 LLM 影响偏向
```

**删除**：`detectAttr()`、`pickDC()` 旧实现。

### 4.4 EventChain

| 项 | 当前 | 目标 |
|---|---|---|
| 扇区 | random(6)，生成通用扇区名 | **删除** |
| 参数 | (session, node, character, riskLevel) | 增加 success, checkAttr, choiceLabel |
| 上下文 | 自读最近一条 assistant | 读 SessionContext |
| 降级 | stub 硬编码 6 扇区事件 | **删除 stub，LLM 不可用直接报错** |

**新方法签名**：
```java
Map<String, Object> generateEvent(
    UserSession session, Node node, UserCharacter character,
    String riskLevel,        // "risky" | "daring"
    Boolean success,         // risky d20 结果，daring 时 null
    String checkAttr,        // 关联属性
    String choiceLabel       // 玩家选择的选项文案
)
```

**LLM prompt 约束**：
```
- risky 成功: HP+5~20, checkAttr+2~5, 其他偶小幅正面
- risky 失败: HP-5~25, checkAttr-1~4, 其他偶小幅负面
- daring: HP±10~30, 多属性变化, 受 luck 偏向
- 当前 HP 低时伤害减小（避免秒杀）
- 所有内容严格限定在《作品名》世界观内
- 返回 JSON: {title, content, hpChange, attackChange, defenseChange, intelligenceChange, charmChange, luckChange}
```

### 4.5 StoryChain

| 项 | 当前 | 目标 |
|---|---|---|
| system prompt | 仅首次生成时创建 | **每次节点切换时重建** |
| 上下文 | 自读全量历史 | 读 SessionContext |
| 生成输入 | actionDescription 或 ResolutionResult | **仅 ResolutionResult** |
| 降级 | stub 故事 | **删除 stub，LLM 不可用直接报错** |

**新 system prompt 构建**：每次 `generateStory()` 调用时，用 SessionContext 中的 currentNode 和 character 重建 system message（覆盖首条历史）。

**删除旧重载**：`generateStory(session, node, character, String description)`，统一用 `generateStory(session, node, character, ResolutionResult)`。

### 4.6 错误处理

| Chain | LLM 不可用时 | 前端 |
|-------|------------|------|
| OptionChain | 抛 RuntimeException | "选项生成失败，请检查 LLM 配置后重试" |
| EventChain | 抛 RuntimeException | "事件生成失败" → 错误提示 |
| StoryChain | 抛 RuntimeException | SSE error 事件 → "故事生成失败，请重试" |

---

## 5. 数据模型变更

### 5.1 node 表

```sql
ALTER TABLE node ADD COLUMN danger_level TINYINT DEFAULT 3 COMMENT '节点危险度 1-5';
```

ParseChain 导入时 LLM 自动标注，Admin 编辑器可手动调整。

### 5.2 OptionVO

```java
private String checkAttr;  // 新增：关联属性
```

### 5.3 ResolutionResult

```java
private String choiceLabel;  // 新增：玩家选择的选项文案
```

### 5.4 无需改动

node_edge / random_event / user_session / user_character / llm_cache 表不变。

---

## 6. 前端 UI 改造

**范围**：流程视觉反馈优化（不动整体布局）

### 6.1 ResolutionDisplay 重做

三种 riskLevel 展示：

**safe** — 绿色确认卡片：
- 入场简短视频 "🟢 稳定推进"
- hp 和 1 个属性变化数字（绿色胶囊，数字滚动 1s）
- 1.5s 后"继续"按钮亮起，可点击

**risky** — 骰子检定结果表 + 事件：
- 翻牌动画（300ms 逐个揭晓骰子/修正/合计/DC）
- ✅/❌ 结果
- 事件卡片（如有，从下滑入）
- 属性变化胶囊

**daring** — 风险警告 + 事件揭晓：
- 红色脉冲边框动画（2 圈，1.5s）
- 事件内容毛玻璃模糊 → 清晰（1s）
- 属性变化胶囊（负面带震屏微动）

### 6.2 WheelOfFortune — 删除

删除 `frontend/src/components/WheelOfFortune.tsx` 及所有引用。

### 6.3 事件融入故事

事件内容**持久化写入 storyText**（先于 SSE 故事流），用 `---` 分隔线包围，成为故事历史的永久段落。同时，LLM 在 StoryChain 的叙事中也会自然融入事件（ResolutionResult 传入 prompt）。

```typescript
// triggerStory 中，在 SSE 之前写入
if (res?.eventTitle) {
  const eventBlock = '\n\n---\n\n⚡ **' + res.eventTitle + '**\n\n'
    + (res.eventContent || '') + '\n\n---\n\n';
  setStoryText(prev => prev + eventBlock);
}
```

与旧版区别：旧版是混乱的文本拼接（`'---\n\n' + eventTitle + '！'`），新版是 Markdown 格式化的事件段落，且有序地在 SSE 之前写入，SSE 故事自然续接其后。

### 6.4 ChoicePanel — 属性图标

选项右侧加属性图标 + attrHint：

| checkAttr | 图标 |
|-----------|------|
| intelligence | 🧠 |
| charm | ✨ |
| attack | ⚔️ |
| defense | 🛡️ |
| luck | 🍀 |

### 6.5 CharacterPanel — 属性动画

- 数字滚动：CSS transition `duration-500` 平滑过渡
- 浮动数字：`+5`/`-3` 从胶囊位置上升 20px + 渐隐，1.5s
- 高亮 pulse：变化的属性胶囊 300ms pulse 后恢复

### 6.6 节点标题视觉衔接

StoryViewer 流式输出前插入场景转换条：
```
━━━━━━━━━━━━━━━━━━━━━━
  📍 红岸基地 · 危险度 ★★★★☆
━━━━━━━━━━━━━━━━━━━━━━
```

### 6.7 文件改动

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/ResolutionDisplay.tsx` | **重写** | 三种 riskLevel；删除转盘引用 |
| `components/WheelOfFortune.tsx` | **删除** | — |
| `components/CharacterPanel.tsx` | 修改 | 加载过渡 + 浮动数字 |
| `components/ChoicePanel.tsx` | 修改 | 加属性图标 |
| `pages/page-player-story.tsx` | 修改 | 持久化事件段落到 storyText + 传 checkAttr |
| `types/index.ts` | 修改 | Option 加 checkAttr |
| `hooks/useStory.ts` | 修改 | resolveAction 传 checkAttr |

---

## 7. 状态覆盖

| 状态 | 组件 | 表现 |
|------|------|------|
| loading | ChoicePanel | "正在生成选项..." + spinner |
| loading | StoryViewer | 光标闪烁 |
| error (LLM不可用) | ChoicePanel | "选项生成失败，请检查 LLM 配置后重试" |
| error (LLM不可用) | EventChain | "事件生成失败" |
| error (LLM不可用) | StoryChain | SSE error → "故事生成失败，请重试" |
| empty | ChoicePanel | "暂无可用选项" |
| disabled | ChoicePanel | 选择后按钮置灰 |
| dead | EndingModal | 死亡弹窗 |

---

## 8. 验收标准

1. checkAttr 由 OptionChain输出，不再靠关键词匹配
2. risky DC 由 node.dangerLevel 决定，不同节点难度不同
3. risky 成功后 EventChain(LLM) 生成事件+数值，数值幅度与节点危险度/角色状态匹配
4. daring → EventChain(LLM) 生成事件+数值，结果受 luck 偏向
5. StoryChain 收到完整 ResolutionResult，故事准确反映检定结果和事件
6. safe 保持代码算小收益（不调 LLM）
7. 三个 Chain 都读 SessionContext 共享上下文（6 轮未截断）
8. StoryChain system prompt 每次节点切换时更新
9. daring 前端展示风险警告动画，无转盘
10. 事件作为永久段落写入 storyText（`---` 分隔线包围），同时 LLM 在故事中自然融入
11. 属性变化有浮动数字动画，CharacterPanel 值平滑过渡
12. OptionVO.checkAttr 合法性校验（必须是六维之一）
13. LLM 不可用不降级，直接报错
14. WheelOfFortune 组件删除，相关引用清理干净

---

## 9. 留给 P4

- 故事摘要压缩（当前 6 轮滑动窗口替代）
- 称号系统
- 结局评分增强
- BranchChain 动态节点
- LLM 缓存
