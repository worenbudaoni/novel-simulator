# LLM 深度参与方案

> 对应 P3-C，改造 StoryChain 和 EventChain 接入真实 LLM
> 最后更新: 2026-06-25

---

## 核心理念

```
核心节点 = 故事骨架（LLM 导入时生成）
LLM 实时生成 = 血肉（每次选择/事件都调用 LLM）
属性变化 = LLM 根据上下文决定
```

系统不硬编码任何属性变化数值和故事内容，全由 LLM 根据当前上下文实时生成。

---

## 一、数据流改造

### 当前（Stub）

```
选择选项 → SSE story/stream → StoryChain.generateStory() → stub 文本
转盘抽奖 → ActionEngine.spin() → EventChain.generateEvent() → stub JSON
```

### 改造后

```
选择选项
  → SSE: /story/stream/{sessionId}?description=xxx
  → PlayerController 查 Novel 拿 worldView
  → StoryChain.generateStory(worldView, node, character, desc)
      ├─ LLM 可用 → callLlm() → 返回文本
      └─ 不可用   → stub

转盘抽奖
  → ActionEngine.spin() → EventChain.generateEvent(worldView, node, character, sector)
      ├─ LLM 可用 → callLlm() → 解析 JSON
      └─ 不可用   → stub
  → 前端触发 SSE → StoryChain 同上（事件描述带入 prompt）
```

### 世界获取链路

```
StoryChain / EventChain 接收 worldView 字符串
  → 由 PlayerController 通过 session.novelId 查 Novel 表拿到 worldView
  → 每次调用时传入，无需额外查询
```

---

## 二、完整游戏流程

### 链路

```
到达节点
  → OptionChain(LLM) 生成选项
  → 玩家选择
  → chooseAction() → 导航到目标节点
  → triggerStory(choiceLabel) → SSE: story/stream
  → StoryChain(LLM) 根据全量对话历史续写故事
  → onDone → 判断是否触发转盘？
      ├─ 是 → 显示转盘 → spinAction() → EventChain(LLM) 生成事件
      │   → triggerStory(eventDesc) → SSE → StoryChain 续写（融入事件）
      └─ 否 → 进入下一个节点 → 重复
```

### 三、OptionChain — LLM 生成选项

### 触发时机

玩家到达一个节点时（故事流结束后，或游戏启动时）

### 方法签名

```java
public List<Map<String, Object>> generateOptions(String sessionId, Long nodeId)
```

### Prompt

```
你是一个互动叙事游戏的设计师。请根据以下信息，为玩家生成 3-4 个选择。

【作品】{novelTitle}
【世界观】{worldView}
【当前场景】{nodeTitle} — {nodeDescription}

【角色当前状态】
{dim attributes}

【可去的方向】
{connection list: target title + description}

【故事上下文（最近一段）】
{recent story context}

请生成 3-4 个选项，每个选项指向一个可去的方向。
严格返回 JSON 数组格式（不要 markdown 代码块标记）：
[
  {"label": "选项文案", "targetNodeId": 目标节点ID},
  {"label": "选项文案", "targetNodeId": 目标节点ID}
]

要求：
- 每个 targetNodeId 必须在「可去的方向」列表中
- 不同选项应指向不同节点，形成有意义的分支
- 选项文案要有吸引力，让玩家感到每个选择都有分量
- 角色属性影响选项内容（高智力看到洞察选项，高魅力看到社交选项）
- 结合故事上下文，让选项贴合当前叙事
- 不要出现「继续前进」「下一步」这种无意义标题
```

### 关键设计

- **约束硬**：targetNodeId 必须在连接列表中，LLM 不能自由创造目标
- **选项不存库**：每次到达节点时实时生成，确保贴合当前上下文
- **属性自然融入**：不需要 min_intelligence 字段，LLM 根据属性值调整选项

---

## 四、故事生成流程

### 链路

