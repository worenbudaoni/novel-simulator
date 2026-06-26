# 因果链 v2 — 游戏流程连贯性重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通因果链：关联属性由 LLM 标注、数值由 LLM 根据情境生成、DC 关联节点危险度、去转盘、统一三 Chain 上下文、StoryChain system prompt 动态更新。

**Architecture:** 新增 SessionContext（Redis 共享上下文对象）；OptionChain 输出 checkAttr；ActionEngine d20 用 checkAttr + node.dangerLevel 算 DC；EventChain 去掉扇区转盘，改收 success/checkAttr/choiceLabel 生成事件+数值；StoryChain 每次调用重建 system prompt。LLM 不可用直接报错。

**Tech Stack:** Spring Boot 2.6.13, MyBatisPlus, Redis, LangChain4j, React + Vite + TypeScript + shadcn/ui

## Global Constraints

- node 表新增 danger_level TINYINT(3) 字段，默认 3
- OptionVO 新增 checkAttr 字段，合法值: {intelligence, charm, attack, defense, luck}
- ResolutionResult 新增 choiceLabel，删除 sector
- LLM 不可用时报错不打底（移除所有 stub）
- 删除 WheelOfFortune 组件及所有引用
- 事件内容不拼接进 storyText

---

### Task 1: Node 实体 + 数据库 schema 加 dangerLevel 字段

**Files:**
- Modify: `src/main/java/com/novel/simulator/entity/Node.java`
- Modify: `sql/01-ddl.sql`

**Interfaces:**
- Produces: `Node.getDangerLevel()` / `Node.setDangerLevel(Integer)` — 供 ActionEngine 读 DC 计算用

- [ ] **Step 1: 在 Node.java 添加 dangerLevel 字段**

在 `Node.java` 的 `sortOrder` 字段后添加：

```java
private Integer dangerLevel;

public Integer getDangerLevel() { return dangerLevel; }
public void setDangerLevel(Integer dangerLevel) { this.dangerLevel = dangerLevel; }
```

- [ ] **Step 2: 在 DDL 添加 danger_level 列**

在 `sql/01-ddl.sql` 的 node 表定义中，在 `sort_order` 后添加：

```sql
danger_level TINYINT DEFAULT 3 COMMENT '节点危险度 1-5',
```

- [ ] **Step 3: 执行数据库 ALTER（如已有数据库）**

```bash
# 连接 MySQL 执行
ALTER TABLE node ADD COLUMN danger_level TINYINT DEFAULT 3 COMMENT '节点危险度 1-5';
```

- [ ] **Step 4: 验证 Node 实体编译通过**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/entity/Node.java sql/01-ddl.sql
git commit -m "feat: add dangerLevel field to Node entity and DDL"
```

---

### Task 2: OptionVO 添加 checkAttr 字段

**Files:**
- Modify: `src/main/java/com/novel/simulator/dto/OptionVO.java`

**Interfaces:**
- Produces: `OptionVO.getCheckAttr()` / `OptionVO.setCheckAttr(String)` — 前端传回 resolve API

- [ ] **Step 1: 在 OptionVO.java 添加 checkAttr 字段**

在 `expectedOutcome` 字段后添加：

```java
private String checkAttr;        // "intelligence"|"charm"|"attack"|"defense"|"luck"

public String getCheckAttr() { return checkAttr; }
public void setCheckAttr(String checkAttr) { this.checkAttr = checkAttr; }
```

- [ ] **Step 2: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/OptionVO.java
git commit -m "feat: add checkAttr field to OptionVO"
```

---

### Task 3: ResolutionResult 添加 choiceLabel，删除 sector

**Files:**
- Modify: `src/main/java/com/novel/simulator/dto/ResolutionResult.java`

**Interfaces:**
- Produces: `ResolutionResult.getChoiceLabel()` / `ResolutionResult.setChoiceLabel(String)` — StoryChain 用

- [ ] **Step 1: 添加 choiceLabel，删除 sector**

在 `ResolutionResult.java` 中，添加 choiceLabel 字段和 getter/setter；删除 sector 字段和 getter/setter。

修改后文件（仅列出变更部分）：

```java
// 在 riskLevel 字段区域后添加
private String choiceLabel;          // 玩家选择的选项文案

// 删除 sector 字段（约 line 37）
// private int sector;               ← 删除此行
// public int getSector() { ... }    ← 删除此 getter
// public void setSector(int sector) { ... }  ← 删除此 setter

// 新增 getter/setter
public String getChoiceLabel() { return choiceLabel; }
public void setChoiceLabel(String choiceLabel) { this.choiceLabel = choiceLabel; }
```

- [ ] **Step 2: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

Expected: BUILD SUCCESS（可能的编译错误在后续 Task 修复）

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/ResolutionResult.java
git commit -m "feat: add choiceLabel to ResolutionResult, remove sector field"
```

---

### Task 4: EventChain — 删除扇区转盘，新方法签名

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/EventChain.java`

**Interfaces:**
- Consumes: SessionContext（Task 8 创建后回填）
- Produces: `generateEvent(session, node, character, riskLevel, success, checkAttr, choiceLabel)` — 供 ActionEngine 调用

**改造���:**
1. `generateEvent()` 方法签名增加 `Boolean success`, `String checkAttr`, `String choiceLabel` 参数
2. 删除 sector 随机逻辑（`int sector = new Random().nextInt(6)` 及 6 扇区名数组）
3. LLM prompt：按 success/checkAttr 调整风险上下文，删除扇区相关文字
4. stub 方法删除（改为直接 throw RuntimeException）

- [ ] **Step 1: 修改 generateEvent 方法签名**

将 `generateEvent(UserSession session, Node currentNode, UserCharacter character, String riskLevel)` 改为：

