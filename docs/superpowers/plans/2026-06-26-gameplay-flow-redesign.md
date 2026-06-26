# 玩法流程重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构核心玩法流程，将散乱的"选择→随机转盘→故事"改为因果链"选择→检定→机械结果→叙事"，属性参与 d20 检定公式，一次 resolve API 返回全部结果。

**Architecture:** 后端 ActionEngine 新增 `resolve()` 替代旧 `choose()`+`spin()`，实现 d20 属性检定公式。OptionChain 输出带 riskLevel 标签的选项。StoryChain 接收 ResolutionResult 嵌入 prompt。前端新增 ResolutionDisplay 组件展示检定结果，WheelOfFortune 改为自动播放动画组件。

**Tech Stack:** Java 8, Spring Boot 2.7.18, LangChain4j, Jackson, React 19, shadcn/ui

**参考设计:** `docs/superpowers/specs/2026-06-26-gameplay-flow-redesign.md`

---

## 文件改动总览

### 后端（10 文件）

| 文件 | 操作 |
|------|------|
| `dto/OptionVO.java` | 修改 |
| `dto/ResolutionResult.java` | **新增** |
| `dto/ChooseActionRequest.java` | **删除** |
| `dto/SpinActionRequest.java` | **删除** |
| `dto/ActionResult.java` | **删除** |
| `service/OptionChain.java` | 修改 |
| `service/ActionEngine.java` | **重写** |
| `service/EventChain.java` | 修改 |
| `service/StoryChain.java` | 修改 |
| `controller/PlayerController.java` | 修改 |

### 前端（7 文件）

| 文件 | 操作 |
|------|------|
| `types/index.ts` | 修改 |
| `components/ChoicePanel.tsx` | **重写** |
| `components/ResolutionDisplay.tsx` | **新增** |
| `components/WheelOfFortune.tsx` | **重写** |
| `components/CharacterPanel.tsx` | 修改 |
| `hooks/useStory.ts` | 修改 |
| `pages/page-player-story.tsx` | **重写** |

---

### Task 1: OptionVO — 新增风险标签字段

**Files:**
- Modify: `src/main/java/com/novel/simulator/dto/OptionVO.java`

- [ ] **Step 1: 修改 OptionVO.java**

替换为：

```java
package com.novel.simulator.dto;

public class OptionVO {
    private Long id;
    private String label;
    private Long targetNodeId;
    private String riskLevel;        // "safe" | "risky" | "daring"
    private String attrHint;         // "需要一定洞察力"
    private String expectedOutcome;  // "可能发现宝藏，但也有危险"

    public OptionVO() {}

    public OptionVO(String label, Long targetNodeId, String riskLevel, String attrHint, String expectedOutcome) {
        this.label = label;
        this.targetNodeId = targetNodeId;
        this.riskLevel = riskLevel;
        this.attrHint = attrHint;
        this.expectedOutcome = expectedOutcome;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getAttrHint() { return attrHint; }
    public void setAttrHint(String attrHint) { this.attrHint = attrHint; }
    public String getExpectedOutcome() { return expectedOutcome; }
    public void setExpectedOutcome(String expectedOutcome) { this.expectedOutcome = expectedOutcome; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/OptionVO.java
git commit -m "feat: OptionVO add riskLevel attrHint expectedOutcome fields"
```

---

### Task 2: ResolutionResult — 新增统一响应 DTO

**Files:**
- Create: `src/main/java/com/novel/simulator/dto/ResolutionResult.java`

- [ ] **Step 1: 创建 ResolutionResult.java**

```java
package com.novel.simulator.dto;

import java.util.Map;

/**
 * 玩法流程重构后的统一响应结构。
 * 替代旧的 ActionResult，合并 choose + spin 的返回。
 *
 * 字段分组：
 * - targetNodeId: 导航到的目标节点
 * - riskLevel/checkAttr/attrValue/diceRoll/dc/modifier/total/success: 检定信息（仅 risky/daring 时有意义）
 * - attrChanges: 属性变化 map（如 {"hp": -8, "attack": 3}）
 * - isDead: 角色是否死亡
 * - eventTitle/eventContent: 触发的事件（触发时才有）
 */
public class ResolutionResult {
    private String actionType;           // "resolve"
    private Long targetNodeId;           // 导航到的目标节点 ID

    // 检定信息（risky/daring 时填充）
    private String riskLevel;            // safe / risky / daring
    private String checkAttr;            // 关联属性名（如 "intelligence"）
    private int attrValue;               // 属性值
    private int diceRoll;                // d20 结果 (risky)
    private int dc;                      // 难度值 (risky)
    private int modifier;                // 属性修正 (risky)
    private int total;                   // roll + modifier (risky)
    private boolean success;             // 是否通过 (risky)

    // 结果数据
    private Map<String, Integer> attrChanges;  // {"hp": -8, "attack": 3}
    private boolean isDead;

    // 事件数据（触发时才有）
    private String eventTitle;
    private String eventContent;

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getCheckAttr() { return checkAttr; }
    public void setCheckAttr(String checkAttr) { this.checkAttr = checkAttr; }
    public int getAttrValue() { return attrValue; }
    public void setAttrValue(int attrValue) { this.attrValue = attrValue; }
    public int getDiceRoll() { return diceRoll; }
    public void setDiceRoll(int diceRoll) { this.diceRoll = diceRoll; }
    public int getDc() { return dc; }
    public void setDc(int dc) { this.dc = dc; }
    public int getModifier() { return modifier; }
    public void setModifier(int modifier) { this.modifier = modifier; }
    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public Map<String, Integer> getAttrChanges() { return attrChanges; }
    public void setAttrChanges(Map<String, Integer> attrChanges) { this.attrChanges = attrChanges; }
    public boolean isDead() { return isDead; }
    public void setIsDead(boolean isDead) { this.isDead = isDead; }

    public String getEventTitle() { return eventTitle; }
    public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }
    public String getEventContent() { return eventContent; }
    public void setEventContent(String eventContent) { this.eventContent = eventContent; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/ResolutionResult.java
git commit -m "feat: add ResolutionResult unified DTO replacing ActionResult"
```

---

### Task 3: 删除旧 DTO

**Files:**
- Delete: `src/main/java/com/novel/simulator/dto/ChooseActionRequest.java`
- Delete: `src/main/java/com/novel/simulator/dto/SpinActionRequest.java`
- Delete: `src/main/java/com/novel/simulator/dto/ActionResult.java`

- [ ] **Step 1: 删除三个旧 DTO 文件**

```bash
rm src/main/java/com/novel/simulator/dto/ChooseActionRequest.java
rm src/main/java/com/novel/simulator/dto/SpinActionRequest.java
rm src/main/java/com/novel/simulator/dto/ActionResult.java
```

- [ ] **Step 2: Commit**

```bash
git add -A src/main/java/com/novel/simulator/dto/
git commit -m "refactor: remove ChooseActionRequest, SpinActionRequest, ActionResult (replaced by ResolutionResult)"
```

---

### Task 4: OptionChain — Prompt 扩展 + 风险标签校验

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/OptionChain.java`

- [ ] **Step 1: 扩展 buildPrompt 方法，追加风险标签要求**

在 `buildPrompt()` 方法的 prompt 字符串末尾追加要求。找到方法结束时 JSON 格式要求之后的位置，追加：

```java
// 在 "严格返回 JSON 数组格式（不要 markdown 代码块标记）：" 段落后追加
// 找到最后的 return 语句前的 prompt 字符串，在 "不要出现「继续前进」「下一步」这种无意义标题" 后追加：