```
选择后
  → triggerStory(choiceLabel) → SSE: story/stream
  → StoryChain 读取全量对话历史
      ├─ system: 世界观 + 作品名 + 场景 + 角色状态
      ├─ user: 之前的对话
      └─ assistant: 之前的故事
  → 追加当前操作为 user 消息
  → 全部发送给 LLM
  → LLM 续写故事
  → 追加 assistant 回复到对话历史
  → 保存到 Redis
```

**全量对话历史示例（Redis）：**

```
cache:session:{id}:chat_history = [
  {"role": "system", "content": "作品：《三体》\n世界观：...\n写作规则：..."},
  {"role": "user", "content": "选择「探索密道」"},
  {"role": "assistant", "content": "你沿着密道..."},
  ...
]
```

**关键设计**：不截断、不压缩，每次发送全部历史。LLM 原生理解对话上下文，保证故事连贯。

---

## 五、StoryChain — LLM 生成故事内容

### 方法签名

```java
public String generateStory(String worldView, UserSession session,
                            Node currentNode, UserCharacter character,
                            String actionDescription)
```

### Prompt

```
你是一个顶级互动叙事作家，正在创作一部沉浸式互动故事。

## 世界观设定
{worldView}

## 当前场景
地点：{nodeTitle}
描述：{nodeDescription}

## 角色当前状态
气血：{hp}/100　攻击：{attack}　防御：{defense}
悟性：{intelligence}　魅力：{charm}　气运：{luck}
已做出选择：{choicesMade} 次

## 前情提要
{storyContext}

## 当前行动
{actionDescription}

---

请以上述内容为基础，写一段 300-500 字的故事。要求：

1. **以第二人称"你"叙述**，让玩家身临其境
2. **以前情提要为基础续写**，保持情节连贯，不能断裂或重复
3. **融入世界观细节**：使用世界观中的地名、人物、势力、规则
4. **角色属性影响叙述**：
   - 气血低 → 伤势沉重、步履维艰
   - 悟性高 → 洞察秋毫、发现隐藏线索
   - 魅力高 → 言语动人、他人态度友善
   - 气运高 → 机缘巧合、绝处逢生
5. **【当前行动】存在时**：以当前行动为故事核心展开，如果是事件描述则将其无缝融入叙事
6. **语言生动精彩**：善用比喻、感官描写（视觉/听觉/触觉）
7. **结尾留下余韵**：自然过渡到下一步
8. **禁止**：出现"你做出了选择""你决定"等元描述
```

### Ending Prompt

```
你是一个互动叙事大师，为以下冒险旅程写一个精彩的结局总结。

【世界观】
{worldView}

【角色最终状态】
气血({hp}/100) | 攻击({attack}) | 防御({defense})
悟性({intelligence}) | 魅力({charm}) | 气运({luck})
共做出 {choicesMade} 次选择，经历了 {eventsTriggered} 次事件

【完整冒险历程】
{storyText}

请写一段 200-300 字的结局叙述，要求：
1. 回顾玩家的冒险历程，呼应关键节点
2. 根据角色最终状态决定结局基调：
   - HP 高 → 安然圆满
   - HP 中等 → 虽有遗憾但坚持到底
   - HP 低 → 壮烈/悲壮
3. 融入世界观设定，让结局有意义
4. 语言富有感染力，给玩家留下深刻印象
```

### 降级策略

LLM 不可用时（API Key 为空或调用失败），回退到当前 stub 实现。

---

## 六、EventChain — LLM 生成事件 + 属性变化

### 方法签名

```java
public Map<String, Object> generateEvent(String worldView, UserSession session,
                                         Node currentNode, UserCharacter character,
                                         String sector)
```

### Prompt