```java
public Map<String, Object> generateEvent(UserSession session, Node currentNode,
                                          UserCharacter character, String riskLevel,
                                          Boolean success, String checkAttr, String choiceLabel) {
    // LLM 不可用直接报错
    if (llmApiKey == null || llmApiKey.isEmpty()) {
        throw new RuntimeException("LLM API Key 未配置，无法生成事件");
    }
    try {
        return generateEventWithLlm(session, currentNode, character, riskLevel, success, checkAttr, choiceLabel);
    } catch (Exception e) {
        throw new RuntimeException("事件生成失败: " + e.getMessage());
    }
}
```

- [ ] **Step 2: 重写 generateEventWithLlm**（核心修改）

关键变更：删除 sector 随机；修改 prompt 按 success/checkAttr 约束输出。

```java
private Map<String, Object> generateEventWithLlm(UserSession session, Node currentNode,
                                                  UserCharacter character, String riskLevel,
                                                  Boolean success, String checkAttr, String choiceLabel) {
    Novel novel = novelMapper.selectById(session.getNovelId());
    String worldView = novel != null ? novel.getWorldView() : "";
    String novelTitle = novel != null ? novel.getTitle() : "";

    // 读取 SessionContext（如 Task 8 未完成，此处暂时注释，后续回填）
    String storyContext = "";
    try {
        String ctxJson = redisTemplate.opsForValue().get(
            HISTORY_KEY_PREFIX + session.getSessionId() + ":context");
        if (ctxJson != null && !ctxJson.isEmpty()) {
            // Parse SessionContext from JSON (Task 8 provides SessionContextService)
        }
    } catch (Exception e) { /* ignore */ }

    int hp = character.getHp() != null ? character.getHp() : 100;
    int atk = character.getAttack() != null ? character.getAttack() : 10;
    int def = character.getDefense() != null ? character.getDefense() : 10;
    int inte = character.getIntelligence() != null ? character.getIntelligence() : 50;
    int cha = character.getCharm() != null ? character.getCharm() : 50;
    int luk = character.getLuck() != null ? character.getLuck() : 50;

    String riskContext;
    if ("risky".equals(riskLevel) && success != null) {
        riskContext = success
            ? "玩家冒险尝试「" + choiceLabel + "」，检定成功。"
              + "请生成一个正面事件，大幅提升 " + checkAttr + " 属性。"
            : "玩家冒险尝试「" + choiceLabel + "」，检定失败。"
              + "请生成一个负面事件，削弱 " + checkAttr + " 属性。";
    } else {
        riskContext = "玩家做出了高风险选择「" + choiceLabel + "」。"
            + "当前运气值: " + luk + "/100。运气高→结果偏向正面，运气低→结果偏向负面。";
    }

    String prompt = "你是一个严格遵循原作的互动故事事件生成器。\n\n"
        + "【作品名称】\n" + (novelTitle != null ? novelTitle : "未知") + "\n\n"
        + "【世界观·设定】\n" + (worldView != null && !worldView.isEmpty() ? worldView : "未知") + "\n\n"
        + "【当前场景】\n" + (currentNode.getTitle() != null ? currentNode.getTitle() : "未知")
        + " — " + (currentNode.getDescription() != null ? currentNode.getDescription() : "") + "\n\n"
        + "【角色状态】\n"
        + "HP=" + hp + ", 攻击=" + atk + ", 防御=" + def + "\n"
        + "悟性=" + inte + ", 魅力=" + cha + ", 气运=" + luk + "\n\n"
        + "【事件方向】\n" + riskContext + "\n\n"
        + (!storyContext.isEmpty()
            ? "【最近的故事进展】\n" + storyContext + "\n\n" : "")
        + "请生成一个严格符合该作品世界观的事件，返回以下 JSON 格式（不要 markdown 代码块）：\n\n"
        + "{\n"
        + "  \"title\": \"事件标题\",\n"
        + "  \"content\": \"事件描述(500-1000字)\",\n"
        + "  \"hpChange\": 整数,\n"
        + "  \"attackChange\": 整数,\n"
        + "  \"defenseChange\": 整数,\n"
        + "  \"intelligenceChange\": 整数,\n"
        + "  \"charmChange\": 整数,\n"
        + "  \"luckChange\": 整数\n"
        + "}\n\n"
        + "【必须遵守的规则】\n"
        + "- 所有内容严格限定在《" + (novelTitle != null ? novelTitle : "该作品") + "》的世界观内\n"
        + "- 禁止出现该作品中不存在的人物、地点、概念\n"
        + "- risky 成功: HP+5~20, " + (checkAttr != null ? checkAttr : "属性") + "+2~5\n"
        + "- risky 失败: HP-5~25, " + (checkAttr != null ? checkAttr : "属性") + "-1~4\n"
        + "- daring: HP±10~30, 多属性变化, 受运气偏向\n"
        + "- 当前 HP 低时伤害减小\n";

    LlmResult llmResult = callLlm(prompt);
    if (llmResult.error != null) throw new RuntimeException(llmResult.error);

    String json = extractJson(llmResult.text);
    Map<String, Object> parsed;
    try {
        parsed = objectMapper.readValue(json, Map.class);
    } catch (Exception e) {
        throw new RuntimeException("JSON parse failed: " + e.getMessage());
    }

    Map<String, Object> result = new HashMap<>();
    result.put("title", parsed.getOrDefault("title", "未知事件"));
    result.put("content", parsed.getOrDefault("content", "发生了未知事件。"));
    result.put("hpChange", getInt(parsed.get("hpChange")));
    result.put("attackChange", getInt(parsed.get("attackChange")));
    result.put("defenseChange", getInt(parsed.get("defenseChange")));
    result.put("intelligenceChange", getInt(parsed.get("intelligenceChange")));
    result.put("charmChange", getInt(parsed.get("charmChange")));
    result.put("luckChange", getInt(parsed.get("luckChange")));
    return result;
}
```

- [ ] **Step 3: 删除 generateEventStub 方法**