+ "\n"
+ "【新增要求】\n"
+ "5. 每个选项标注风险等级：\n"
+ "   - \"safe\"：安全推进，稳定小收益，适合稳妥玩家\n"
+ "   - \"risky\"：冒险一试，需要属性检定，成功大收益/失败大代价\n"
+ "   - \"daring\"：高风险高回报，必定触发随机事件\n"
+ "6. 用 attrHint 简要说明属性要求（如'需要一定洞察力'）\n"
+ "7. 用 expectedOutcome 简要描述预期结果（如'可能发现宝藏，但也有危险'）\n"
+ "返回格式示例：\n"
+ "[\n"
+ "  {\"label\":\"...\",\"targetNodeId\":1,\"riskLevel\":\"safe\",\"attrHint\":\"\",\"expectedOutcome\":\"稳步推进，小有收获\"},\n"
+ "  {\"label\":\"...\",\"targetNodeId\":2,\"riskLevel\":\"risky\",\"attrHint\":\"需要一定勇气和力量\",\"expectedOutcome\":\"搏斗一番，可能受伤但有机会获得情报\"},\n"
+ "  {\"label\":\"...\",\"targetNodeId\":3,\"riskLevel\":\"daring\",\"attrHint\":\"极其危险\",\"expectedOutcome\":\"直面敌人首领，九死一生\"}\n"
+ "]";
```

替换后完整的 buildPrompt 方法末尾：

```java
            + "不要出现「继续前进」「下一步」这种无意义标题"
            + "\n"
            + "【新增要求】\n"
            + "5. 每个选项标注风险等级：\n"
            + "   - \"safe\"：安全推进，稳定小收益，适合稳妥玩家\n"
            + "   - \"risky\"：冒险一试，需要属性检定，成功大收益/失败大代价\n"
            + "   - \"daring\"：高风险高回报，必定触发随机事件\n"
            + "6. 用 attrHint 简要说明属性要求（如'需要一定洞察力'）\n"
            + "7. 用 expectedOutcome 简要描述预期结果（如'可能发现宝藏，但也有危险'）\n"
            + "返回格式示例：\n"
            + "[\n"
            + "  {\"label\":\"...\",\"targetNodeId\":1,\"riskLevel\":\"safe\",\"attrHint\":\"\",\"expectedOutcome\":\"稳步推进，小有收获\"},\n"
            + "  {\"label\":\"...\",\"targetNodeId\":2,\"riskLevel\":\"risky\",\"attrHint\":\"需要一定勇气和力量\",\"expectedOutcome\":\"搏斗一番，可能受伤但有机会获得情报\"},\n"
            + "  {\"label\":\"...\",\"targetNodeId\":3,\"riskLevel\":\"daring\",\"attrHint\":\"极其危险\",\"expectedOutcome\":\"直面敌人首领，九死一生\"}\n"
            + "]";
```

- [ ] **Step 2: 在 generateOptions 方法中添加 riskLevel 合法性校验**

在 `generateOptions()` 方法的 JSON 解析之后、约束校验之前，添加 riskLevel 校验。找到以下代码：

```java
        // 10. 解析 JSON
        List<OptionVO> options;
        try {
            String json = extractJson(llmText);
            options = objectMapper.readValue(json, new TypeReference<List<OptionVO>>() {});
        } catch (Exception e) {
            throw new RuntimeException("解析 LLM 返回失败: " + e.getMessage());
        }

        // 11. 约束校验：过滤掉不在可用连接列表中的选项
```

在步骤 10 和 11 之间追加：

```java
        // 11. riskLevel 合法性校验，非法值默认 safe
        for (OptionVO opt : options) {
            String rl = opt.getRiskLevel();
            if (rl == null || (!"safe".equals(rl) && !"risky".equals(rl) && !"daring".equals(rl))) {
                opt.setRiskLevel("safe");
            }
        }

        // 12. 约束校验：过滤掉不在可用连接列表中的选项（原步骤 11）
```

注意原步骤 11 的变量名 `validTargetIds` 引用保持不变。

- [ ] **Step 3: 编译验证**

```bash
cd D:/project/novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/service/OptionChain.java
git commit -m "feat: OptionChain prompt expansion for riskLevel attrHint expectedOutcome"
```

---

### Task 5: ActionEngine — 重写为 resolve() + d20 检定

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/ActionEngine.java`

- [ ] **Step 1: 完全替换 ActionEngine.java**

