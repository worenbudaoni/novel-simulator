# P3-C LLM 深度参与 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造 StoryChain 和 EventChain，从硬编码 stub 切换到真实 LLM 调用，LLM 不可用时降级回 stub。

**Architecture:** 两个 Chain 各自独立接入 LLM，互不依赖。StoryChain 生成叙述文本，EventChain 生成结构化 JSON（事件内容+属性变化）。PlayerController 查 Novel 表拿 worldView 传给 StoryChain；EventChain 通过 `session.novelId` 自查。前端、数据库、ActionEngine 均不改。

**Tech Stack:** Java 8, Spring Boot 2.6.13, LangChain4j (OpenAiChatModel), Jackson

**参考设计:** `docs/superpowers/gameplay/llm-deep-participation.md`

---

## 文件改动总览

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `StoryChain.java` | 修改 | 注入 LLM 配置 + NovelMapper，新增 callLlm()，改造 generateStory/generateEnding |
| `EventChain.java` | 修改 | 注入 LLM 配置 + NovelMapper，新增 callLlm()，改造 generateEvent |
| `PlayerController.java` | 不改 | Chain 内部自查 worldView，无需外部传入 |

---

### Task 1: EventChain — LLM 调用 + JSON 解析

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/EventChain.java`

- [ ] **Step 1: 添加依赖注入字段**

在 `EventChain.java` 中添加注入：

```java
import com.novel.simulator.mapper.NovelMapper;
import com.novel.simulator.entity.Novel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import java.time.Duration;

@Service
public class EventChain {
    private static final Logger log = LoggerFactory.getLogger(EventChain.class);

    private final NovelMapper novelMapper;
    private final ObjectMapper objectMapper;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public EventChain(NovelMapper novelMapper, ObjectMapper objectMapper) {
        this.novelMapper = novelMapper;
        this.objectMapper = objectMapper;
    }
```

- [ ] **Step 2: 添加 callLlm 辅助方法**

```java
private static class LlmResult {
    String text;
    String error;