删除 `generateEventStub()` 方法的完整实现（约 65 行）。

- [ ] **Step 4: 确保 ActionEngine.java 调用处与旧参数兼容（临时编译修复）**

搜索 `EventChain.java` 内的旧参数调用方式 `eventChain.generateEvent(`，确保没有残留代码调用 4 参数版本。如有（如在 ActionEngine 未修改的情况下），暂时注释或调整。

- [ ] **Step 5: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

Expected: BUILD SUCCESS（如 ActionEngine 有编译错误属正常，Task 6 会修复）

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/novel/simulator/service/EventChain.java
git commit -m "feat: remove sector lottery from EventChain, new signature with success/checkAttr/choiceLabel, no stub"
```

---

### Task 5: OptionChain — 输出 checkAttr + 读 SessionContext

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/OptionChain.java`

**改造点:**
1. `buildPrompt()` 中要求 LLM 输出 checkAttr 字段
2. `loadRecentContext()` 改为读 SessionContext
3. 校验 checkAttr 合法性

- [ ] **Step 1: 修改 buildPrompt 中的 JSON 输出格式**

在 `buildPrompt()` 方法末尾，修改返回格式示例和约束要求：

将现有的返回格式示例部分（prompt 末尾）替换为：

```java
+ "返回格式示例：\n"
+ "[\n"
+ "  {\"label\":\"...\",\"targetNodeId\":1,\"riskLevel\":\"safe\",\"checkAttr\":\"intelligence\",\"attrHint\":\"\",\"expectedOutcome\":\"稳步推进\"},\n"
+ "  {\"label\":\"...\",\"targetNodeId\":2,\"riskLevel\":\"risky\",\"checkAttr\":\"attack\",\"attrHint\":\"需要一定战力\",\"expectedOutcome\":\"搏斗一番\"},\n"
+ "  {\"label\":\"...\",\"targetNodeId\":3,\"riskLevel\":\"daring\",\"checkAttr\":\"luck\",\"attrHint\":\"极其危险\",\"expectedOutcome\":\"直面危险\"}\n"
+ "]\n\n"
+ "【必须遵守】\n"
+ "- 所有选项内容严格限定在《" + (novelTitle != null ? novelTitle : "该作品") + "》的世界观内\n"
+ "- checkAttr 必须是 intelligence/charm/attack/defense/luck 之一\n"
+ "- 当前场景危险度 " + (nodeDangerLevel != null ? nodeDangerLevel : 3) + "/5，安全/冒险/高危的分布要合理\n"
+ "- 禁止出现原作中不存在的人物、地点、概念或设定";
```

`buildPrompt` 方法签名增加 `int nodeDangerLevel` 参数。

- [ ] **Step 2: 改造 loadRecentContext 读 SessionContext**

将 `loadRecentContext()` 方法改为从 Redis 读 SessionContext（key: `cache:session:{sessionId}:context`），解析 JSON 提取 recentRounds：

```java
private String loadRecentContext(String sessionId) {
    String ctxJson = redisTemplate.opsForValue().get(HISTORY_KEY_PREFIX + sessionId + ":context");
    if (ctxJson == null || ctxJson.isEmpty()) return "";
    try {
        Map<String, Object> ctx = objectMapper.readValue(ctxJson, Map.class);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rounds = (List<Map<String, Object>>) ctx.get("recentRounds");
        if (rounds == null || rounds.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> round : rounds) {
            sb.append("[user] ").append(round.getOrDefault("userAction", "")).append("\n");
            sb.append("[result] ").append(round.getOrDefault("checkResult", "")).append("\n");
            String story = (String) round.getOrDefault("storyText", "");
            if (story.length() > 300) story = story.substring(0, 300) + "…";
            sb.append("[story] ").append(story).append("\n");
        }
        return sb.toString();
    } catch (Exception e) {
        log.warn("Failed to parse SessionContext: {}", e.getMessage());
        return "";
    }
}
```

- [ ] **Step 3: 增加 checkAttr 校验**

在 `generateOptions()` 方法中，对已解析的 options 增加 checkAttr 校验（在 riskLevel 校验之后添加）：

```java
// checkAttr 合法性校验
Set<String> validAttrs = new HashSet<>(Arrays.asList("intelligence", "charm", "attack", "defense", "luck"));
for (OptionVO opt : options) {
    String ca = opt.getCheckAttr();
    if (ca == null || !validAttrs.contains(ca)) {
        opt.setCheckAttr("intelligence");
    }
}
```

- [ ] **Step 4: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/service/OptionChain.java
git commit -m "feat: OptionChain outputs checkAttr, reads SessionContext, enforces worldview constraint"
```

---

### Task 6: ActionEngine — 重写 resolve 逻辑

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/ActionEngine.java`

**改造点:**
1. `resolve()` 增加 `checkAttr` 参数
2. 删除 `detectAttr()` 方法
3. 删除 `pickDC()` 旧实现，改用 dangerLevel 公式
4. `resolveRisky` 改调 EventChain 生成事件+数值
5. `resolveSafe` 加 dangerLevel 影响
6. `resolveDaring` 不传 sector

- [ ] **Step 1: 修改 resolve() 方法签名，增加 checkAttr 参数**

```java
public ResolutionResult resolve(String sessionId, Long targetNodeId,
                                 String choiceLabel, String riskLevel, String checkAttr) {
```

方法内部增加获取 nodeDangerLevel：

```java
// 获取当前节点危险度
Node currentNode = targetNodeId != null ? nodeMapper.selectById(targetNodeId) : null;
int nodeDangerLevel = currentNode != null && currentNode.getDangerLevel() != null
    ? currentNode.getDangerLevel() : 3;
```

- [ ] **Step 2: 修改 resolveSafe，加 dangerLevel 影响**