```java
package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.ResolutionResult;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Service
public class ActionEngine {

    private final NodeMapper nodeMapper;
    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final EventChain eventChain;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    public ActionEngine(NodeMapper nodeMapper,
                        UserSessionMapper userSessionMapper, UserCharacterMapper userCharacterMapper,
                        EventChain eventChain,
                        ObjectMapper objectMapper,
                        StringRedisTemplate redisTemplate) {
        this.nodeMapper = nodeMapper;
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.eventChain = eventChain;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
    }

    // ========== Public API ==========

    /**
     * 统一 resolve 入口：合并旧 choose + spin。
     * 根据 riskLevel 走不同检定分支。
     */
    @Transactional
    public ResolutionResult resolve(String sessionId, Long targetNodeId,
                                    String choiceLabel, String riskLevel) {
        UserSession session = getSession(sessionId);
        UserCharacter character = getCharacter(sessionId);

        // 记录当前节点到历史
        if (session.getCurrentNodeId() != null) {
            updateHistory(session, session.getCurrentNodeId());
        }

        // 导航到目标节点
        Node targetNode = targetNodeId != null ? nodeMapper.selectById(targetNodeId) : null;
        if (targetNode != null) {
            session.setCurrentNodeId(targetNode.getId());
        }

        // 增加选择计数
        character.setChoicesMade(character.getChoicesMade() != null ? character.getChoicesMade() + 1 : 1);

        // 根据风险等级走不同分支
        ResolutionResult result;
        switch (riskLevel != null ? riskLevel : "safe") {
            case "risky":
                result = resolveRisky(character, choiceLabel, session);
                break;
            case "daring":
                result = resolveDaring(character, session, targetNode);
                break;
            default:
                result = resolveSafe(character);
                break;
        }

        result.setTargetNodeId(targetNode != null ? targetNode.getId() : null);
        result.setRiskLevel(riskLevel);

        // 持久化
        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.updateById(character);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        result.setIsDead(character.getHp() != null && character.getHp() <= 0);
        return result;
    }

    // ========== 三种分支 ==========

    /** safe: 稳定小收益，无需检定 */
    private ResolutionResult resolveSafe(UserCharacter c) {
        int hpGain = 5 + ThreadLocalRandom.current().nextInt(6); // 5-10
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

    /** risky: d20 属性检定 */
    private ResolutionResult resolveRisky(UserCharacter c, String label, UserSession session) {
        String attr = detectAttr(label);
        int attrValue = getAttr(c, attr);
        int modifier = (attrValue - 50) / 10;  // 50→0, 70→+2, 30→-2
        int roll = ThreadLocalRandom.current().nextInt(1, 21);
        int dc = pickDC(attrValue);
        int total = roll + modifier;
        boolean success = total >= dc;

        Map<String, Integer> changes;
        String eventTitle = null;
        String eventContent = null;

        if (success) {
            // 成功: 正面收益
            int hpGain = 10 + ThreadLocalRandom.current().nextInt(11); // 10-20
            int attrGain = 2 + ThreadLocalRandom.current().nextInt(4); // 2-5
            c.setHp(Math.min(100, (c.getHp() != null ? c.getHp() : 100) + hpGain));
            setAttr(c, attr, getAttr(c, attr) + attrGain);

            changes = new HashMap<>();
            changes.put("hp", hpGain);
            changes.put(attr, attrGain);

            // 大成功 → 触发正面事件
            if (total >= dc + 5) {
                Map<String, Object> eventData = eventChain.generateEvent(session, null, c, "risky_success");
                eventTitle = (String) eventData.get("title");
                eventContent = (String) eventData.get("content");
                // 叠加事件属性变化
                applyEventChanges(c, eventData, changes);
                c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);
            }
        } else {
            // 失败: 属性损失
            int hpLoss = 10 + ThreadLocalRandom.current().nextInt(11); // 10-20
            int attrLoss = 1 + ThreadLocalRandom.current().nextInt(3); // 1-3
            c.setHp(Math.max(0, (c.getHp() != null ? c.getHp() : 100) - hpLoss));
            setAttr(c, attr, Math.max(0, getAttr(c, attr) - attrLoss));

            changes = new HashMap<>();
            changes.put("hp", -hpLoss);
            changes.put(attr, -attrLoss);

            // 严重失败 → 触发负面事件
            if (total < dc - 3) {
                Map<String, Object> eventData = eventChain.generateEvent(session, null, c, "risky_fail");
                eventTitle = (String) eventData.get("title");
                eventContent = (String) eventData.get("content");
                applyEventChanges(c, eventData, changes);
                c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);
            }
        }

        ResolutionResult r = new ResolutionResult();
        r.setCheckAttr(attr);
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

    /** daring: 强制触发事件 */
    private ResolutionResult resolveDaring(UserCharacter c, UserSession session, Node currentNode) {
        Map<String, Object> eventData = eventChain.generateEvent(session, currentNode, c, "daring");
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

    // ========== 辅助方法 ==========

    /** 从选项 label 推断关联属性 */
    private String detectAttr(String label) {
        String l = label != null ? label : "";
        if (l.contains("察") || l.contains("读") || l.contains("研") || l.contains("搜")) return "intelligence";
        if (l.contains("说") || l.contains("交") || l.contains("骗") || l.contains("服")) return "charm";
        if (l.contains("战") || l.contains("打") || l.contains("冲") || l.contains("攻")) return "attack";
        if (l.contains("躲") || l.contains("防") || l.contains("守")) return "defense";
        if (l.contains("探") || l.contains("寻") || l.contains("找")) return "intelligence";
        return "luck";
    }

    /** 根据属性值选取 DC */
    private int pickDC(int attrValue) {
        if (attrValue >= 80) return 15;
        if (attrValue >= 60) return 13;
        if (attrValue >= 40) return 12;
        return 10;
    }

    /** 获取某属性的数值 */
    private int getAttr(UserCharacter c, String attr) {
        if (c == null) return 50;
        switch (attr) {
            case "attack": return c.getAttack() != null ? c.getAttack() : 10;
            case "defense": return c.getDefense() != null ? c.getDefense() : 10;
            case "intelligence": return c.getIntelligence() != null ? c.getIntelligence() : 50;
            case "charm": return c.getCharm() != null ? c.getCharm() : 50;
            case "luck": return c.getLuck() != null ? c.getLuck() : 50;
            default: return 50;
        }
    }

    /** 设置某属性的数值 */
    private void setAttr(UserCharacter c, String attr, int value) {
        if (c == null) return;
        switch (attr) {
            case "hp": c.setHp(value); break;
            case "attack": c.setAttack(value); break;
            case "defense": c.setDefense(value); break;
            case "intelligence": c.setIntelligence(value); break;
            case "charm": c.setCharm(value); break;
            case "luck": c.setLuck(value); break;
        }
    }

    /** 应用事件属性变化到角色，并记录到 changes map */
    private void applyEventChanges(UserCharacter c, Map<String, Object> eventData, Map<String, Integer> changes) {
        String[] fields = {"hp", "attack", "defense", "intelligence", "charm", "luck"};
        String[] keys = {"hpChange", "attackChange", "defenseChange", "intelligenceChange", "charmChange", "luckChange"};
        for (int i = 0; i < fields.length; i++) {
            int delta = eventData.containsKey(keys[i]) ? ((Number) eventData.get(keys[i])).intValue() : 0;
            if (delta != 0) {
                int old = getAttr(c, fields[i]);
                int newVal = Math.max(0, old + delta);
                if ("hp".equals(fields[i])) newVal = Math.min(100, newVal);
                setAttr(c, fields[i], newVal);
                changes.put(fields[i], changes.getOrDefault(fields[i], 0) + delta);
            }
        }
    }

    private void updateHistory(UserSession session, Long nodeId) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> history = objectMapper.readValue(session.getHistoryPath(), List.class);
            history.add(nodeId);
            session.setHistoryPath(objectMapper.writeValueAsString(history));
        } catch (Exception ignored) {}
    }

    private UserSession getSession(String sessionId) {
        UserSession session = userSessionMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getSessionId, sessionId));
        if (session == null) throw new RuntimeException("会话不存在");
        return session;
    }

    private UserCharacter getCharacter(String sessionId) {
        UserCharacter character = userCharacterMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));
        if (character == null) throw new RuntimeException("角色属性不存在");
        return character;
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/project/novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/novel/simulator/service/ActionEngine.java
git commit -m "feat: ActionEngine resolve() with d20 check formula replacing old choose+spin"
```

---

