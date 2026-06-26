# 核心玩法逻辑梳理（v2.0 — 因果链系统）

> 最后更新: 2026-06-26
> 对应设计: `../specs/2026-06-26-gameplay-flow-redesign.md`
> 说明: 本版本重构了旧版"选择→随机转盘→故事"的断裂流程，改为"选择→检定→机械结果→叙事"的因果链

---

## 一、改造前 vs 改造后

### 旧流程（v1.0 — 已废弃）

```
到达节点 → 生成选项 → 选择 → 导航目标节点
                                ↓
                         [概率触发转盘?]  ← 随机，跟选择无关
                            ↓
                         转盘抽奖        ← 独立 mini-game
                            ↓
                       SSE 故事生成      ← 故事不知道转盘结果
```

**问题**：选择/转盘/故事三者因果断裂，属性只有软作用（仅 LLM prompt 提示），轮盘打断沉浸。

### 新流程（v2.0 — 当前）

```
到达节点
  ↓
① OptionChain(LLM) → 带风险标签的选项 (safe/risky/daring)
   ├─ safe:  安全推进，稳定小收益
   ├─ risky: d20 属性检定，成败影响大
   └─ daring: 强制触发事件，结果受属性偏向
  ↓
② 玩家选择 → POST /api/player/action/resolve（一次请求，替代旧 choose+spin）
  ↓
③ ActionEngine.resolve()
   ├─ safe → 稳定微增属性，直接进入叙事
   ├─ risky → d20 + 属性修正 vs DC
   │   ├─ 成功: 大额收益 ± 正面事件
   │   └─ 失败: 属性损失 ± 负面事件
   └─ daring → EventChain(LLM) 强制生成事件，结果受 luck 偏向
  ↓
④ 前端 ResolutionDisplay 展示检定结果（手动点击"继续"才推进）
   ├─ safe: 绿色属性变化数字
   ├─ risky: 骰子结果表 + 属性变化 + (事件卡片)
   └─ daring: 红色脉冲警告 + 事件揭晓动画 + 属性变化
  ↓
⑤ 事件持久化写入 storyText（`⚡ **标题**` 形式，`---` 分隔线包围），SSE 故事续接其后
  ↓
⑥ SSE: StoryChain 收到 ResolutionResult 后生成叙事
   ├─ Prompt 包含实际检定结果和属性变化值
   └─ 故事准确叙述发生了什么，而非泛泛描述
  ↓
⑦ 到达下一节点 → 回到①
```

---

## 二、三种风险等级详解

### safe — 安全推进

```
选择 "沿大路稳步前行" (safe)
  → 无需检定
  → HP+5~10, 随机微增一个属性+1
  → 前端: 绿色标签 + 数字浮动
  → Story: "你沿着大路稳步前行..."
```

### risky — 冒险检定

```
选择 "探索古道密道" (risky)
  → 从 label 自动识别关联属性 (探索→智力, 交涉→魅力, 战斗→攻击)
  → d20 + (属性值-50)/10 vs DC(10~15)
  → 成功: HP+10~20, 属性+2~5, 大成功触发正面事件
  → 失败: HP-10~20, 属性-1~3, 严重失败触发负面事件
```

### daring — 高风险

```
选择 "直闯虎穴" (daring)
  → 强制触发 EventChain(LLM)
  → 扇区由后端随机决定 (0=奇遇~5=邂逅)
  → LLM 根据扇区 + 角色运气值生成事件
  → 轮盘指针停在对应扇区（与事件内容一致）
```

---

## 三、关键数据流

### 请求/响应

```
POST /api/player/action/resolve
Body: {
  sessionId: "xxx",
  targetNodeId: 123,
  choiceLabel: "探索古道密道",
  riskLevel: "risky"
}
Response: {
  riskLevel: "risky",
  checkAttr: "intelligence",
  attrValue: 65,
  diceRoll: 15,
  modifier: 1,
  dc: 13,
  total: 16,
  success: true,
  attrChanges: { "hp": 12, "intelligence": 3 },
  isDead: false,
  eventTitle: "密道奇遇",
  eventContent: "你在密道中发现了一处隐蔽的洞穴...",
  sector: 0          // 仅 daring 或触发事件时
}
```

### 对话历史（Redis）

```
cache:session:{id}:chat_history = [
  {"role": "system", "content": "作品：《三体》\n世界观：...\n当前场景：红岸基地\n角色状态：..."},
  {"role": "user", "content": "选择「探索密道」(risky)"},
  {"role": "assistant", "content": "你小心翼翼地踏入密道..."}
]
```

StoryChain 每次读取完整历史发送给 LLM。当有 ResolutionResult 时，生成的消息包含实际检定数据。

### SSE 故事流

```
GET /api/player/story/stream/{sessionId}
  → 后端从 Redis 读取 pending_resolution（ActionEngine.resolve 时写入）
  → 如有 resolution → 调用 generateStory(session, node, char, resolution)
  → 如无 → 调用 generateStory(session, node, char, description)
  → 按段落 SSE 推送 story 事件
  → 结束后推送 done 事件
```

---

## 四、选项生成约束

```
OptionChain 输入：
  - 当前节点 ID + 标题 + 描述
  - 可用连接列表：[{targetId, targetTitle, targetDesc}]
  - 对话历史（最近 N 条）
  - 角色属性（HP/攻击/防御/智力/魅力/运气）
  - 世界观

OptionChain 输出：
  - [{label, targetNodeId, riskLevel, attrHint, expectedOutcome}, ...]

约束：
  - riskLevel ∈ {safe, risky, daring}
  - 每个 targetNodeId 必须在可用连接列表中
  - 不同选项应指向不同节点
  - 数量 3-4 个
  - riskLevel 非法值默认 safe
```

---

## 五、属性检定公式

```java
// 关联属性识别（从 label 关键词推断）
detectAttr("探索古道密道") → "intelligence"   // 含"探"/"索"关键词

// d20 检定
modifier = (属性值 - 50) / 10       // 50→0, 70→+2, 30→-2
roll = random(1, 20)                // d20
dc = pickDC(属性值)                  // 属性80→DC15, 60→DC13, 40→DC12, 低→DC10
total = roll + modifier
success = total >= dc
```

---

## 六、事件生成（v2.0 已去转盘）

daring 强制触发 EventChain(LLM)，事件内容严格由 LLM 根据作品世界观、当前场景、角色运气值生成，不再依赖通用扇区。risky 检定成功/失败同样调 EventChain 生成情境化事件+数值。

事件内容持久化写入 storyText（`⚡ **标题**` + `---` 分隔线），SSE 故事自然续接其后。