```java
private ResolutionResult resolveSafe(UserCharacter c, int nodeDangerLevel) {
    int maxHpGain = nodeDangerLevel >= 4 ? 5 : 10;
    int hpGain = ThreadLocalRandom.current().nextInt(maxHpGain) + 5; // 5~10 或 5~7
    c.setHp(Math.min(100, (c.getHp() != null ? c.getHp() : 100) + hpGain));
    // 随机微增一个属性 +1
    String[] attrs = {"attack", "defense", "intelligence", "charm", "luck"};
    String gainAttr = attrs[ThreadLocalRandom.current().nextInt(attrs.length)];
    int oldVal = getAttr(c, gainAttr);
    setAttr(c, gainAttr, oldVal + 1);
    Map<String, Integer> changes = new HashMap<>();
    changes.put("hp", hpGain);
    changes.put(gainAttr, 1);
    ResolutionResult r = new ResolutionResult();
    r.setAttrChanges(changes);
    r.setSuccess(true);
    return r;
}
```

- [ ] **Step 3: 重写 resolveRisky**

```java
private ResolutionResult resolveRisky(UserCharacter c, String choiceLabel,
                                       String checkAttr, int nodeDangerLevel,
                                       UserSession session, Node currentNode) {
    // DC 公式
    int dc;
    switch (nodeDangerLevel) {
        case 1: dc = 8; break;
        case 2: dc = 11; break;
        case 3: dc = 13; break;
        case 4: dc = 15; break;
        case 5: dc = 17; break;
        default: dc = 13;
    }

    int attrValue = getAttr(c, checkAttr);
    int modifier = (attrValue - 50) / 10;
    int roll = ThreadLocalRandom.current().nextInt(1, 21);
    int total = roll + modifier;
    boolean success = total >= dc;

    // 调 EventChain 生成事件+数值
    Map<String, Object> eventData = eventChain.generateEvent(
        session, currentNode, c, "risky", success, checkAttr, choiceLabel);
    String eventTitle = (String) eventData.get("title");
    String eventContent = (String) eventData.get("content");

    Map<String, Integer> changes = new HashMap<>();
    applyEventChanges(c, eventData, changes);
    c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);

    ResolutionResult r = new ResolutionResult();
    r.setCheckAttr(checkAttr);
    r.setAttrValue(attrValue);
    r.setDiceRoll(roll);
    r.setDc(dc);
    r.setModifier(modifier);
    r.setTotal(total);
    r.setSuccess(success);
    r.setAttrChanges(changes);
    r.setEventTitle(eventTitle);
    r.setEventContent(eventContent);
    return r;
}
```

- [ ] **Step 4: 修改 resolveDaring**

```java
private ResolutionResult resolveDaring(UserCharacter c, UserSession session, Node currentNode, String choiceLabel) {
    Map<String, Object> eventData = eventChain.generateEvent(
        session, currentNode, c, "daring", null, null, choiceLabel);
    String eventTitle = (String) eventData.get("title");
    String eventContent = (String) eventData.get("content");

    Map<String, Integer> changes = new HashMap<>();
    applyEventChanges(c, eventData, changes);
    c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);

    ResolutionResult r = new ResolutionResult();
    r.setSuccess(true);
    r.setAttrChanges(changes);
    r.setEventTitle(eventTitle);
    r.setEventContent(eventContent);
    return r;
}
```

- [ ] **Step 5: 删除 detectAttr() 和旧 pickDC() 方法**

删除 `detectAttr(String label)` 方法（约 8 行）和 `pickDC(int attrValue)` 方法（约 6 行）。

- [ ] **Step 6: 更新 resolve 方法内的 switch 调用**

```java
switch (riskLevel != null ? riskLevel : "safe") {
    case "risky":
        result = resolveRisky(character, choiceLabel, checkAttr, nodeDangerLevel, session, currentNode);
        break;
    case "daring":
        result = resolveDaring(character, session, currentNode, choiceLabel);
        break;
    default:
        result = resolveSafe(character, nodeDangerLevel);
        break;
}
```

同时设置 `result.setChoiceLabel(choiceLabel);`

- [ ] **Step 7: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/novel/simulator/service/ActionEngine.java
git commit -m "feat: ActionEngine new DC formula from dangerLevel, EventChain generates values, remove detectAttr"
```

---

### Task 7: StoryChain — 动态 system prompt + 删除 stub

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/StoryChain.java`

**改造点:**
1. `generateStoryWithResolution` 每次重建 system prompt（用最新 node/character）
2. 删除 `generateStoryStub` 等 stub 方法
3. 删除旧 `generateStory(session, node, character, String)` 重载

- [ ] **Step 1: 改造 generateStoryWithResolution，重建 system prompt**

修改该方法：每次调用时，从 SessionContext 读最新 node/character 状态，用 `buildSystemPrompt` 重建 system message，覆盖 history 第一条。

```java
private String generateStoryWithResolution(UserSession session, Node currentNode,
                                            UserCharacter character, ResolutionResult resolution) {
    Novel novel = novelMapper.selectById(session.getNovelId());
    List<Map<String, String>> history = loadHistory(session.getSessionId());

    // 每次重建 system prompt（节点/属性可能已变化）
    String systemPrompt = buildSystemPrompt(novel, currentNode, character);
    Map<String, String> sysMsg = new HashMap<>();
    sysMsg.put("role", "system");
    sysMsg.put("content", systemPrompt);

    if (history.isEmpty() || !"system".equals(history.get(0).get("role"))) {
        history.add(0, sysMsg);
    } else {
        history.set(0, sysMsg); // 替换旧的 system message
    }

    // 构建用户消息（含检定结果 + choiceLabel）
    StringBuilder userContent = new StringBuilder();
    userContent.append("你选择了「").append(resolution.getChoiceLabel()).append("」(")
        .append(resolution.getRiskLevel()).append(")\n\n");
    // ... (existing resolution data format)
    userContent.append("\n请根据以上实际结果续写故事，生动描述发生了什么。");

    // ... (rest of the method unchanged)
}
```