    static LlmResult success(String text) { LlmResult r = new LlmResult(); r.text = text; return r; }
    static LlmResult error(String msg) { LlmResult r = new LlmResult(); r.error = msg; return r; }
}

private LlmResult callLlm(String prompt) {
    if (llmApiKey == null || llmApiKey.isEmpty()) {
        return LlmResult.error("LLM API Key 未配置");
    }
    try {
        ChatLanguageModel model = OpenAiChatModel.builder()
            .apiKey(llmApiKey)
            .modelName(llmModelName)
            .baseUrl(llmApiUrl)
            .temperature(0.5)
            .maxTokens(2048)
            .timeout(Duration.ofSeconds(60))
            .build();
        String response = model.generate(prompt);
        return LlmResult.success(response);
    } catch (Exception e) {
        log.warn("LLM call failed: {}", e.getMessage());
        return LlmResult.error(e.getMessage());
    }
}
```

- [ ] **Step 3: 添加 extractJson 辅助方法**

```java
private String extractJson(String text) {
    text = text.trim();
    if (text.startsWith("```")) {
        int start = text.indexOf('\n');
        int end = text.lastIndexOf("```");
        if (start > 0 && end > start) {
            text = text.substring(start, end).trim();
        }
    }
    return text;
}
```

- [ ] **Step 4: 改造 generateEvent 方法 — 添加 LLM 分支 + JSON 解析**

完整替换 `generateEvent` 方法：

```java
public Map<String, Object> generateEvent(UserSession session, Node currentNode,
                                          UserCharacter character, String eventType) {
    // 1. 先试 LLM
    if (llmApiKey != null && !llmApiKey.isEmpty()) {
        try {
            return generateEventWithLlm(session, currentNode, character, eventType);
        } catch (Exception e) {
            log.warn("LLM event generation failed, falling back to stub: {}", e.getMessage());
        }
    }
    // 2. LLM 不可用或失败 → 回退 stub
    return generateEventStub(character, eventType);
}

@SuppressWarnings("unchecked")
private Map<String, Object> generateEventWithLlm(UserSession session, Node currentNode,
                                                  UserCharacter character, String eventType) {
    Novel novel = novelMapper.selectById(session.getNovelId());
    String worldView = novel != null ? novel.getWorldView() : "";
    int sector = new Random().nextInt(6);
    String[] sectorNames = {"奇遇", "宝箱", "战斗", "诅咒", "命运", "邂逅"};
    String sectorName = sectorNames[sector];

    String prompt = "你是一个互动故事的事件生成器，正在为以下世界观生成随机事件。\n\n"
        + "【世界观】\n" + (worldView != null ? worldView : "未知") + "\n\n"
        + "【当前场景】\n" + currentNode.getTitle() + " — " + currentNode.getDescription() + "\n\n"
        + "【角色状态】\n"
        + "HP=" + character.getHp() + ", 攻击=" + character.getAttack()
        + ", 防御=" + character.getDefense() + "\n"
        + "悟性=" + character.getIntelligence() + ", 魅力=" + character.getCharm()
        + ", 气运=" + character.getLuck() + "\n\n"
        + "【扇区类型】\n" + sectorName + "\n\n"
        + "请生成一个符合世界观、有沉浸感的事件，严格返回以下 JSON 格式（不要 markdown 代码块标记，不要额外内容）：\n\n"
        + "{\n"
        + "  \"title\": \"事件标题\",\n"
        + "  \"content\": \"事件描述\",\n"
        + "  \"hpChange\": 整数,\n"
        + "  \"attackChange\": 整数,\n"
        + "  \"defenseChange\": 整数,\n"
        + "  \"intelligenceChange\": 整数,\n"
        + "  \"charmChange\": 整数,\n"
        + "  \"luckChange\": 整数\n"
        + "}\n\n"
        + "各扇区基调：\n"
        + "- 奇遇 → 惊喜、机缘、发现\n"
        + "- 宝箱 → 收获、资源、装备\n"
        + "- 战斗 → 激烈、危险、搏斗\n"
        + "- 诅咒 → 压抑、负面、阴影\n"
        + "- 命运 → 玄妙、转折、因果\n"
        + "- 邂逅 → 温暖、相遇、羁绊\n\n"
        + "要求：\n"
        + "- title：带情绪/氛围的标题（如「暗影突袭」「天降机缘」「古道遇险」）\n"
        + "- content：500-1000 字，像小说段落一样丰富，有场景描写、氛围渲染、细节刻画\n"
        + "- HP 变化范围 -30 到 +30，其他属性 -5 到 +5\n"
        + "- 正面扇区属性变化多为正，负面多为负\n"
        + "- 当前 HP 低时伤害相应减小（避免秒杀）\n"
        + "- 数值合理，符合世界观逻辑";

    LlmResult llmResult = callLlm(prompt);
    if (llmResult.error != null) {
        throw new RuntimeException(llmResult.error);
    }

    String json = extractJson(llmResult.text);
    Map<String, Object> parsed = objectMapper.readValue(json, Map.class);

    Map<String, Object> result = new HashMap<>();
    result.put("title", parsed.getOrDefault("title", sectorName + "事件"));
    result.put("content", parsed.getOrDefault("content", "发生了未知事件。"));
    result.put("hpChange", getInt(parsed.get("hpChange")));
    result.put("atkChange", getInt(parsed.get("attackChange")));
    result.put("defChange", getInt(parsed.get("defenseChange")));
    result.put("intChange", getInt(parsed.get("intelligenceChange")));
    result.put("chaChange", getInt(parsed.get("charmChange")));
    result.put("lukChange", getInt(parsed.get("luckChange")));
    return result;
}

private int getInt(Object value) {
    if (value instanceof Number) return ((Number) value).intValue();
    return 0;
}
```

- [ ] **Step 5: 将原 generateEvent 方法体重命名为 generateEventStub 作为降级**

```java
public Map<String, Object> generateEventStub(UserCharacter character, String eventType) {
    int sector = new Random().nextInt(6);
    Map<String, Object> result = new HashMap<>();
    String title, content;
    int hp=0, atk=0, def=0, inte=0, cha=0, luk=0;

    switch (sector) {
        case 0:
            title = "✨ 奇遇";
            content = "命运的齿轮悄然转动，你在一处不经意的地方发现了一段古老的铭文。"
                + "虽然无法完全理解，但你的悟性似乎得到了启发。";
            inte = 1 + new Random().nextInt(3);
            luk = 1 + new Random().nextInt(3);
            break;
        case 1:
            title = "💎 宝箱";
            content = "你发现了一个被遗忘的宝箱！打开后，里面有一些珍贵的物资和装备。"
                + "这让你在接下来的旅程中更有底气。";
            atk = 1 + new Random().nextInt(3);
            def = 1 + new Random().nextInt(3);
            luk = 1;
            break;
        case 2:
            title = "⚔️ 战斗";
            content = "一阵腥风扑面而来，你遭到了袭击！经过一番激烈的搏斗，"
                + "你虽然受了伤，但也从战斗中积累了宝贵的经验。";
            hp = -(10 + new Random().nextInt(10));
            atk = 1 + new Random().nextInt(2);
            def = 1;
            break;
        case 3:
            title = "💀 诅咒";
            content = "你触碰了不该碰的东西——一股阴冷的能量沿着手臂蔓延。"
                + "你感到自己的气运在流逝，必须尽快找到化解之法。";
            hp = -(5 + new Random().nextInt(10));
            inte = -(1 + new Random().nextInt(3));
            luk = -(1 + new Random().nextInt(3));
            break;
        case 4:
            title = "🌀 命运";
            content = "一位神秘的占卜师出现在你面前，她凝视着你，目光仿佛穿透了时空。"
                + "「你的命运……正在改变。」她留下这句话后便消失了。";
            luk = 2 + new Random().nextInt(4);
            inte = 1;
            break;
        default:
            title = "💕 邂逅";
            content = "你遇到了一位友善的旅人。你们相谈甚欢，临别时他/她送给你一些补给，"
                + "并为你指了一条更安全的路。";
            cha = 1 + new Random().nextInt(3);
            hp = 5 + new Random().nextInt(10);
            break;
    }

    result.put("title", title);
    result.put("content", content);
    result.put("hpChange", hp);
    result.put("atkChange", atk);
    result.put("defChange", def);
    result.put("intChange", inte);
    result.put("chaChange", cha);
    result.put("lukChange", luk);
    return result;
}
```

- [ ] **Step 6: 移除不再需要的旧 generateEvent 方法体**

确认原来的 `generateEvent` 方法已被替换为「先 LLM 后 stub」的两段式结构，不再有单一 switch-case 占位。

---

### Task 2: StoryChain — LLM 调用 + 故事/结局生成

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/StoryChain.java`

- [ ] **Step 1: 添加依赖注入字段**

```java
import com.novel.simulator.mapper.NovelMapper;
import com.novel.simulator.entity.Novel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import java.time.Duration;

@Service
public class StoryChain {
    private static final Logger log = LoggerFactory.getLogger(StoryChain.class);

    private final NovelMapper novelMapper;
    private final ObjectMapper objectMapper;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public StoryChain(NovelMapper novelMapper, ObjectMapper objectMapper) {
        this.novelMapper = novelMapper;
        this.objectMapper = objectMapper;
    }
```

- [ ] **Step 2: 添加 callLlm 辅助方法**

```java
private static class LlmResult {
    String text;
    String error;

    static LlmResult success(String text) { LlmResult r = new LlmResult(); r.text = text; return r; }
    static LlmResult error(String msg) { LlmResult r = new LlmResult(); r.error = msg; return r; }
}

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
        log.warn("LLM call failed: {}", e.getMessage());
        return LlmResult.error(e.getMessage());
    }
}
```

- [ ] **Step 3: 改造 generateStory — LLM 分支 + stub 降级**

完整替换 `generateStory` 方法：

```java
public String generateStory(UserSession session, Node currentNode,
                            UserCharacter character, String actionDescription) {
    // 1. 先试 LLM
    if (llmApiKey != null && !llmApiKey.isEmpty()) {
        try {
            return generateStoryWithLlm(session, currentNode, character, actionDescription);
        } catch (Exception e) {
            log.warn("LLM story generation failed, falling back to stub: {}", e.getMessage());
        }
    }
    // 2. 降级 stub
    return generateStoryStub(currentNode, character, actionDescription);
}

private String generateStoryWithLlm(UserSession session, Node currentNode,
                                    UserCharacter character, String actionDescription) {
    Novel novel = novelMapper.selectById(session.getNovelId());
    String worldView = novel != null ? novel.getWorldView() : "";

    int hp = character.getHp() != null ? character.getHp() : 100;
    int atk = character.getAttack() != null ? character.getAttack() : 10;
    int def = character.getDefense() != null ? character.getDefense() : 10;
    int inte = character.getIntelligence() != null ? character.getIntelligence() : 50;
    int cha = character.getCharm() != null ? character.getCharm() : 50;
    int luk = character.getLuck() != null ? character.getLuck() : 50;
    int choices = character.getChoicesMade() != null ? character.getChoicesMade() : 0;

    String prompt = "你是一个互动叙事大师，正在创作一部根据以下世界观改编的互动故事。\n\n"
        + "【世界观】\n" + (worldView != null ? worldView : "未知") + "\n\n"
        + "【当前场景】\n"
        + "节点：" + currentNode.getTitle() + "\n"
        + "描述：" + (currentNode.getDescription() != null ? currentNode.getDescription() : "") + "\n\n"
        + "【角色状态】\n"
        + "气血(" + hp + "/100) | 攻击(" + atk + ") | 防御(" + def + ")\n"
        + "悟性(" + inte + ") | 魅力(" + cha + ") | 气运(" + luk + ")\n"
        + "已做出 " + choices + " 次选择\n\n"
        + (actionDescription != null && !actionDescription.isEmpty()
            ? "【事件】\n" + actionDescription + "\n\n"
            : "")
        + "请根据以上信息，写一段 300-500 字的故事叙述。要求：\n"
        + "1. 以第二人称\"你\"叙述，代入感强\n"
        + "2. 融入世界观设定，让玩家感觉身临其境\n"
        + "3. 角色属性值影响叙述方向：\n"
        + "   - HP 低 → 描写伤势、疲惫、艰难前行\n"
        + "   - 悟性高 → 描写洞察、思考、发现线索\n"
        + "   - 魅力高 → 描写人际互动、他人反应\n"
        + "   - 气运高 → 描写机缘巧合、好运\n"
        + "4. 语言精彩生动，善用比喻和细节描写，避免平淡叙述\n"
        + "5. 不要出现\"你做出了选择\"这类元描述\n"
        + "6. 【事件】存在时，以事件描述为基础展开叙述，将事件结果自然地融入故事中\n"
        + "7. 结尾要有余韵和期待感，自然过渡到下一步";

    LlmResult llmResult = callLlm(prompt);
    if (llmResult.error != null) {
        throw new RuntimeException(llmResult.error);
    }
    return llmResult.text;
}
```

- [ ] **Step 4: 改造 generateEnding — LLM 分支 + stub 降级**

```java
public String generateEnding(UserSession session, UserCharacter character) {
    if (llmApiKey != null && !llmApiKey.isEmpty()) {
        try {
            return generateEndingWithLlm(session, character);
        } catch (Exception e) {
            log.warn("LLM ending generation failed, falling back to stub: {}", e.getMessage());
        }
    }
    return generateEndingStub(session, character);
}

private String generateEndingWithLlm(UserSession session, UserCharacter character) {
    Novel novel = novelMapper.selectById(session.getNovelId());
    String worldView = novel != null ? novel.getWorldView() : "";

    int hp = character.getHp() != null ? character.getHp() : 100;
    int atk = character.getAttack() != null ? character.getAttack() : 10;
    int def = character.getDefense() != null ? character.getDefense() : 10;
    int inte = character.getIntelligence() != null ? character.getIntelligence() : 50;
    int cha = character.getCharm() != null ? character.getCharm() : 50;
    int luk = character.getLuck() != null ? character.getLuck() : 50;
    int choices = character.getChoicesMade() != null ? character.getChoicesMade() : 0;
    int events = character.getEventsTriggered() != null ? character.getEventsTriggered() : 0;

    String prompt = "你是一个互动叙事大师，为以下冒险旅程写一个精彩的结局总结。\n\n"
        + "【世界观】\n" + (worldView != null ? worldView : "未知") + "\n\n"
        + "【角色最终状态】\n"
        + "气血(" + hp + "/100) | 攻击(" + atk + ") | 防御(" + def + ")\n"
        + "悟性(" + inte + ") | 魅力(" + cha + ") | 气运(" + luk + ")\n"
        + "共做出 " + choices + " 次选择，经历了 " + events + " 次事件\n\n"
        + "【完整冒险历程】\n"
        + (session.getStoryText() != null ? session.getStoryText() : "") + "\n\n"
        + "请写一段 200-300 字的结局叙述，要求：\n"
        + "1. 回顾玩家的冒险历程，呼应关键节点\n"
        + "2. 根据角色最终状态决定结局基调：\n"
        + "   - HP 高 → 安然圆满\n"
        + "   - HP 中等 → 虽有遗憾但坚持到底\n"
        + "   - HP 低 → 壮烈/悲壮\n"
        + "3. 融入世界观设定，让结局有意义\n"
        + "4. 语言富有感染力，给玩家留下深刻印象";

    LlmResult llmResult = callLlm(prompt);
    if (llmResult.error != null) {
        throw new RuntimeException(llmResult.error);
    }
    return llmResult.text;
}
```

- [ ] **Step 5: 将原 generateStory 方法体重命名为 generateStoryStub**

```java
public String generateStoryStub(Node currentNode, UserCharacter character, String actionDescription) {
    StringBuilder sb = new StringBuilder();
    if (currentNode.getDescription() != null && !currentNode.getDescription().isEmpty()) {
        sb.append(currentNode.getDescription()).append("\n\n");
    }
    if (actionDescription != null && !actionDescription.isEmpty()) {
        sb.append(actionDescription).append("\n\n");
    }
    int hp = character.getHp() != null ? character.getHp() : 100;
    if (hp > 80) {
        sb.append("你感到状态很好，精力充沛。");
    } else if (hp > 50) {
        sb.append("你有些疲惫，但还能继续前行。");
    } else if (hp > 30) {
        sb.append("你伤痕累累，每一步都比前一步更加沉重。");
    } else {
        sb.append("你几乎耗尽了所有力气，全凭意志力在支撑。");
    }
    int choices = character.getChoicesMade() != null ? character.getChoicesMade() : 0;
    if (choices > 0 && choices % 3 == 0) {
        sb.append(" 经历了这么多次抉择，你比最初成熟了许多。");
    }
    sb.append("\n\n你整理了一下思绪，继续向前走去。");
    return sb.toString();
}
```

- [ ] **Step 6: 将原 generateEnding 方法体重命名为 generateEndingStub**

```java
public String generateEndingStub(UserSession session, UserCharacter character) {
    StringBuilder sb = new StringBuilder();
    sb.append("你的冒险落下了帷幕。\n\n");
    String fullStory = session.getStoryText();
    if (fullStory != null && !fullStory.isEmpty()) {
        sb.append("回忆这一路走来，");
        if (fullStory.length() > 200) {
            sb.append(fullStory.substring(0, 200)).append("……");
        } else {
            sb.append(fullStory);
        }
        sb.append("\n\n");
    }
    int choices = character.getChoicesMade() != null ? character.getChoicesMade() : 0;
    int events = character.getEventsTriggered() != null ? character.getEventsTriggered() : 0;
    sb.append("你一共做出了 ").append(choices).append(" 次选择，经历了 ").append(events).append(" 次事件。\n");
    int hp = character.getHp() != null ? character.getHp() : 100;
    if (hp > 60) {
        sb.append("虽然旅程充满艰辛，但你最终安然无恙地走到了终点。");
    } else if (hp > 20) {
        sb.append("这一路让你遍体鳞伤，但你终究坚持到了最后。");
    } else {
        sb.append("你几乎耗尽了一切——但有些东西，比生命更重要。");
    }
    return sb.toString();
}
```

---

### Task 3: PlayerController — 无需改动

**Files:** 无

**设计说明：** StoryChain 和 EventChain 各自注入 `NovelMapper`，在方法内部通过 `session.getNovelId()` 查询 `Novel` 表获取 `worldView`。PlayerController 和 ActionEngine 的方法签名均不需要变化。

- [ ] **Step 1: 确认无改动**

验证 `PlayerController.java` 和 `ActionEngine.java` 的调用代码无需修改：
- `storyChain.generateStory(session, currentNode, character, description)` — 方法签名不变 ✅
- `storyChain.generateEnding(session, character)` — 方法签名不变 ✅
- `eventChain.generateEvent(session, currentNode, character, null)` — 方法签名不变 ✅

---

### Task 4: 验证构建

- [ ] **Step 1: 编译检查**

```bash
cd D:/project/novel-simulator
mvn compile -q
```

Expected: 编译成功，无报错。如果失败，检查 import 遗漏、方法签名不匹配、类型转换问题。

- [ ] **Step 2: 确认 fallback 逻辑**

检查 `EventChain.java`：
- `llmApiKey` 为空 → `generateEvent` 走 `generateEventStub` ✅
- `llmApiKey` 有值但调用异常 → catch 到异常后走 `generateEventStub` ✅

检查 `StoryChain.java`：
- `llmApiKey` 为空 → `generateStory`/`generateEnding` 走 stub ✅
- `llmApiKey` 有值但调用异常 → catch 后走 stub ✅

- [ ] **Step 3: 提交**

```bash
git add src/main/java/com/novel/simulator/service/StoryChain.java \
        src/main/java/com/novel/simulator/service/EventChain.java \
        src/main/java/com/novel/simulator/controller/PlayerController.java
git commit -m "feat: P3-C LLM deep participation - StoryChain and EventChain call real LLM with stub fallback"
```

---

## 不涉及改动的确认

| 模块 | 原因 |
|------|------|
| `ActionEngine.java` | 只调 EventChain.generateEvent()，方法签名不变 |
| `ParseChain.java` | 已用 LLM，不改 |
| 前端代码 | 无改动 |
| 数据库 | 无改动 |
| `application.yml` | LLM 配置已有 |