### Task 6: EventChain — 接收 riskLevel + attrValue

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/EventChain.java`

- [ ] **Step 1: 改造 generateEvent 方法签名**

找到 `generateEvent(UserSession session, Node currentNode, UserCharacter character, String eventType)`，将最后参数改为接收 `riskLevel`：

```java
    public Map<String, Object> generateEvent(UserSession session, Node currentNode,
                                              UserCharacter character, String riskLevel) {
```

- [ ] **Step 2: 在 prompt 中注入风险等级上下文**

找到 `generateEventWithLlm` 方法中的 prompt 构建代码，在"【扇区类型】"行之后追加风险上下文：

```java
            + (!"daring".equals(riskLevel) ? "" :
                "\n【当前行动风险等级】daring（高风险）\n"
                + "角色运气值: " + (character.getLuck() != null ? character.getLuck() : 50) + "/100\n"
                + "运气高→结果偏向正面，运气低→结果偏向负面\n\n")
```

- [ ] **Step 3: 在 prompt 的约束规则中增加运气偏向**

找到 prompt 末段的"HP 变化范围 -30 到 +30"规则，在其后追加：

```java
            + "- 运气高(" + (character.getLuck() != null ? character.getLuck() : 50)
            + ")时正面概率提升，内容偏向幸运\n"
            + "- 运气低时负面概率提升，内容偏向不幸\n"
```

- [ ] **Step 4: 编译验证**

```bash
cd D:/project/novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/service/EventChain.java
git commit -m "feat: EventChain accept riskLevel param, prompt biased by luck attribute"
```

---

### Task 7: StoryChain — 接收 ResolutionResult

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/StoryChain.java`

- [ ] **Step 1: 新增接收 ResolutionResult 的重载方法**

在 `StoryChain.java` 中添加新方法，保留旧的单参数方法作为 SSE 端点兼容：

```java
    /**
     * 新方法：接收完整检定结果，嵌入 prompt 确保故事反映机械结果
     */
    public String generateStory(UserSession session, Node currentNode,
                                 UserCharacter character, ResolutionResult resolution) {
        if (llmApiKey != null && !llmApiKey.isEmpty()) {
            try {
                return generateStoryWithResolution(session, currentNode, character, resolution);
            } catch (Exception e) {
                log.warn("LLM story generation failed, falling back to stub: {}", e.getMessage());
            }
        }
        return generateStoryStub(currentNode, character, resolution);
    }
```

- [ ] **Step 2: 新增 generateStoryWithResolution 方法**

```java
    private String generateStoryWithResolution(UserSession session, Node currentNode,
                                                UserCharacter character, ResolutionResult resolution) {
        Novel novel = novelMapper.selectById(session.getNovelId());

        List<Map<String, String>> history = loadHistory(session.getSessionId());

        if (history.isEmpty()) {
            String systemPrompt = buildSystemPrompt(novel, currentNode, character);
            Map<String, String> sysMsg = new HashMap<>();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);
            history.add(sysMsg);
        }

        // 构建包含检定结果的消息
        StringBuilder userContent = new StringBuilder();

        // 基础行动描述
        if (resolution != null) {
            userContent.append("你的选择：").append(resolution.getRiskLevel()).append("行动\n");
            userContent.append("实际结果：\n");

            // 检定信息
            if ("risky".equals(resolution.getRiskLevel()) && resolution.getCheckAttr() != null) {
                userContent.append("- 属性检定：").append(resolution.getCheckAttr())
                    .append("=").append(resolution.getAttrValue())
                    .append("，掷出").append(resolution.getDiceRoll())
                    .append("，修正").append(resolution.getModifier())
                    .append("，合计").append(resolution.getTotal())
                    .append(" vs DC").append(resolution.getDc())
                    .append(" → ").append(resolution.isSuccess() ? "成功" : "失败").append("\n");
            }

            // 属性变化
            if (resolution.getAttrChanges() != null && !resolution.getAttrChanges().isEmpty()) {
                userContent.append("- 属性变化：");
                resolution.getAttrChanges().forEach((k, v) -> userContent.append(k).append(v >= 0 ? "+" : "").append(v).append(" "));
                userContent.append("\n");
            }

            // 事件
            if (resolution.getEventTitle() != null) {
                userContent.append("- 触发事件：").append(resolution.getEventTitle()).append("\n");
                if (resolution.getEventContent() != null) {
                    userContent.append("  事件内容：").append(resolution.getEventContent()).append("\n");
                }
            }
        }

        userContent.append("\n请根据以上实际结果续写故事，以第二人称「你」叙述，生动地描述发生了什么。");

        Map<String, String> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", userContent.toString());
        history.add(userMsg);

        List<ChatMessage> messages = historyToChatMessages(history);
        ChatLanguageModel model = buildModel(0.8, 4096);
        Response<AiMessage> llmResponse = model.generate(messages);
        String storyText = llmResponse.content().text();
        log.info("LLM generated {} chars for session {}", storyText.length(), session.getSessionId());

        Map<String, String> assistantMsg = new HashMap<>();
        assistantMsg.put("role", "assistant");
        assistantMsg.put("content", storyText);
        history.add(assistantMsg);
        saveHistory(session.getSessionId(), history);

        return storyText;
    }
```

- [ ] **Step 3: 新增 stub 方法重载（供降级使用）**

```java
    public String generateStoryStub(Node currentNode, UserCharacter character, ResolutionResult resolution) {
        // 复用旧 stub，附加检定摘要信息
        String base = generateStoryStub(currentNode, character, "");
        StringBuilder sb = new StringBuilder(base);
        if (resolution != null && resolution.getAttrChanges() != null) {
            sb.append("\n\n");
            for (Map.Entry<String, Integer> e : resolution.getAttrChanges().entrySet()) {
                sb.append(e.getKey()).append(e.getValue() >= 0 ? " +" : " ").append(e.getValue()).append(" ");
            }
        }
        return sb.toString();
    }
```

注意：原来的 `generateStoryStub(Node, UserCharacter, String)` 保持不变。

- [ ] **Step 4: 编译验证**

```bash
cd D:/project/novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/service/StoryChain.java
git commit -m "feat: StoryChain accept ResolutionResult, embed check data in prompt"
```

---

### Task 8: PlayerController — 端点变更

**Files:**
- Modify: `src/main/java/com/novel/simulator/controller/PlayerController.java`

- [ ] **Step 1: 替换 choose/spin 端点为 resolve 端点**

删除旧端点：

```java
    @PostMapping("/action/choose")
    public Result<ActionResult> choose(@RequestBody ChooseActionRequest request) {
        ActionResult result = actionEngine.choose(request.getSessionId(), request.getTargetNodeId(), request.getLabel());
        return Result.success(result);
    }

    @PostMapping("/action/spin")
    public Result<ActionResult> spin(@RequestBody SpinActionRequest request) {
        ActionResult result = actionEngine.spin(request.getSessionId(), request.getNodeId());
        return Result.success(result);
    }
```

替换为：

```java
    @PostMapping("/action/resolve")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<ResolutionResult> resolve(@RequestBody Map<String, Object> request) {
        try {
            String sessionId = (String) request.get("sessionId");
            Long targetNodeId = request.get("targetNodeId") != null
                ? Long.valueOf(request.get("targetNodeId").toString()) : null;
            String label = (String) request.get("choiceLabel");
            String riskLevel = (String) request.get("riskLevel");
            ResolutionResult result = actionEngine.resolve(sessionId, targetNodeId, label, riskLevel);
            return Result.success(result);
        } catch (Exception e) {
            log.warn("ActionEngine.resolve error: {}", e.getMessage());
            return Result.error(500, e.getMessage());
        }
    }
```

- [ ] **Step 2: 清理不再需要的 import**

删除 `import com.novel.simulator.dto.ChooseActionRequest;` 和 `import com.novel.simulator.dto.SpinActionRequest;` 和 `import com.novel.simulator.dto.ActionResult;`（文件顶部已用 `dto.*` 通配符，不需要额外操作，编译会自动验证）。

- [ ] **Step 3: 改造 streamStory 方法支持 ResolutionResult**

修改 `streamStory()` 方法，从 Redis 读取 resolution 数据（前端 SSE 调用时传入 resolution 标识）：

在 `streamStory` 方法中，找到：

```java
            String story;
            if (Boolean.TRUE.equals(currentNode.getIsEnd())) {
                story = storyChain.generateEnding(session, character);
                session.setStoryText(story);
            } else {
                story = storyChain.generateStory(session, currentNode, character,
                    description != null ? description : "");
```

替换为：

```java
            String story;
            if (Boolean.TRUE.equals(currentNode.getIsEnd())) {
                story = storyChain.generateEnding(session, character);
                session.setStoryText(story);
            } else {
                // 尝试从 Redis 读取 resolution 数据
                ResolutionResult resolution = null;
                String resolutionJson = redisTemplate.opsForValue().get(
                    "cache:session:" + sessionId + ":pending_resolution");
                if (resolutionJson != null && !resolutionJson.isEmpty()) {
                    try {
                        resolution = objectMapper.readValue(resolutionJson, ResolutionResult.class);
                        redisTemplate.delete("cache:session:" + sessionId + ":pending_resolution");
                    } catch (Exception e) {
                        log.warn("Failed to parse pending_resolution: {}", e.getMessage());
                    }
                }

                if (resolution != null) {
                    story = storyChain.generateStory(session, currentNode, character, resolution);
                } else {
                    story = storyChain.generateStory(session, currentNode, character,
                        description != null ? description : "");
                }
```

需要给 PlayerController 注入 `StringRedisTemplate` 和 `ObjectMapper`。检查是否已有这两个字段，如没有则添加：

```java
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
```

并在构造函数中追加。

- [ ] **Step 4: 编译验证**

```bash
cd D:/project/novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS。如果报错：
1. 如果提示找不到 `ResolutionResult`，确认 import 已加（`import com.novel.simulator.dto.ResolutionResult;`）
2. 如果提示找不到 `StringRedisTemplate`/`ObjectMapper`，确认字段声明和构造函数参数已加

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/controller/PlayerController.java
git commit -m "feat: PlayerController add /action/resolve endpoint, streamStory reads ResolutionResult from Redis"
```

---

### Task 9: 前端类型更新

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: 新增玩法流程相关类型**

在 `frontend/src/types/index.ts` 末尾追加：

```typescript
export interface ChoiceOption {
  id?: number;
  label: string;
  targetNodeId: number;
  riskLevel: 'safe' | 'risky' | 'daring';
  attrHint?: string;
  expectedOutcome?: string;
}

export interface ResolutionResult {
  actionType: string;
  targetNodeId: number;
  riskLevel: string;
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
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/project/novel-simulator/frontend && git add src/types/index.ts
git commit -m "feat: add ChoiceOption and ResolutionResult types"
```

---

### Task 10: ChoicePanel — 风险标签渲染

**Files:**
- Modify: `frontend/src/components/ChoicePanel.tsx`

- [ ] **Step 1: 重写 ChoicePanel.tsx**

```tsx
import { Button } from 'src/components/ui/button';
import type { ChoiceOption } from '@/types';

interface ChoicePanelProps {
  options: ChoiceOption[];
  disabled?: boolean;
  onChoose: (option: ChoiceOption) => void;
}

const riskStyle: Record<string, { label: string; tagCls: string; borderCls: string }> = {
  safe:    { label: '安全', tagCls: 'bg-green-100 text-green-700', borderCls: 'border-green-200' },
  risky:   { label: '冒险', tagCls: 'bg-amber-100 text-amber-700', borderCls: 'border-amber-300' },
  daring:  { label: '高危', tagCls: 'bg-red-100 text-red-700', borderCls: 'border-red-300' },
};

export default function ChoicePanel({ options, disabled, onChoose }: ChoicePanelProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">做出你的选择：</p>
      {options.map((opt, idx) => {
        const style = riskStyle[opt.riskLevel] || riskStyle.safe;
        return (
          <Button
            key={opt.targetNodeId + '-' + idx}
            variant="outline"
            disabled={disabled}
            onClick={() => onChoose(opt)}
            className={`w-full justify-start text-left h-auto py-3 px-4 whitespace-normal break-words
              hover:bg-accent hover:text-accent-foreground transition-colors ${style.borderCls}`}
          >
            <div className="flex flex-col w-full gap-1">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${style.tagCls}`}>
                  {style.label}
                </span>
                <span className="text-sm leading-relaxed">{opt.label}</span>
              </div>
              {opt.expectedOutcome && (
                <span className="text-xs text-muted-foreground ml-1">{opt.expectedOutcome}</span>
              )}
              {opt.attrHint && opt.riskLevel !== 'safe' && (
                <span className="text-[11px] text-amber-600 ml-1">{opt.attrHint}</span>
              )}
            </div>
          </Button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/project/novel-simulator/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No errors (or only pre-existing ones in unrelated files)