- [ ] **Step 2: 删除 stub 方法**

删除：`generateStoryStub(Node, UserCharacter, String)`, `generateStoryStub(Node, UserCharacter, ResolutionResult)`, `generateEndingStub`。

LLM 不可用时改为在 `generateStory(UserSession, Node, UserCharacter, String)` 中直接抛错：

```java
public String generateStory(UserSession session, Node currentNode,
                             UserCharacter character, String actionDescription) {
    throw new RuntimeException("LLM 未配置，无法生成故事。请检查 LLM API Key。");
}
```

`generateStory(UserSession, Node, UserCharacter, ResolutionResult)` 同理。

- [ ] **Step 3: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/service/StoryChain.java
git commit -m "feat: StoryChain dynamic system prompt on every call, remove all stubs"
```

---

### Task 8: PlayerController — 更新 resolve 端点

**Files:**
- Modify: `src/main/java/com/novel/simulator/controller/PlayerController.java`

**改造点:**
1. `/action/resolve` 端点接收并传递 `checkAttr`
2. `/story/stream` 删除 `description` 回退路径

- [ ] **Step 1: 修改 /action/resolve 端点**

```java
@PostMapping("/action/resolve")
@PreAuthorize("hasAuthority('player:play')")
public Result<ResolutionResult> resolve(@RequestBody Map<String, Object> request) {
    try {
        String sessionIdStr = (String) request.get("sessionId");
        Long targetNodeId = request.get("targetNodeId") != null
            ? Long.valueOf(request.get("targetNodeId").toString()) : null;
        String label = (String) request.get("choiceLabel");
        String riskLevel = (String) request.get("riskLevel");
        String checkAttr = (String) request.getOrDefault("checkAttr", "intelligence");
        ResolutionResult result = actionEngine.resolve(sessionIdStr, targetNodeId, label, riskLevel, checkAttr);
        return Result.success(result);
    } catch (Exception e) {
        log.warn("ActionEngine.resolve error: {}", e.getMessage());
        return Result.error(500, e.getMessage());
    }
}
```

- [ ] **Step 2: /story/stream 删除 description 回退**

删除 `description` query parameter 及相关的 `generateStory(session, node, character, description)` 调用。当 resolution 为 null 时，返回 error。

```java
// 修改 streamStory 方法中的 resolution 读取逻辑
if (resolution != null) {
    story = storyChain.generateStory(session, currentNode, character, resolution);
} else {
    emitter.send(SseEmitter.event().name("error").data("无有效检定结果，请重新选择"));
    emitter.complete();
    return emitter;
}
```

- [ ] **Step 3: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/controller/PlayerController.java
git commit -m "feat: PlayerController passes checkAttr to ActionEngine, removes description fallback"
```

---

### Task 9: 后端 SessionContext 上下文管理

**Files:**
- Create: `src/main/java/com/novel/simulator/service/SessionContextService.java`

**Interfaces:**
- Produces: `buildContext(sessionId)` — 重建上下文；`appendRound(sessionId, round)` — 追加一轮

- [ ] **Step 1: 创建 SessionContextService**

```java
package com.novel.simulator.service;

@Service
public class SessionContextService {
    private static final String KEY_PREFIX = "cache:session:";
    private static final String KEY_SUFFIX = ":context";
    private static final int MAX_ROUNDS = 6;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final NovelMapper novelMapper;
    private final NodeMapper nodeMapper;
    private final UserCharacterMapper userCharacterMapper;

    // constructor injection

    public void buildContext(UserSession session) {
        Novel novel = novelMapper.selectById(session.getNovelId());
        Node node = nodeMapper.selectById(session.getCurrentNodeId());
        UserCharacter character = userCharacterMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, session.getSessionId()));

        Map<String, Object> ctx = new HashMap<>();
        ctx.put("worldview", novel != null ? novel.getWorldView() : "");
        ctx.put("novelTitle", novel != null ? novel.getTitle() : "");
        ctx.put("currentNodeId", node != null ? node.getId() : 0);
        ctx.put("currentNodeTitle", node != null ? node.getTitle() : "");
        ctx.put("currentNodeDescription", node != null ? node.getDescription() : "");
        ctx.put("nodeDangerLevel", node != null && node.getDangerLevel() != null ? node.getDangerLevel() : 3);

        Map<String, Integer> charMap = new HashMap<>();
        if (character != null) {
            charMap.put("hp", character.getHp());
            charMap.put("attack", character.getAttack());
            charMap.put("defense", character.getDefense());
            charMap.put("intelligence", character.getIntelligence());
            charMap.put("charm", character.getCharm());
            charMap.put("luck", character.getLuck());
        }
        ctx.put("character", charMap);
        ctx.put("recentRounds", new ArrayList<>());

        try {
            String json = objectMapper.writeValueAsString(ctx);
            redisTemplate.opsForValue().set(KEY_PREFIX + session.getSessionId() + KEY_SUFFIX, json, 24, TimeUnit.HOURS);
        } catch (Exception e) {
            // log
        }
    }

    public void appendRound(String sessionId, String userAction, String checkResult, String storyText) {
        try {
            String json = redisTemplate.opsForValue().get(KEY_PREFIX + sessionId + KEY_SUFFIX);
            if (json == null) return;
            @SuppressWarnings("unchecked")
            Map<String, Object> ctx = objectMapper.readValue(json, Map.class);
            List<Map<String, String>> rounds = (List<Map<String, String>>) ctx.getOrDefault("recentRounds", new ArrayList<>());
            Map<String, String> round = new HashMap<>();
            round.put("userAction", userAction);
            round.put("checkResult", checkResult);
            round.put("storyText", storyText);
            rounds.add(round);
            // 修剪到 MAX_ROUNDS
            while (rounds.size() > MAX_ROUNDS) rounds.remove(0);
            ctx.put("recentRounds", rounds);
            redisTemplate.opsForValue().set(KEY_PREFIX + sessionId + KEY_SUFFIX, objectMapper.writeValueAsString(ctx), 24, TimeUnit.HOURS);
        } catch (Exception e) {
            // log
        }
    }

    public void updateNode(String sessionId, Long newNodeId) {
        // 节点切换时更新 currentNode 字段
        try {
            String json = redisTemplate.opsForValue().get(KEY_PREFIX + sessionId + KEY_SUFFIX);
            if (json == null) return;
            Map<String, Object> ctx = objectMapper.readValue(json, Map.class);
            Node node = nodeMapper.selectById(newNodeId);
            if (node != null) {
                ctx.put("currentNodeId", node.getId());
                ctx.put("currentNodeTitle", node.getTitle());
                ctx.put("currentNodeDescription", node.getDescription());
                ctx.put("nodeDangerLevel", node.getDangerLevel() != null ? node.getDangerLevel() : 3);
            }
            redisTemplate.opsForValue().set(KEY_PREFIX + sessionId + KEY_SUFFIX, objectMapper.writeValueAsString(ctx), 24, TimeUnit.HOURS);
        } catch (Exception e) {
            // log
        }
    }
}
```

