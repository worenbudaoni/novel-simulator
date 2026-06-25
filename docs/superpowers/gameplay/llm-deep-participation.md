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

## 二、StoryChain — LLM 生成故事内容

### 方法签名

```java
public String generateStory(String worldView, UserSession session,
                            Node currentNode, UserCharacter character,
                            String actionDescription)
```

### Prompt

```
你是一个互动叙事大师，正在创作一部根据以下世界观改编的互动故事。

【世界观】
{worldView}

【当前场景】
节点：{nodeTitle}
描述：{nodeDescription}

【角色状态】
气血({hp}/100) | 攻击({attack}) | 防御({defense})
悟性({intelligence}) | 魅力({charm}) | 气运({luck})
已做出 {choicesMade} 次选择

【事件】（如有）
{eventTitle} — {eventDescription}
属性变化：HP {hpChange}, 攻击 {atkChange}...

请根据以上信息，写一段 300-500 字的故事叙述。要求：
1. 以第二人称"你"叙述，代入感强
2. 融入世界观设定，让玩家感觉身临其境
3. 角色属性值影响叙述方向：
   - HP 低 → 描写伤势、疲惫、艰难前行
   - 悟性高 → 描写洞察、思考、发现线索
   - 魅力高 → 描写人际互动、他人反应
   - 气运高 → 描写机缘巧合、好运
4. 语言精彩生动，善用比喻和细节描写，避免平淡叙述
5. 不要出现"你做出了选择"这类元描述
6. 【事件】存在时，以事件描述为基础展开叙述，将事件结果自然地融入故事中
7. 结尾要有余韵和期待感，自然过渡到下一步
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

## 三、EventChain — LLM 生成事件 + 属性变化

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

## 四、LLM 调用实现方案

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

## 五、涉及改动

| 文件 | 改动 |
|------|------|
| `StoryChain.java` | 注入 `NovelMapper`、LLM 配置；新增 `callLlm()`；`generateStory()`/`generateEnding()` 加 LLM 分支；降级 stub |
| `EventChain.java` | 注入 `NovelMapper`、LLM 配置；新增 `callLlm()`；`generateEvent()` 加 LLM 分支 + JSON 解析；降级 stub |
| `PlayerController.java` | `streamStory()` 查 Novel 拿 worldView 传给 StoryChain；`spin()` 传 worldView 给 EventChain |

### 不涉及改动的

- ParseChain — 已用 LLM，不改
- 前端代码 — 不改
- 数据库 — 不改
- ActionEngine — 只调 EventChain，不改
- application.yml — 已有 LLM 配置

---

## 六、LLM 可用的判定逻辑

```java
boolean llmAvailable = llmApiKey != null && !llmApiKey.isEmpty();
```

每次调用时检查，API Key 为空或调用异常时自动降级到 stub。系统不报错，只是故事/事件质量下降。

---

## 七、与现有系统的集成

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