- [ ] **Step 3: Commit**

```bash
cd D:/project/novel-simulator/frontend && git add src/components/ChoicePanel.tsx
git commit -m "feat: ChoicePanel risk level badges with color-coded tags and attr hints"
```

---

### Task 11: ResolutionDisplay — 新增检定结果展示组件

**Files:**
- Create: `frontend/src/components/ResolutionDisplay.tsx`

- [ ] **Step 1: 创建 ResolutionDisplay.tsx**

```tsx
import { useEffect, useState } from 'react';
import { Card, CardContent } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { CheckIcon, XIcon, Loader2Icon, ChevronRightIcon } from 'lucide-react';
import WheelOfFortune from 'src/components/WheelOfFortune';
import type { ResolutionResult } from '@/types';

interface ResolutionDisplayProps {
  result: ResolutionResult;
  onContinue: () => void;
}

export default function ResolutionDisplay({ result, onContinue }: ResolutionDisplayProps) {
  const [phase, setPhase] = useState<'enter' | 'check' | 'changes' | 'event' | 'done'>('enter');
  const [countdown, setCountdown] = useState(3);

  // 自动推进
  useEffect(() => {
    if (result.riskLevel === 'safe') {
      // safe: enter → changes → done
      const t1 = setTimeout(() => setPhase('changes'), 200);
      const t2 = setTimeout(() => setPhase('done'), 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (result.riskLevel === 'risky') {
      // risky: enter → check → (event?) → changes → done
      const t1 = setTimeout(() => setPhase('check'), 300);
      const t2 = setTimeout(() => setPhase('changes'), 1500);
      const t3 = setTimeout(() => setPhase('done'), result.eventTitle ? 3000 : 2200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    // daring: enter → event → changes → done
    const t1 = setTimeout(() => setPhase('event'), 300);
    const t2 = setTimeout(() => setPhase('changes'), 2000);
    const t3 = setTimeout(() => setPhase('done'), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // 倒计时
  useEffect(() => {
    if (phase !== 'done') return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4 space-y-3">
        {/* 阶段: 检定动画 */}
        {phase === 'check' && result.riskLevel === 'risky' && (
          <div>
            <h4 className="text-sm font-semibold mb-2">🎲 属性检定</h4>
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">关联属性</span>
                <span className="font-medium">{result.checkAttr} ({result.attrValue})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">检定公式</span>
                <span className="font-mono text-xs">d20 + ({result.attrValue} - 50)/10</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-muted-foreground text-sm font-normal">结果</span>
                <span className={result.success ? 'text-green-600' : 'text-red-500'}>
                  {result.success ? '✅ 成功！' : '❌ 失败'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mt-2 pt-2 border-t border-border">
                <div>
                  <div className="text-lg font-bold tabular-nums">{result.diceRoll}</div>
                  <div className="text-[10px] text-muted-foreground">骰子</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">{result.modifier >= 0 ? '+' : ''}{result.modifier}</div>
                  <div className="text-[10px] text-muted-foreground">修正</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">{result.total}</div>
                  <div className="text-[10px] text-muted-foreground">合计</div>
                </div>
                <div>
                  <div className="text-lg font-bold tabular-nums">DC{result.dc}</div>
                  <div className="text-[10px] text-muted-foreground">难度</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 阶段: 轮盘动画 (daring) */}
        {phase === 'event' && result.riskLevel === 'daring' && (
          <div>
            <h4 className="text-sm font-semibold text-center mb-2">🌀 命运轮盘</h4>
            <WheelOfFortune
              riskLevel="daring"
              rollResult={result.attrValue}
              success={result.success}
              autoPlay
              onComplete={() => {}}
            />
          </div>
        )}

        {/* 阶段: 事件卡片 */}
        {(phase === 'event' || phase === 'changes') && result.eventTitle && (
          <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-3">
            <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300">⚡ {result.eventTitle}</h5>
            {result.eventContent && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 line-clamp-3">{result.eventContent}</p>
            )}
          </div>
        )}

        {/* 阶段: 属性变化 */}
        {(phase === 'changes' || phase === 'done') && result.attrChanges && (
          <div>
            <h4 className="text-sm font-semibold mb-2">📊 属性变化</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.attrChanges).map(([key, value]) => (
                <div
                  key={key}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums
                    ${value > 0 ? 'bg-green-100 text-green-700' : value < 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}
                >
                  {key === 'hp' ? '❤️' : key === 'attack' ? '⚔️' : key === 'defense' ? '🛡️' : key === 'intelligence' ? '🧠' : key === 'charm' ? '✨' : '🍀'}{' '}
                  {key} {value >= 0 ? '+' : ''}{value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 阶段: done - 继续按钮 */}
        {phase === 'done' && (
          <Button onClick={onContinue} className="w-full" size="sm">
            {countdown > 0 ? `继续 (${countdown}s)` : '继续'}
            <ChevronRightIcon className="size-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/project/novel-simulator/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd D:/project/novel-simulator/frontend && git add src/components/ResolutionDisplay.tsx
git commit -m "feat: add ResolutionDisplay component for check result visualization"
```