- [ ] **Step 2: 在 StoryChain 生成后调用 appendRound**

在 `StoryChain.generateStoryWithResolution` 末尾，追加：

```java
sessionContextService.appendRound(session.getSessionId(),
    "选择「" + (resolution.getChoiceLabel() != null ? resolution.getChoiceLabel() : "") + "」(" + resolution.getRiskLevel() + ")",
    buildCheckSummary(resolution),
    storyText);
```

- [ ] **Step 3: 编译验证**

```bash
cd d:/project/novel-simulator && mvn compile -q
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/service/SessionContextService.java
git commit -m "feat: SessionContextService for shared context across Chains"
```

---

### Task 10: StoryChain 注入 SessionContextService + 补充 appendRound 逻辑

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/StoryChain.java`

**改造点:**
- 注入 SessionContextService
- generateStoryWithResolution 末尾 appendRound + updateNode

- [ ] **Step 1: 注入 SessionContextService**

在 StoryChain 构造函数中增加 `SessionContextService sessionContextService` 参数。

- [ ] **Step 2: 在生成故事后追加上下文**

在 `generateStoryWithResolution` 方法末尾，return 之前添加：

```java
// 更新 SessionContext
String checkSummary = resolution.getRiskLevel() + " ";
if ("risky".equals(resolution.getRiskLevel()) && resolution.getCheckAttr() != null) {
    checkSummary += "检定: " + resolution.getCheckAttr() + "=" + resolution.getAttrValue()
        + " 骰" + resolution.getDiceRoll() + "+修正" + resolution.getModifier()
        + " vs DC" + resolution.getDc() + " → " + (resolution.isSuccess() ? "成功" : "失败") + " ";
}
if (resolution.getAttrChanges() != null) {
    for (Map.Entry<String, Integer> e : resolution.getAttrChanges().entrySet()) {
        checkSummary += e.getKey() + (e.getValue() >= 0 ? "+" : "") + e.getValue() + " ";
    }
}
sessionContextService.appendRound(session.getSessionId(),
    "选择「" + (resolution.getChoiceLabel() != null ? resolution.getChoiceLabel() : "") + "」(" + resolution.getRiskLevel() + ")",
    checkSummary,
    storyText);