```
你是一个互动故事的事件生成器，正在为以下世界观生成随机事件。

【世界观】
{worldView}

【当前场景】
{nodeTitle} — {nodeDescription}

【角色状态】
HP={hp}, 攻击={attack}, 防御={defense}
悟性={intelligence}, 魅力={charm}, 气运={luck}

【扇区类型】
{sector}

请生成一个符合世界观、有沉浸感的事件，严格返回以下 JSON 格式
（不要 markdown 代码块标记，不要额外内容）：

{
  "title": "事件标题",
  "content": "事件描述",
  "hpChange": 整数,
  "attackChange": 整数,
  "defenseChange": 整数,
  "intelligenceChange": 整数,
  "charmChange": 整数,
  "luckChange": 整数
}

各扇区基调：
- 奇遇 → 惊喜、机缘、发现
- 宝箱 → 收获、资源、装备
- 战斗 → 激烈、危险、搏斗
- 诅咒 → 压抑、负面、阴影
- 命运 → 玄妙、转折、因果
- 邂逅 → 温暖、相遇、羁绊

要求：
- title：带情绪/氛围的标题（如「暗影突袭」「天降机缘」「古道遇险」）
- content：500-1000 字，像小说段落一样丰富，有场景描写、氛围渲染、细节刻画，不要"你发现了一个宝箱"这种平淡描述
- HP 变化范围 -30 到 +30，其他属性 -5 到 +5
- 正面扇区属性变化多为正，负面多为负
- 当前 HP 低时伤害相应减小（避免秒杀）
- 数值合理，符合世界观逻辑
```

### 降级策略

LLM 不可用时，回退到当前 6 扇区硬编码 stub。

---

## 七、LLM 调用实现方案

### LLM 配置来源

沿用 `application.yml` 已有配置：

```yaml
llm:
  api-url: https://api.deepseek.com
  api-key: ${LLM_API_KEY}
  model-name: deepseek-v4-flash
```

### callLlm 方法

参考 ParseChain 的实现模式，每个 Chain 有自己的 `callLlm()`：

```java
private LlmResult callLlm(String prompt) {
    if (llmApiKey == null || llmApiKey.isEmpty()) {
        return LlmResult.error("LLM API Key 未配置");
    }
    try {
        ChatLanguageModel model = OpenAiChatModel.builder()
            .apiKey(llmApiKey)
            .modelName(llmModelName)
            .baseUrl(llmApiUrl)
            .temperature(0.8)
            .maxTokens(2048)
            .timeout(Duration.ofSeconds(60))
            .build();
        String response = model.generate(prompt);
        return LlmResult.success(response);
    } catch (Exception e) {
        return LlmResult.error(e.getMessage());
    }
}
```

**区别**：
- StoryChain：temperature=0.8（创意性更高，因为生成故事）
- EventChain：temperature=0.5（平衡创意与结构化输出）
- ParseChain：temperature=0.7（已有，不改）

---

## 八、涉及改动

| 文件 | 改动 |
|------|------|
| `StoryChain.java` | Redis 全量对话历史；OpenAI chat 格式；model.generate(messages) |
| `EventChain.java` | 读取共享对话历史；加入世界观约束 |
| `PlayerController.java` | 新增选项生成端点 |
| `前端` | 去掉 ChoicePanel 属性过滤；节点加载时调选项接口 |

### 不涉及改动的

- ParseChain — 已用 LLM，不改
- 数据库表结构 — node_option 保留但不再写入（兼容旧数据）
- ActionEngine — 调用方式不变

---

## 九、LLM 可用的判定逻辑

```java
boolean llmAvailable = llmApiKey != null && !llmApiKey.isEmpty();
```

每次调用时检查，API Key 为空或调用异常时自动降级到 stub。系统不报错，只是故事/事件质量下降。

---

## 十、与现有系统的集成

### EventChain 属性变化返回格式

```java
Map<String, Object> result = new HashMap<>();
result.put("title", "暗影突袭");
result.put("content", "你正沿着山道前行，突然一道黑影从侧面袭来...");
result.put("hpChange", -15);
result.put("atkChange", 2);
result.put("defChange", 0);
result.put("intChange", 0);
result.put("chaChange", -1);
result.put("lukChange", 0);
```

ActionEngine.spin() 已按这个格式消费，无需改动。

### StoryChain 返回文本

直接返回 LLM 生成的字符串，SSE 流式逐段推送逻辑不变。