---

### Task 12: WheelOfFortune — 改为自动播放动画组件

**Files:**
- Modify: `frontend/src/components/WheelOfFortune.tsx`

- [ ] **Step 1: 重写 WheelOfFortune.tsx**

```tsx
import { useEffect, useState } from 'react';

interface WheelOfFortuneProps {
  riskLevel: 'risky' | 'daring';
  rollResult?: number;     // d20 或 luck 值
  success?: boolean;       // 是否成功
  autoPlay: boolean;       // 自动播放，无需点击
  onComplete?: () => void;
}

const COLORS = ['#a855f7', '#eab308', '#ef4444', '#22c55e', '#6366f1', '#06b6d4'];
const SECTORS = [
  { icon: '✨' }, { icon: '💎' }, { icon: '⚔️' },
  { icon: '💀' }, { icon: '🌀' }, { icon: '💕' },
];
const N = 6;

export default function WheelOfFortune({ riskLevel, rollResult, success, autoPlay, onComplete }: WheelOfFortuneProps) {
  const [pointerRot, setPointerRot] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!autoPlay) return;

    let targetAngle = 0;
    if (riskLevel === 'risky' && rollResult != null) {
      // d20 结果映射到扇区 (1-20 → 6扇区)
      const sector = Math.max(0, Math.min(5, Math.floor((rollResult - 1) / 3.33)));
      targetAngle = sector * 60 + 30;
    } else {
      // daring: 随机扇区
      const sector = Math.floor(Math.random() * N);
      targetAngle = sector * 60 + 30;
    }

    const extraRotations = (3 + Math.floor(Math.random() * 3)) * 360;
    const totalRotation = pointerRot + extraRotations + targetAngle;

    setPointerRot(totalRotation);

    const timer = setTimeout(() => {
      setShowResult(true);
      if (onComplete) onComplete();
    }, 1200);

    return () => clearTimeout(timer);
  }, [autoPlay]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-40 sm:size-48">
        {/* 静态转盘 */}
        <div className="w-full h-full rounded-full border-2 border-border bg-card overflow-hidden">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {SECTORS.map((s, i) => {
              const a1 = ((360 / N) * i - 90) * Math.PI / 180;
              const a2 = ((360 / N) * (i + 1) - 90) * Math.PI / 180;
              const am = ((360 / N) * i - 90 + (360 / N) / 2) * Math.PI / 180;
              return (
                <g key={i}>
                  <path d={`M100,100 L${100 + 85 * Math.cos(a1)},${100 + 85 * Math.sin(a1)} A85,85 0 0,1 ${100 + 85 * Math.cos(a2)},${100 + 85 * Math.sin(a2)} Z`} fill={COLORS[i]} stroke="white" strokeWidth="1.5" />
                  <text x={100 + 40 * Math.cos(am)} y={100 + 40 * Math.sin(am)} textAnchor="middle" dominantBaseline="central" fontSize="28">{s.icon}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 指针 */}
        <div className="absolute inset-0 transition-transform duration-[1200ms] ease-out" style={{ transform: `rotate(${pointerRot}deg)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-foreground" />
          </div>
        </div>
      </div>

      {showResult && success != null && (
        <div className={`text-sm font-semibold ${success ? 'text-green-600' : 'text-red-500'}`}>
          {success ? '✅ 成功' : '❌ 失败'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/project/novel-simulator/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd D:/project/novel-simulator/frontend && git add src/components/WheelOfFortune.tsx
git commit -m "refactor: WheelOfFortune auto-play animation component, no longer interactive"
```

---

### Task 13: CharacterPanel — 属性变化浮动动画

**Files:**
- Modify: `frontend/src/components/CharacterPanel.tsx`

- [ ] **Step 1: 增加属性变化动画支持**

```tsx
import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from 'src/components/ui/card';

interface CharacterData {
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  currentTitle?: string;
  choicesMade: number;
  eventsTriggered: number;
}

interface CharacterPanelProps {
  character: CharacterData | null;
  loading?: boolean;
  attrChanges?: Record<string, number>;  // NEW: 属性变化增量
}

interface FloatAnim {
  key: string;
  value: number;
  id: number;
}

function AttrRow({ label, value, delta }: { label: string; value: number; delta?: number }) {
  const color = value >= 80 ? 'text-green-600' : value >= 40 ? 'text-foreground' : 'text-red-500';
  const [displayValue, setDisplayValue] = useState(value);
  const prevRef = useRef(value);
  const [floats, setFloats] = useState<FloatAnim[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev !== value) {
      // 数字滚动动画
      const diff = value - prev;
      const steps = Math.abs(diff);
      const stepSize = diff / Math.max(steps, 1);
      let current = prev;
      const interval = setInterval(() => {
        current += stepSize;
        if (Math.abs(current - value) < Math.abs(stepSize)) {
          setDisplayValue(value);
          clearInterval(interval);
        } else {
          setDisplayValue(Math.round(current));
        }
      }, 30);

      // 浮动数字
      if (delta != null && delta !== 0) {
        idRef.current++;
        const float: FloatAnim = { key: label, value: delta, id: idRef.current };
        setFloats(prev => [...prev, float]);
        setTimeout(() => {
          setFloats(prev => prev.filter(f => f.id !== float.id));
        }, 1500);
      }

      prevRef.current = value;
      return () => clearInterval(interval);
    }
  }, [value]);

  return (
    <div className="flex items-center justify-between text-sm relative">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{displayValue}</span>
      {floats.map(f => (
        <span
          key={f.id}
          className={`absolute right-0 -top-3 text-xs font-bold animate-fade-up pointer-events-none
            ${f.value > 0 ? 'text-green-500' : 'text-red-500'}`}
          style={{ animation: 'float-up 1.5s ease-out forwards' }}
        >
          {f.value >= 0 ? '+' : ''}{f.value}
        </span>
      ))}
    </div>
  );
}

export default function CharacterPanel({ character, loading, attrChanges }: CharacterPanelProps) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <h4 className="text-sm font-semibold">角色属性</h4>
        {loading ? (
          <p className="text-xs text-muted-foreground">加载中...</p>
        ) : character ? (
          <>
            {character.currentTitle && (
              <div className="text-xs text-amber-600 font-medium mb-1">🏆 {character.currentTitle}</div>
            )}
            <AttrRow label="❤️ HP" value={character.hp} delta={attrChanges?.hp} />
            <AttrRow label="⚔️ 攻击" value={character.attack} delta={attrChanges?.attack} />
            <AttrRow label="🛡 防御" value={character.defense} delta={attrChanges?.defense} />
            <AttrRow label="🧠 智力" value={character.intelligence} delta={attrChanges?.intelligence} />
            <AttrRow label="✨ 魅力" value={character.charm} delta={attrChanges?.charm} />
            <AttrRow label="🍀 运气" value={character.luck} delta={attrChanges?.luck} />
            <div className="text-xs text-muted-foreground pt-1 border-t">
              选择: {character.choicesMade} 次 | 事件: {character.eventsTriggered} 次
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">暂无数据</p>
        )}
      </CardContent>

      {/* 浮动动画 keyframes */}
      <style>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-16px); }
        }
      `}</style>
    </Card>
  );
}
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/project/novel-simulator/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd D:/project/novel-simulator/frontend && git add src/components/CharacterPanel.tsx
git commit -m "feat: CharacterPanel attribute change animation with floating numbers and digit roll"
```