if (resolution.getTargetNodeId() != null) {
    sessionContextService.updateNode(session.getSessionId(), resolution.getTargetNodeId());
}
```

- [ ] **Step 3: 编译验证 + Commit**

```bash
cd d:/project/novel-simulator && mvn compile -q
git add src/main/java/com/novel/simulator/service/StoryChain.java
git commit -m "feat: StoryChain injects SessionContextService, appends rounds after generation"
```

---

### Task 11: 后端清理 — 删除残留 sector 引用

**Files:**
- Search/Modify: `src/main/java/com/novel/simulator/service/ActionEngine.java` (line 208)
- Search/Modify: `src/main/java/com/novel/simulator/service/EventChain.java`
- Search/Modify: `src/main/java/com/novel/simulator/controller/PlayerController.java`

- [ ] **Step 1: 删除 ActionEngine 中 sector 残留**

搜索 ActionEngine.java 中所有 `sector` 相关代码（EventChain 返回值中的 sector 处理），删除：

```diff
- if (eventData.containsKey("sector")) {
-     r.setSector(((Number) eventData.get("sector")).intValue());
- }
```

- [ ] **Step 2: 删除 EventChain.generateEventStub 残留（如 Task 4 中未删干净）**

确认 `generateEventStub` 方法已完全删除。

- [ ] **Step 3: 全局搜索 sector 残留并清理**

```bash
grep -rn "sector" d:/project/novel-simulator/src --include="*.java"
grep -rn "SECTOR" d:/project/novel-simulator/frontend/src --include="*.tsx" --include="*.ts"
```

如发现只读引用（非字段定义），标记为下一步前端清理。

- [ ] **Step 4: 编译验证 + Commit**

```bash
cd d:/project/novel-simulator && mvn compile -q
git add -A
git commit -m "chore: remove all sector references from backend"
```

---

### Task 12: 前端 types 更新

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: ChoiceOption 添加 checkAttr**

```typescript
export interface ChoiceOption {
  id?: number;
  label: string;
  targetNodeId: number;
  riskLevel: 'safe' | 'risky' | 'daring';
  attrHint?: string;
  expectedOutcome?: string;
  checkAttr?: string;  // "intelligence" | "charm" | "attack" | "defense" | "luck"
}
```

- [ ] **Step 2: ResolutionResult 删除 sector，添加 choiceLabel**

```typescript
export interface ResolutionResult {
  actionType: string;
  targetNodeId: number;
  riskLevel: string;
  choiceLabel?: string;  // NEW
  checkAttr?: string;
  attrValue?: number;
  diceRoll?: number;
  dc?: number;
  modifier?: number;
  total?: number;
  success: boolean;
  attrChanges: Record<string, number>;
  isDead: boolean;
  eventTitle?: string;
  eventContent?: string;
  // sector removed
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: update frontend types, add checkAttr to ChoiceOption, add choiceLabel to ResolutionResult, remove sector"
```

---

### Task 13: 前端 useStory — resolveAction 传 checkAttr

**Files:**
- Modify: `frontend/src/hooks/useStory.ts`

- [ ] **Step 1: 修改 resolveAction 传递 checkAttr**

```typescript
const resolveAction = useCallback(async (option: ChoiceOption) => {
    if (!session?.sessionId) return null;
    const res = await api.post('/player/action/resolve', {
      sessionId: session.sessionId,
      targetNodeId: option.targetNodeId,
      choiceLabel: option.label,
      riskLevel: option.riskLevel,
      checkAttr: option.checkAttr || 'intelligence',
    });
    // ... rest unchanged
}, [session, loadNode]);
```

- [ ] **Step 2: 类型检查**

```bash
cd d:/project/novel-simulator/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useStory.ts
git commit -m "feat: pass checkAttr from useStory to resolve API"
```

---

### Task 14: 前端 ChoicePanel — 属性图标展示

**Files:**
- Modify: `frontend/src/components/ChoicePanel.tsx`

- [ ] **Step 1: 加属性图标映射**

在组件顶部添加：

```typescript
const ATTR_ICONS: Record<string, string> = {
  intelligence: '🧠', charm: '✨', attack: '⚔️', defense: '🛡️', luck: '🍀',
};
```

- [ ] **Step 2: 在选项按钮中渲染属性图标**

在 `attrHint` 渲染逻辑下方（约 line 73）添加：

```tsx
{opt.checkAttr && opt.riskLevel !== 'safe' && ATTR_ICONS[opt.checkAttr] && (
  <span className="text-xs text-muted-foreground ml-1">
    {ATTR_ICONS[opt.checkAttr]}
  </span>
)}
```

- [ ] **Step 3: 类型检查 + Commit**

```bash
cd d:/project/novel-simulator/frontend && npx tsc --noEmit
git add frontend/src/components/ChoicePanel.tsx
git commit -m "feat: show attribute icon on risky/daring options in ChoicePanel"
```

---

### Task 15: 前端 ResolutionDisplay 重写

**Files:**
- Modify: `frontend/src/components/ResolutionDisplay.tsx`

**改造点:**
- safe: 绿色卡片 + 属性变化胶囊，1.5s 后继续按钮亮起
- risky: 骰子翻牌动画（300ms 逐个） + 事件卡片滑入
- daring: 红色脉冲边框 + 事件毛玻璃→清晰动画
- 删除 WheelOfFortune 引用
- 删除 sector 引用（SECTOR_ICONS/SECTOR_NAMES）

- [ ] **Step 1: 重写 ResolutionDisplay 组件**

```tsx
import { useEffect, useState } from 'react';
import { Card, CardContent } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { ChevronRightIcon } from 'lucide-react';
import type { ResolutionResult } from '@/types';

interface ResolutionDisplayProps {
  result: ResolutionResult;
  onContinue: () => void;
}

export default function ResolutionDisplay({ result, onContinue }: ResolutionDisplayProps) {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const step = result.riskLevel === 'safe' ? 150 : 300;
    const t1 = setTimeout(() => setReveal(1), step);
    const t2 = setTimeout(() => setReveal(2), step * 2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [result.riskLevel]);

  const showContinue = (result.riskLevel === 'safe' && reveal >= 1) || reveal >= 2;

  return (
    <Card className="border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          {result.riskLevel === 'safe' && <span className="text-lg">🟢</span>}
          {result.riskLevel === 'risky' && <span className="text-lg">{result.success ? '🎲' : '💥'}</span>}
          {result.riskLevel === 'daring' && (
            <span className="text-lg animate-pulse">⚡</span>
          )}
          <h3 className="text-base font-semibold">
            {result.riskLevel === 'safe' && '稳定推进'}
            {result.riskLevel === 'risky' && (result.success ? '检定成功！' : '检定失败')}
            {result.riskLevel === 'daring' && '高风险行动'}
          </h3>
        </div>

        {/* daring: 红色脉冲边框 */}
        {result.riskLevel === 'daring' && reveal === 0 && (
          <div className="border-2 border-red-400 rounded-lg p-4 animate-pulse">
            <p className="text-sm text-red-600 text-center">你做出了一个大胆的选择...</p>
            <p className="text-xs text-muted-foreground text-center mt-1">命运正在为你编织结果</p>
          </div>
        )}

        {/* risky: 检定表 */}
        {result.riskLevel === 'risky' && reveal >= 1 && result.checkAttr && (
          <div className="bg-muted rounded-lg p-4 text-sm space-y-2 animate-in fade-in duration-300">
            <div className="grid grid-cols-4 gap-2 text-center pt-2">
              <div>
                <div className="text-xl font-bold tabular-nums">{result.diceRoll}</div>
                <div className="text-[10px] text-muted-foreground">🎲 骰子</div>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{result.modifier != null && result.modifier >= 0 ? '+' : ''}{result.modifier}</div>
                <div className="text-[10px] text-muted-foreground">修正</div>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{result.total}</div>
                <div className="text-[10px] text-muted-foreground">合计</div>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">DC{result.dc}</div>
                <div className="text-[10px] text-muted-foreground">难度</div>
              </div>
            </div>
            <div className="text-center pt-1">
              <span className={`text-lg font-bold ${result.success ? 'text-green-600' : 'text-red-500'}`}>
                {result.success ? '✅ 成功！' : '❌ 失败'}
              </span>
            </div>
          </div>
        )}

        {/* safe: 文本 */}
        {result.riskLevel === 'safe' && reveal >= 1 && (
          <p className="text-sm text-muted-foreground animate-in fade-in duration-300">你稳步前进，一切顺利。</p>
        )}

        {/* 事件卡片 + 属性变化 */}
        {reveal >= 2 && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {result.eventTitle && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">⚡ {result.eventTitle}</h5>
                {result.eventContent && (
                  <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed whitespace-pre-wrap">{result.eventContent}</p>
                )}
              </div>
            )}

            {result.attrChanges && Object.keys(result.attrChanges).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">📊 属性变化</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.attrChanges).map(([key, value]) => {
                    const icons: Record<string, string> = {
                      hp: '❤️', attack: '⚔️', defense: '🛡️',
                      intelligence: '🧠', charm: '✨', luck: '🍀',
                    };
                    const names: Record<string, string> = {
                      hp: '气血', attack: '攻击', defense: '防御',
                      intelligence: '智力', charm: '魅力', luck: '运气',
                    };
                    return (
                      <div key={key}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums
                          ${value > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                           : value < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                           : 'bg-muted text-muted-foreground'}`}
                      >
                        {icons[key]} {names[key]} {value >= 0 ? '+' : ''}{value}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 继续按钮 */}
        {showContinue && (
          <Button onClick={onContinue} className="w-full mt-2 animate-in fade-in duration-200" size="sm">
            继续冒险 <ChevronRightIcon className="size-4 ml-1" />
          </Button>
        )}

        {!showContinue && (
          <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
            {/* 移除 spinner，用倒计时暗示 */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 删除 SECTOR_ICONS / SECTOR_NAMES 常量引用**

确认所有 `SECTOR_ICONS` / `SECTOR_NAMES` 引用已删除。

- [ ] **Step 3: 类型检查 + Commit**

```bash
cd d:/project/novel-simulator/frontend && npx tsc --noEmit
git add frontend/src/components/ResolutionDisplay.tsx
git commit -m "feat: rewrite ResolutionDisplay for three riskLevel modes, remove WheelOfFortune/sector refs"
```

---

### Task 16: 前端删除 WheelOfFortune

**Files:**
- Delete: `frontend/src/components/WheelOfFortune.tsx`

- [ ] **Step 1: 删除文件**

```bash
git rm frontend/src/components/WheelOfFortune.tsx
```

- [ ] **Step 2: 搜索并清理残留引用**

```bash
grep -rn "WheelOfFortune" d:/project/novel-simulator/frontend/src --include="*.tsx" --include="*.ts"
```

删除所有 import 和 JSX 引用（预期仅 ResolutionDisplay.tsx 中有，但已在 Task 15 删除）。

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: remove WheelOfFortune component"
```

---

### Task 17: 前端 page-player-story — 删除事件拼接

**Files:**
- Modify: `frontend/src/pages/page-player-story.tsx`

- [ ] **Step 1: 删除 triggerStory 中的事件拼接**

删除约 line 81-84 的事件拼接代码：

```diff
- if (res?.eventTitle) {
-   const desc = '---\n\n' + res.eventTitle + '！' + (res.eventContent || '');
-   setStoryText(prev => prev + '\n\n' + desc + '\n\n');
- }
```

- [ ] **Step 2: 类型检查 + Commit**

```bash
cd d:/project/novel-simulator/frontend && npx tsc --noEmit
git add frontend/src/pages/page-player-story.tsx
git commit -m "fix: remove event text splicing from page-player-story"
```

---

### Task 18: 前端 CharacterPanel — 属性动画完善

**Files:**
- Modify: `frontend/src/components/CharacterPanel.tsx`

**改造点:**
- AttrRow 的浮动数字动画和数字滚动已实现（当前代码已有）。此 Task 做验证和微调。
- 增加 HP bar 在低血量时的视觉警告

- [ ] **Step 1: 确认当前动画正常工作**

检查 `.float-up` keyframe 已在 `<style>` 中定义；`AttrRow` 的 `delta` prop 和浮动数字逻辑完整。无需大改。

- [ ] **Step 2: 添加低血量警告**

在 HP row 处添加额外的颜色逻辑：

```tsx
<AttrRow label="❤️ HP" value={character.hp} delta={attrChanges?.hp} />
{character.hp < 30 && (
  <div className="text-xs text-red-500 animate-pulse">⚠ 生命值危险！</div>
)}
```

- [ ] **Step 3: 类型检查 + Commit**

```bash
cd d:/project/novel-simulator/frontend && npx tsc --noEmit
git add frontend/src/components/CharacterPanel.tsx
git commit -m "feat: add low HP warning animation to CharacterPanel"
```

---

### Task 19: 端到端编译 + 全栈验证

- [ ] **Step 1: 后端完整编译**

```bash
cd d:/project/novel-simulator && mvn clean compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 2: 前端编译**

```bash
cd d:/project/novel-simulator/frontend && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 前端 build**

```bash
cd d:/project/novel-simulator/frontend && npm run build
```

Expected: build success

- [ ] **Step 4: 全局搜索 checkAttr/detectAttr/sector 残留**

```bash
grep -rn "detectAttr" d:/project/novel-simulator/src --include="*.java"
grep -rn "sector" d:/project/novel-simulator/src --include="*.java"
grep -rn "sector" d:/project/novel-simulator/frontend/src --include="*.tsx" --include="*.ts"
grep -rn "WheelOfFortune" d:/project/novel-simulator/frontend/src --include="*.tsx" --include="*.ts"
```

Expected: 无结果（除 import/export 中无引用的情况，如定义文件中的 type 字段）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final cleanup, verify build success"
```