---

### Task 14: useStory — resolveAction 替代旧方法

**Files:**
- Modify: `frontend/src/hooks/useStory.ts`

- [ ] **Step 1: 修改 useStory hook**

将 `NodeOption` 接口改为使用 `types/index.ts` 中的 `ChoiceOption`：

```typescript
// 删除旧的 local 定义，改为从 types 导入
import type { ChoiceOption, ResolutionResult } from '@/types';
```

更新 `currentOptions` 状态类型：

```typescript
const [currentOptions, setCurrentOptions] = useState<ChoiceOption[]>([]);
```

删除 `chooseAction` 和 `spinAction`，新增 `resolveAction`：

```typescript
  const resolveAction = useCallback(async (option: ChoiceOption) => {
    if (!session?.sessionId) return null;
    const res = await api.post('/player/action/resolve', {
      sessionId: session.sessionId,
      targetNodeId: option.targetNodeId,
      choiceLabel: option.label,
      riskLevel: option.riskLevel,
    });
    if (res.data.code === 200) {
      const data = res.data.data as ResolutionResult;
      if (data.attrChanges) {
        // 更新本地 character 属性
        setCharacter(prev => {
          if (!prev) return prev;
          const next = { ...prev };
          Object.entries(data.attrChanges).forEach(([key, val]) => {
            if (key === 'hp') next.hp = Math.max(0, Math.min(100, (next.hp || 100) + val));
            if (key === 'attack') next.attack = Math.max(0, (next.attack || 10) + val);
            if (key === 'defense') next.defense = Math.max(0, (next.defense || 10) + val);
            if (key === 'intelligence') next.intelligence = Math.max(0, (next.intelligence || 50) + val);
            if (key === 'charm') next.charm = Math.max(0, (next.charm || 50) + val);
            if (key === 'luck') next.luck = Math.max(0, (next.luck || 50) + val);
          });
          return next;
        });
      }
      if (data.targetNodeId) {
        await loadNode(data.targetNodeId);
      }
      return data;
    }
    return null;
  }, [session, loadNode]);
```

更新 return 对象：

```typescript
  return {
    session, character, currentNode, currentOptions, loading, sessions,
    createSession, loadSession, loadBySessionId, fetchSessions,
    resolveAction,   // 替代 chooseAction + spinAction
    loadNode, generateOptions,
    saveSession, restartSession, saveSettings,
  };
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/project/novel-simulator/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd D:/project/novel-simulator/frontend && git add src/hooks/useStory.ts
git commit -m "refactor: useStory replace chooseAction+spinAction with resolveAction"
```

---

### Task 15: page-player-story.tsx — 新流程

**Files:**
- Modify: `frontend/src/pages/page-player-story.tsx`

- [ ] **Step 1: 重写 page-player-story.tsx**

```tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { useStory } from '@/hooks/useStory';
import { useSSE } from '@/hooks/useSSE';
import ChoicePanel from 'src/components/ChoicePanel';
import StoryViewer from 'src/components/StoryViewer';
import ResolutionDisplay from 'src/components/ResolutionDisplay';
import CharacterPanel from 'src/components/CharacterPanel';
import type { ChoiceOption, ResolutionResult } from '@/types';
import { ArrowLeftIcon, SaveIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import EndingModal from 'src/components/EndingModal';
import SaveLoadModal from 'src/components/SaveLoadModal';

export default function PlayerStoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, character, currentNode, currentOptions, loading, loadSession,
          saveSession, restartSession, resolveAction, generateOptions } = useStory();
  const { streaming, connect } = useSSE();
  const [storyText, setStoryText] = useState('');
  const [actionDisabled, setActionDisabled] = useState(false);
  const [resolution, setResolution] = useState<ResolutionResult | null>(null);
  const [showResolution, setShowResolution] = useState(false);
  const [showEnding, setShowEnding] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const pendingDeathRef = useRef(false);
  const [showMobileChar, setShowMobileChar] = useState(false);

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (session?.storyText) setStoryText(session.storyText);
  }, [session?.storyText]);

  // 到达结局节点时弹出结局
  useEffect(() => {
    if (currentNode?.isEnd && !streaming && storyText) {
      setShowEnding(true);
      setActionDisabled(true);
    }
  }, [currentNode?.isEnd, streaming]);

  // 到达节点后自动生成选项
  useEffect(() => {
    if (currentNode && session?.sessionId && !loading) {
      generateOptions(currentNode.id).catch(() => {
        toast.error('选项生成失败，请检查 LLM 配置后重试');
      });
    }
  }, [currentNode?.id, session?.sessionId, loading]);

  // 触发 SSE 故事流
  const triggerStory = useCallback((sid: string, res?: ResolutionResult) => {
    if (res?.isDead) {
      pendingDeathRef.current = true;
    }

    const displayDesc = res?.eventTitle
      ? res.eventTitle + '！' + (res.eventContent || '')
      : '';

    if (displayDesc) {
      setStoryText(prev => prev + '\n\n---\n\n' + displayDesc + '\n\n');
    }

    // 将 resolution 数据写入 Redis，供 SSE 端点读取
    if (res) {
      api.post('/player/story/prepare', { sessionId: sid, resolution: res }).catch(() => {});
    }

    setPendingSessionId(sid);
    connect(sid, {
      onStory: (text) => {
        flushSync(() => {
          setStoryText(prev => prev + text + '\n\n');
        });
      },
      onDone: () => {
        setPendingSessionId(null);
        if (pendingDeathRef.current) {
          pendingDeathRef.current = false;
          setIsDead(true);
          setShowEnding(true);
          setActionDisabled(true);
          return;
        }
        setActionDisabled(false);
      },
      onError: (msg) => {
        toast.error(msg);
        setActionDisabled(false);
        setPendingSessionId(null);
      },
    });
  }, [connect]);

  // resolve 处理
  const handleResolve = async (option: ChoiceOption) => {
    setActionDisabled(true);
    try {
      const result = await resolveAction(option);
      if (!result) { setActionDisabled(false); return; }

      setResolution(result);
      setShowResolution(true);

      // 根据风险等级设定自动推进延迟
      const delay = option.riskLevel === 'safe' ? 1500
                  : option.riskLevel === 'risky' ? 2500
                  : 3000;

      setTimeout(() => {
        setShowResolution(false);
        if (sessionId) triggerStory(sessionId, result);
      }, delay);
    } catch {
      setActionDisabled(false);
    }
  };

  // 从 resolution 过渡到 story 后的继续
  const handleContinue = () => {
    setShowResolution(false);
    if (resolution && sessionId) {
      triggerStory(sessionId, resolution);
    }
  };

  const handleSave = async () => {
    await saveSession();
    toast.success('存档成功');
  };

  if (loading || !session) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-20 bg-muted rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded" />
          </div>
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-lg" />
            <div className="space-y-2">
              <div className="h-12 bg-muted rounded-lg" />
              <div className="h-12 bg-muted rounded-lg" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/player')}>
          <ArrowLeftIcon className="size-4 mr-1" />
          <span className="hidden sm:inline">返回</span>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSaveLoad(true)} disabled={actionDisabled}>
            <SaveIcon className="size-4 mr-1" /> 存档
          </Button>
          <Button variant="outline" size="sm" onClick={async () => { await restartSession(); setStoryText(''); }} disabled={actionDisabled}>
            <RotateCcwIcon className="size-4 mr-1" /> 重新开始
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          {currentNode && (
            <div>
              <h3 className="text-lg font-semibold">{currentNode.title}</h3>
              {currentNode.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentNode.description}</p>
              )}
            </div>
          )}

          {/* 检定结果展示 */}
          {showResolution && resolution && (
            <ResolutionDisplay result={resolution} onContinue={handleContinue} />
          )}

          {/* 故事阅读 */}
          {!showResolution && (
            <StoryViewer
              text={storyText}
              streaming={streaming}
              placeholder={session.storyText ? '继续你的冒险...' : '故事即将开始...'}
            />
          )}

          {/* 选项面板 */}
          {!streaming && !showResolution && currentOptions.length > 0 && (
            <ChoicePanel
              options={currentOptions}
              disabled={actionDisabled}
              onChoose={handleResolve}
            />
          )}
        </div>

        <div className="hidden lg:block space-y-3">
          <CharacterPanel
            character={character}
            loading={loading}
            attrChanges={resolution?.attrChanges}
          />
        </div>
      </div>

      {/* 移动端角色面板触发按钮 */}
      <button
        type="button"
        onClick={() => setShowMobileChar(true)}
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center lg:hidden"
      >
        <span className="text-lg">📊</span>
      </button>

      {/* 移动端角色面板 Drawer */}
      {showMobileChar && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden" onClick={() => setShowMobileChar(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-background rounded-t-xl p-4 animate-in slide-in-from-bottom duration-200 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
            <CharacterPanel character={character} loading={loading} attrChanges={resolution?.attrChanges} />
            <button
              type="button"
              onClick={() => setShowMobileChar(false)}
              className="w-full mt-3 text-sm text-muted-foreground py-2 hover:text-foreground transition-colors"
            >关闭</button>
          </div>
        </div>
      )}

      {/* 结局弹窗 */}
      {showEnding && (
        <EndingModal
          isDeath={isDead}
          nodeTitle={isDead ? '你的冒险在这里结束了' : (currentNode?.title || '结局')}
          nodeDescription={isDead ? '角色已经死亡，冒险到此为止。' : currentNode?.description}
          storyText={storyText}
          onClose={() => setShowEnding(false)}
          character={character ? {
            hp: character.hp,
            attack: character.attack,
            defense: character.defense,
            intelligence: character.intelligence,
            charm: character.charm,
            luck: character.luck,
            choicesMade: character.choicesMade,
            eventsTriggered: character.eventsTriggered,
            currentTitle: character.currentTitle,
          } : null}
          onRestart={async () => { setShowEnding(false); setIsDead(false); await restartSession(); setStoryText(''); }}
          onBackToHome={() => navigate('/player')}
        />
      )}

      {/* 存档管理弹窗 */}
      <SaveLoadModal
        open={showSaveLoad}
        onClose={() => setShowSaveLoad(false)}
      />
    </div>
  );
}
```

注意：以上代码中遗漏了 `api` 和 `setPendingSessionId` 的导入。需要在文件顶部补充：

```tsx
import api from '@/hooks/useApi';
```

并添加 `setPendingSessionId` 状态：

```tsx
const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/project/novel-simulator/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No errors. 如有报错，检查：
1. `ChoiceOption` 和 `ResolutionResult` 是否从 `@/types` 正确导入
2. `api` 是否从 `@/hooks/useApi` 正确导入
3. `ChoicePanel` 的 `onChoose` 签名是否匹配（现在接收 `ChoiceOption` 而非 `targetNodeId + label`）
4. `useStory` 的 return 中 `resolveAction` 是否替换了 `chooseAction` + `spinAction`

- [ ] **Step 3: 新增 story/prepare 端点**

需要在 `PlayerController` 中新增一个临时端点，供前端将 resolution 数据写入 Redis 供 SSE 读取：

```java
    @PostMapping("/story/prepare")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<Void> prepareStory(@RequestBody Map<String, Object> request) {
        try {
            String sid = (String) request.get("sessionId");
            ObjectMapper objMapper = new ObjectMapper();
            String resolutionJson = objMapper.writeValueAsString(request.get("resolution"));
            redisTemplate.opsForValue().set(
                "cache:session:" + sid + ":pending_resolution",
                resolutionJson,
                5, TimeUnit.MINUTES);
            return Result.success();
        } catch (Exception e) {
            return Result.error(500, e.getMessage());
        }
    }
```

或者更简单：将 resolution 数据暂存到 session 级别的 Redis key。

- [ ] **Step 4: Commit**

```bash
cd D:/project/novel-simulator/frontend && git add src/pages/page-player-story.tsx
git commit -m "refactor: page-player-story new flow with ResolutionDisplay replacing separate wheel"
```

---

### Task 16: 全量编译+提交

**Files:** 所有已修改文件

- [ ] **Step 1: 后端编译**

```bash
cd D:/project/novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS。若失败则排查：
- `ActionEngine.java` 中 `import` 是否完整（检查 `ThreadLocalRandom`、`TimeUnit`）
- `PlayerController.java` 中旧 DTO 引用是否完全移除
- `StoryChain.java` 中 `ResolutionResult` import 是否添加
- `EventChain.java` 方法签名变更后调用方（`ActionEngine`）的调用是否匹配

- [ ] **Step 2: 前端编译**

```bash
cd D:/project/novel-simulator/frontend && npx tsc --noEmit --pretty 2>&1
```
Expected: No errors

- [ ] **Step 3: 提交全部**

```bash
cd D:/project/novel-simulator
git add -A
git status  # 确认所有预期文件都已 staged
git commit -m "feat: gameplay flow redesign - causal chain system (choice->check->consequence->story)"
```

---

## 自审清单

### 1. Spec 覆盖

| Spec 章节 | 对应 Task | 说明 |
|-----------|-----------|------|
| §4.1 OptionVO 扩展 | Task 1 | riskLevel/attrHint/expectedOutcome 字段 |
| §4.2 OptionChain Prompt | Task 4 | Prompt 追加风险标签要求 |
| §4.3 ResolutionResult | Task 2 | 统一 DTO |
| §4.4 ActionEngine 检定 | Task 5 | resolve() + d20 公式 |
| §4.5 EventChain 偏向 | Task 6 | riskLevel 参数 + 运气偏向 |
| §4.6 StoryChain 增强 | Task 7 | 接收 ResolutionResult 嵌入 prompt |
| §4.7 端点变更 | Task 8, 15 | POST /action/resolve, 删除旧 choose/spin |
| §5.1 ChoicePanel 风险标签 | Task 10 | 彩色标签 + attrHint |
| §5.2 ResolutionDisplay | Task 11 | 新增组件 |
| §5.3 WheelOfFortune 改造 | Task 12 | 自动播放 |
| §5.4 CharacterPanel 动画 | Task 13 | 浮动数字 |
| §5.5 page-player-story 流程 | Task 15 | 新流程 |
| §7 状态覆盖 | 各组件 | loading/empty/error/disabled/dead 在各组件中已覆盖 |

### 2. 无占位符
所有 task 包含完整代码，无 TBD/TODO。

### 3. 类型一致性
- `OptionVO.java` ↔ `ChoiceOption.ts` → riskLevel 字段一致（safe/risky/daring）
- `ResolutionResult.java` ↔ `ResolutionResult.ts` → 字段名一致
- ActionEngine.resolve() 返回 `ResolutionResult` → PlayerController.resolve() 返回 `Result<ResolutionResult>` → 前端 `resolveAction` 接收 `ResolutionResult`
