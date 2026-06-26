# OptionChain — 动态选项生成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 OptionChain 组件，玩家到达节点时由 LLM 实时生成选项，替换原有的 `node_option` 表静态方案，同步清理 Admin 侧残留的 options 逻辑。

**Architecture:** 新建 `OptionChain.java` 复用 StoryChain/EventChain 的 LLM 调用模式（callLlm + LlmResult + extractJson），新增 `GET /api/player/option/generate` 端点供前端调用；`ActionEngine.choose()` 从查 `node_option` 表改为直接接收 `targetNodeId`；Admin 导入/节点编辑流程中去掉 options 相关逻辑。

**Tech Stack:** Java 8, Spring Boot 2.6.13, LangChain4j (OpenAiChatModel), React + TypeScript, shadcn/ui

**参考设计:** `docs/superpowers/specs/2026-06-26-optionchain-design.md`

---

## 文件改动总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `service/OptionChain.java` | **新建** | LLM 选项生成，复用 callLlm 模式 |
| `dto/OptionVO.java` | **新建** | 选项返回 VO |
| `dto/ChooseActionRequest.java` | 修改 | optionId → targetNodeId + label |
| `service/ActionEngine.java` | 修改 | choose() 改为直接按 targetNodeId 导航 |
| `controller/PlayerController.java` | 修改 | 新增 option/generate 端点，清理 node 端点 |
| `controller/NodeController.java` | 修改 | 去掉 options 字段 |
| `service/NodeService.java` | 修改 | 去掉 options 查询/写入 |
| `dto/SaveNodesRequest.java` | 修改 | 去掉 options 字段 |
| `service/ParseChain.java` | 修改 | prompt 中去掉 options 要求 |
| `controller/NovelImportController.java` | 修改 | writeParsedData() 去掉 options 写入 |
| `frontend/.../ChoicePanel.tsx` | 修改 | 去掉属性过滤，onChoose 传 targetNodeId |
| `frontend/.../useStory.ts` | 修改 | chooseAction/loadNode 适配新接口 |
| `frontend/.../page-player-story.tsx` | 修改 | handleChoose 传 targetNodeId+label |
| `frontend/.../page-admin-node-editor.tsx` | 修改 | 去掉 dbOptions |

---

### Task 1: 新建 OptionVO

**Files:**
- Create: `src/main/java/com/novel/simulator/dto/OptionVO.java`

- [ ] **Step 1: 创建 OptionVO**

```java
package com.novel.simulator.dto;

public class OptionVO {
    private String label;
    private Long targetNodeId;

    public OptionVO() {}

    public OptionVO(String label, Long targetNodeId) {
        this.label = label;
        this.targetNodeId = targetNodeId;
    }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/OptionVO.java
git commit -m "feat: add OptionVO for LLM-generated options"
```

---

### Task 2: 新建 OptionChain.java

**Files:**
- Create: `src/main/java/com/novel/simulator/service/OptionChain.java`

- [ ] **Step 1: 创建 OptionChain 骨架 — 注入 + callLlm + extractJson**

```java
package com.novel.simulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.OptionVO;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OptionChain {

    private static final Logger log = LoggerFactory.getLogger(OptionChain.class);

    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final NovelMapper novelMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public OptionChain(NodeMapper nodeMapper, NodeEdgeMapper nodeEdgeMapper,
                       UserSessionMapper userSessionMapper, UserCharacterMapper userCharacterMapper,
                       NovelMapper novelMapper, ObjectMapper objectMapper,
                       StringRedisTemplate redisTemplate) {
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.novelMapper = novelMapper;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
    }
```

- [ ] **Step 2: 添加 LlmResult 和 callLlm 辅助方法**

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
                .temperature(0.7)
                .maxTokens(1024)
                .timeout(Duration.ofSeconds(60))
                .build();
            String response = model.generate(prompt);
            return LlmResult.success(response);
        } catch (Exception e) {
            log.warn("LLM call failed: {}", e.getMessage());
            return LlmResult.error(e.getMessage());
        }
    }

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

- [ ] **Step 3: 添加 generateOptions 方法 — LLM 分支 + 约束校验**

```java
    public List<OptionVO> generateOptions(String sessionId, Long nodeId) {
        // 1. 校验 LLM 可用
        if (llmApiKey == null || llmApiKey.isEmpty()) {
            throw new RuntimeException("LLM 未配置，无法生成选项");
        }

        // 2. 加载上下文
        Node currentNode = nodeMapper.selectById(nodeId);
        if (currentNode == null) throw new RuntimeException("节点不存在");

        UserSession session = userSessionMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getSessionId, sessionId));
        if (session == null) throw new RuntimeException("会话不存在");

        UserCharacter character = userCharacterMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));

        Novel novel = novelMapper.selectById(session.getNovelId());
        String worldView = novel != null ? novel.getWorldView() : "";

        // 3. 获取可用连接
        List<NodeEdge> edges = nodeEdgeMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<NodeEdge>()
                .eq(NodeEdge::getSourceNodeId, nodeId)
                .eq(NodeEdge::getNovelId, session.getNovelId()));

        if (edges.isEmpty()) {
            return new ArrayList<>();
        }

        // 4. 获取目标节点信息
        List<Long> targetIds = edges.stream().map(NodeEdge::getTargetNodeId).collect(Collectors.toList());
        List<Node> targetNodes = nodeMapper.selectBatchIds(targetIds);
        Map<Long, Node> targetNodeMap = targetNodes.stream().collect(Collectors.toMap(Node::getId, n -> n));

        // 5. 构建连接列表文本
        StringBuilder connSb = new StringBuilder();
        for (NodeEdge edge : edges) {
            Node target = targetNodeMap.get(edge.getTargetNodeId());
            String title = target != null ? target.getTitle() : "未知";
            String desc = target != null && target.getDescription() != null ? target.getDescription() : "";
            connSb.append("  - ").append(edge.getTargetNodeId()).append(": ").append(title);
            if (!desc.isEmpty()) connSb.append(" — ").append(desc);
            connSb.append("\n");
        }

        // 6. 加载对话历史（最近上下文）
        String historyJson = redisTemplate.opsForValue().get("cache:session:" + sessionId + ":chat_history");
        String recentContext = "";
        if (historyJson != null && !historyJson.isEmpty()) {
            try {
                List<Map<String, String>> history = objectMapper.readValue(historyJson,
                    new TypeReference<List<Map<String, String>>>() {});
                // 取最近 2 轮对话（4 条消息）
                int start = Math.max(0, history.size() - 4);
                StringBuilder ctx = new StringBuilder();
                for (int i = start; i < history.size(); i++) {
                    Map<String, String> msg = history.get(i);
                    String role = msg.getOrDefault("role", "");
                    String content = msg.getOrDefault("content", "");
                    if ("user".equals(role) && content.length() > 100) content = content.substring(0, 100) + "…";
                    if ("assistant".equals(role) && content.length() > 200) content = content.substring(0, 200) + "…";
                    ctx.append("[").append(role).append("] ").append(content).append("\n");
                }
                recentContext = ctx.toString();
            } catch (Exception e) {
                log.warn("Failed to parse chat history: {}", e.getMessage());
            }
        }

        // 7. 构建属性文本
        int hp = character != null && character.getHp() != null ? character.getHp() : 100;
        int atk = character != null && character.getAttack() != null ? character.getAttack() : 10;
        int def = character != null && character.getDefense() != null ? character.getDefense() : 10;
        int inte = character != null && character.getIntelligence() != null ? character.getIntelligence() : 50;
        int cha = character != null && character.getCharm() != null ? character.getCharm() : 50;
        int luk = character != null && character.getLuck() != null ? character.getLuck() : 50;

        // 8. 构建 Prompt
        String prompt = "你是一个互动叙事游戏的设计师。请根据以下信息，为玩家生成 3-4 个选择。\n\n"
            + "【作品】" + (novel != null ? novel.getTitle() : "") + "\n"
            + "【世界观】" + (worldView != null ? worldView : "") + "\n"
            + "【当前场景】" + currentNode.getTitle() + " — "
            + (currentNode.getDescription() != null ? currentNode.getDescription() : "") + "\n\n"
            + "【角色当前状态】\n"
            + "气血：" + hp + "/100　攻击：" + atk + "　防御：" + def + "\n"
            + "悟性：" + inte + "　魅力：" + cha + "　气运：" + luk + "\n\n"
            + "【可去的方向】\n" + connSb.toString() + "\n"
            + "【故事上下文（最近一段）】\n" + (recentContext.isEmpty() ? "（无）" : recentContext) + "\n\n"
            + "请生成 3-4 个选项，每个选项指向一个可去的方向。\n"
            + "严格返回 JSON 数组格式（不要 markdown 代码块标记）：\n"
            + "[\n"
            + "  {\"label\": \"选项文案\", \"targetNodeId\": 目标节点ID},\n"
            + "  {\"label\": \"选项文案\", \"targetNodeId\": 目标节点ID}\n"
            + "]\n\n"
            + "要求：\n"
            + "- 每个 targetNodeId 必须在「可去的方向」列表中\n"
            + "- 不同选项应指向不同节点，形成有意义的分支\n"
            + "- 选项文案要有吸引力，让玩家感到每个选择都有分量\n"
            + "- 角色属性影响选项内容（高智力看到洞察选项，高魅力看到社交选项）\n"
            + "- 结合故事上下文，让选项贴合当前叙事\n"
            + "- 不要出现「继续前进」「下一步」这种无意义标题";

        // 9. 调用 LLM
        LlmResult llmResult = callLlm(prompt);
        if (llmResult.error != null) {
            throw new RuntimeException("选项生成失败: " + llmResult.error);
        }

        // 10. 解析 JSON
        List<OptionVO> options;
        try {
            String json = extractJson(llmResult.text);
            options = objectMapper.readValue(json, new TypeReference<List<OptionVO>>() {});
        } catch (Exception e) {
            throw new RuntimeException("解析 LLM 返回失败: " + e.getMessage());
        }

        // 11. 约束校验：过滤掉不在可用连接列表中的选项
        Set<Long> validTargetIds = edges.stream().map(NodeEdge::getTargetNodeId).collect(Collectors.toSet());
        List<OptionVO> validOptions = options.stream()
            .filter(opt -> opt.getTargetNodeId() != null && validTargetIds.contains(opt.getTargetNodeId()))
            .collect(Collectors.toList());

        int filteredCount = options.size() - validOptions.size();
        if (filteredCount > 0) {
            log.warn("OptionChain: filtered {} invalid options (targetNodeId not in connections)", filteredCount);
        }

        return validOptions;
    }
}
```

- [ ] **Step 3: 关闭类定义**

确保文件末尾有闭合的 `}`。

- [ ] **Step 4: 编译验证**

```bash
cd D:/project/novel-simulator
mvn compile -q
```

Expected: 编译成功。

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/service/OptionChain.java
git commit -m "feat: add OptionChain - LLM generates options with connection constraint validation"
```

---

### Task 3: 修改 ChooseActionRequest 和 ActionEngine

**Files:**
- Modify: `src/main/java/com/novel/simulator/dto/ChooseActionRequest.java`
- Modify: `src/main/java/com/novel/simulator/service/ActionEngine.java`
- Modify: `src/main/java/com/novel/simulator/dto/ActionResult.java`

- [ ] **Step 1: 修改 ChooseActionRequest — optionId → targetNodeId + label**

```java
package com.novel.simulator.dto;

public class ChooseActionRequest {
    private String sessionId;
    private Long targetNodeId;
    private String label;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
```

- [ ] **Step 2: 修改 ActionEngine.choose() — 不再查 NodeOption，直接按 targetNodeId 导航**

```java
    @Transactional
    public ActionResult choose(String sessionId, Long targetNodeId, String optionLabel) {
        UserSession session = getSession(sessionId);
        UserCharacter character = getCharacter(sessionId);
        character.setChoicesMade(character.getChoicesMade() != null ? character.getChoicesMade() + 1 : 1);
        // 每次选择微增属性
        java.util.Random rnd = new java.util.Random();
        character.setIntelligence(character.getIntelligence() + (rnd.nextBoolean() ? 1 : 0));
        character.setCharm(character.getCharm() + (rnd.nextBoolean() ? 1 : 0));
        character.setLuck(character.getLuck() + (rnd.nextBoolean() ? 1 : 0));
        if (character.getHp() < 100) character.setHp(character.getHp() + 1);

        // 导航到目标节点（如果当前 session 有记录 currentNodeId，记录历史）
        if (session.getCurrentNodeId() != null) {
            updateHistory(session, session.getCurrentNodeId());
        }

        Node targetNode = null;
        if (targetNodeId != null) {
            targetNode = nodeMapper.selectById(targetNodeId);
        }
        if (targetNode != null) {
            session.setCurrentNodeId(targetNode.getId());
        }

        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.updateById(character);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        ActionResult result = new ActionResult();
        result.setActionType("choose");
        result.setChosenOptionLabel(optionLabel != null ? optionLabel : "做出了选择");
        result.setTargetNode(targetNode);
        result.setCharacter(character);
        return result;
    }
```

- [ ] **Step 3: 修改 ActionResult — chosenOption 改为 label 字符串**

将 `private NodeOption chosenOption;` 替换为 `private String chosenOptionLabel;`：

```java
public class ActionResult {
    private String actionType;
    private Node targetNode;
    private String chosenOptionLabel;   // 改为 String，不再引用 NodeOption
    private RandomEvent triggeredEvent;
    private UserCharacter character;
    private String eventTitle;
    private String eventDescription;
    private Map<String, Object> attrChanges;

    // getter/setter
    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public Node getTargetNode() { return targetNode; }
    public void setTargetNode(Node targetNode) { this.targetNode = targetNode; }
    public String getChosenOptionLabel() { return chosenOptionLabel; }
    public void setChosenOptionLabel(String chosenOptionLabel) { this.chosenOptionLabel = chosenOptionLabel; }
    // ... 其余 getter/setter 保持不变
}
```

> 注意：保留原有的 `getChosenOption()` / `setChosenOption()` 需要删除或重命名为 `getChosenOptionLabel()` / `setChosenOptionLabel()`。前端引用处也需要同步更新。

- [ ] **Step 4: 更新 ActionEngine 构造器 — 去掉 NodeOptionMapper 依赖（如果不再需要）**

```java
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
```

> 注意：如果 `NodeOptionMapper` 在其他方法中仍被引用（如 `spin()`），则保留注入。检查 `ActionEngine.java` 中是否还有其他 `nodeOptionMapper` 的使用。按前面的代码浏览，`ActionEngine` 只在 `choose()` 中用了 `nodeOptionMapper`，所以可以移除。

- [ ] **Step 5: 编译验证**

```bash
cd D:/project/novel-simulator
mvn compile -q
```

Expected: 编译成功。如果报错，检查：
- `ActionResult` 中是否还有 `getChosenOption()` / `setChosenOption()` 的旧引用
- `ActionEngine` 构造器参数类型是否匹配（删除 `NodeOptionMapper` 后务必更新）

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/ChooseActionRequest.java \
       src/main/java/com/novel/simulator/service/ActionEngine.java \
       src/main/java/com/novel/simulator/dto/ActionResult.java
git commit -m "refactor: ActionEngine.choose() accepts targetNodeId directly, remove NodeOption dependency"
```

---

### Task 4: 新增 Player API + 清理旧节点接口

**Files:**
- Modify: `src/main/java/com/novel/simulator/controller/PlayerController.java`

- [ ] **Step 1: 新增 option/generate 端点**

在 `PlayerController.java` 中添加：

```java
    private final OptionChain optionChain;

    // 在构造器中添加 optionChain 参数（如果使用构造器注入）
```

在类中合适位置（如 `getNode` 方法附近）添加新端点：

```java
    /**
     * LLM 动态生成选项
     */
    @GetMapping("/option/generate")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<List<OptionVO>> generateOptions(@RequestParam String sessionId,
                                                   @RequestParam Long nodeId) {
        try {
            List<OptionVO> options = optionChain.generateOptions(sessionId, nodeId);
            return Result.success(options);
        } catch (Exception e) {
            log.warn("OptionChain error: {}", e.getMessage());
            return Result.error(500, e.getMessage());
        }
    }
```

- [ ] **Step 2: 在 PlayerController 中注入 OptionChain**

在类字段区域添加：

```java
    private final OptionChain optionChain;
```

在构造器参数中添加 `OptionChain optionChain` 并赋值。

- [ ] **Step 3: 清理 getNode 端点 — 去掉 options 相关返回**

```java
    /**
     * 获取节点详情（选项由 /option/generate 单独获取）
     */
    @GetMapping("/node/{nodeId}")
    public Result<Map<String, Object>> getNode(@PathVariable Long nodeId,
                                                @RequestParam(required = false) String sessionId) {
        Node node = nodeMapper.selectById(nodeId);
        if (node == null) return Result.error(404, "节点不存在");

        // Get character attributes if sessionId is provided
        Map<String, Object> character = null;
        if (sessionId != null && !sessionId.isEmpty()) {
            UserCharacter c = userCharacterMapper.selectOne(
                new LambdaQueryWrapper<UserCharacter>()
                    .eq(UserCharacter::getSessionId, sessionId));
            if (c != null) {
                character = new HashMap<>();
                character.put("hp", c.getHp());
                character.put("attack", c.getAttack());
                character.put("defense", c.getDefense());
                character.put("intelligence", c.getIntelligence());
                character.put("charm", c.getCharm());
                character.put("luck", c.getLuck());
                character.put("currentTitle", c.getCurrentTitle());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("node", node);
        result.put("character", character);
        return Result.success(result);
    }
```

> 注意：移除对 `nodeOptionMapper`、`LambdaQueryWrapper<NodeOption>` 和 `targetRequirements` 的全部引用。

- [ ] **Step 4: 修改 choose 端点 — 适配新的 ChooseActionRequest**

```java
    @PostMapping("/action/choose")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<ActionResult> chooseAction(@RequestBody ChooseActionRequest request,
                                              HttpServletRequest httpRequest) {
        ActionResult result = actionEngine.choose(
            request.getSessionId(),
            request.getTargetNodeId(),
            request.getLabel()
        );
        afterChoose(request.getSessionId());
        return Result.success(result);
    }
```

- [ ] **Step 5: 编译验证**

```bash
cd D:/project/novel-simulator
mvn compile -q
```

Expected: 编译成功。

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/novel/simulator/controller/PlayerController.java
git commit -m "feat: add /option/generate endpoint, cleanup /node/{id} to remove options"
```

---

### Task 5: Admin 清理 — ParseChain + NovelImportController

**Files:**
- Modify: `src/main/java/com/novel/simulator/service/ParseChain.java`
- Modify: `src/main/java/com/novel/simulator/controller/NovelImportController.java`

- [ ] **Step 1: 修改 ParseChain 的 buildParsePrompt — 去掉 options 要求**

找到 `buildParsePrompt()` 方法（或直接构建 prompt 的位置），从 prompt 模板中移除关于 `"options"` 数组的描述和示例。只保留 `nodes` 和 `edges` 的生成要求。

修改前（包含 options 的 prompt 段）：
```
// 去掉类似这样的内容：
// "options": [{"nodeIndex": 0, "label": "探索密道", "targetNodeIndex": 1, "triggerEvent": false, "riskHint": ""}]
```

找到 prompt 中要求生成 `"options"` 的文本，将其删除。保留 `nodes`、`edges` 部分不变。

- [ ] **Step 2: 修改 writeParsedData — 去掉 options 写入**

在 `NovelImportController.java` 中，找到 `writeParsedData()` 方法中的以下代码块并移除：

```java
// 去掉这段（或类似逻辑）：
@SuppressWarnings("unchecked")
List<Map<String, Object>> options = (List<Map<String, Object>>) parseResult.get("options");
if (options != null) {
    for (Map<String, Object> opt : options) {
        NodeOption nodeOption = new NodeOption();
        // ... 设置字段
        nodeOptionMapper.insert(nodeOption);
    }
}
```

同时检查并移除 `NodeOptionMapper` 在 `NovelImportController` 中的注入（如果不再使用）。

- [ ] **Step 3: 编译验证**

```bash
cd D:/project/novel-simulator
mvn compile -q
```

Expected: 编译成功。

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/service/ParseChain.java \
       src/main/java/com/novel/simulator/controller/NovelImportController.java
git commit -m "refactor: remove options generation from ParseChain and import flow"
```

---

### Task 6: Admin 清理 — NodeController + NodeService + SaveNodesRequest

**Files:**
- Modify: `src/main/java/com/novel/simulator/controller/NodeController.java`
- Modify: `src/main/java/com/novel/simulator/service/NodeService.java`
- Modify: `src/main/java/com/novel/simulator/dto/SaveNodesRequest.java`

- [ ] **Step 1: 修改 SaveNodesRequest — 去掉 options 字段**

```java
package com.novel.simulator.dto;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import java.util.List;

public class SaveNodesRequest {
    private Long novelId;
    private List<Node> nodes;
    private List<NodeEdge> edges;

    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
    public List<Node> getNodes() { return nodes; }
    public void setNodes(List<Node> nodes) { this.nodes = nodes; }
    public List<NodeEdge> getEdges() { return edges; }
    public void setEdges(List<NodeEdge> edges) { this.edges = edges; }
}
```

- [ ] **Step 2: 修改 NodeService — 去掉 options 查询和写入**

找到 `getFullNodes()` 方法，去掉类似 `nodeOptionMapper.selectList(...)` 的查询。

找到 `saveNodes()` 方法，去掉类似 `nodeOptionMapper.delete(...)` 和 `nodeOptionMapper.insert(...)` 的写入逻辑。

如果 `NodeOptionMapper` 不再被 `NodeService` 使用，从构造器注入中移除。

- [ ] **Step 3: 修改 NodeController — 去掉 options 字段**

`GET /{id}/nodes` 返回的 map 中去掉 `"options"` 键。
`PUT /{id}/nodes` 接收的 `SaveNodesRequest` 中已没有 `options` 字段。

- [ ] **Step 4: 编译验证**

```bash
cd D:/project/novel-simulator
mvn compile -q
```

Expected: 编译成功。

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/controller/NodeController.java \
       src/main/java/com/novel/simulator/service/NodeService.java \
       src/main/java/com/novel/simulator/dto/SaveNodesRequest.java
git commit -m "refactor: remove options from NodeController, NodeService, SaveNodesRequest"
```

---

### Task 7: 前端 — 修改 useStory hook

**Files:**
- Modify: `frontend/src/hooks/useStory.ts`

- [ ] **Step 1: 更新 NodeOption 接口 — 去掉 minIntelligence/minCharm**

```typescript
export interface NodeOption {
  id?: number;           // 可选，不再从 DB 获取
  label: string;
  targetNodeId: number;
}
```

> 注意：`id` 改为可选，移除 `minIntelligence?` 和 `minCharm?`。

- [ ] **Step 2: 修改 loadNode — 不再处理 options 和 targetRequirements**

```typescript
const loadNode = useCallback(async (nodeId: number) => {
    const sid = session?.sessionId;
    const res = await api.get(`/player/node/${nodeId}${sid ? `?sessionId=${sid}` : ''}`);
    if (res.data.code === 200) {
      setCurrentNode(res.data.data.node);
      setCurrentOptions([]);  // 清空旧选项，稍后由 generateOptions 填充
      if (res.data.data.character) {
        setCharacter(res.data.data.character);
      }
    }
  }, [session]);
```

- [ ] **Step 3: 新增 generateOptions 方法**

```typescript
const generateOptions = useCallback(async (nodeId: number) => {
    if (!session?.sessionId) return;
    try {
      const res = await api.get(`/player/option/generate?sessionId=${session.sessionId}&nodeId=${nodeId}`);
      if (res.data.code === 200) {
        setCurrentOptions(res.data.data || []);
      } else {
        setCurrentOptions([]);
        // 错误由全局拦截器处理
      }
    } catch (e) {
      setCurrentOptions([]);
      throw e;  // 让调用方处理错误
    }
  }, [session]);
```

- [ ] **Step 4: 修改 chooseAction — 接受 targetNodeId + label**

```typescript
const chooseAction = useCallback(async (targetNodeId: number, label: string) => {
    if (!session?.sessionId) return null;
    const res = await api.post('/player/action/choose', {
      sessionId: session.sessionId,
      targetNodeId,
      label,
    });
    if (res.data.code === 200) {
      const data = res.data.data;
      if (data.character) setCharacter(data.character);
      if (data.targetNode?.id) {
        await loadNode(data.targetNode.id);
      }
      return data;
    }
    return null;
  }, [session, loadNode]);
```

- [ ] **Step 5: 修改 return 对象 — 暴露 generateOptions**

```typescript
return {
    session, character, currentNode, currentOptions, loading, sessions,
    createSession, loadSession, loadBySessionId, fetchSessions,
    chooseAction, spinAction,
    loadNode, generateOptions,  // 新增 generateOptions
    saveSession, restartSession, saveSettings,
  };
```

- [ ] **Step 6: 编译检查**

```bash
cd D:/project/novel-simulator/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 无类型错误（或仅剩 ChoicePanel/page-player-story 中的使用错误，后续任务修复）。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useStory.ts
git commit -m "refactor: update useStory - add generateOptions, change chooseAction signature, remove minIntelligence"
```

---

### Task 8: 前端 — 修改 ChoicePanel

**Files:**
- Modify: `frontend/src/components/ChoicePanel.tsx`

- [ ] **Step 1: 重写 ChoicePanel — 去掉属性过滤，onChoose 传对象**

```typescript
import { Button } from 'src/components/ui/button';

export interface OptionItem {
  label: string;
  targetNodeId: number;
}

interface ChoicePanelProps {
  options: OptionItem[];
  disabled?: boolean;
  onChoose: (targetNodeId: number, label: string) => void;
}

export default function ChoicePanel({ options, disabled, onChoose }: ChoicePanelProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">做出你的选择：</p>
      {options.map((opt, idx) => (
        <Button
          key={opt.targetNodeId + '-' + idx}
          variant="outline"
          disabled={disabled}
          onClick={() => onChoose(opt.targetNodeId, opt.label)}
          className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span className="text-sm">{opt.label}</span>
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 编译检查**

```bash
cd D:/project/novel-simulator/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChoicePanel.tsx
git commit -m "refactor: simplify ChoicePanel - remove attribute filtering, onChoose passes targetNodeId+label"
```

---

### Task 9: 前端 — 修改 page-player-story.tsx

**Files:**
- Modify: `frontend/src/pages/page-player-story.tsx`

- [ ] **Step 1: 更新 import — 添加 generateOptions**

```typescript
const { session, character, currentNode, currentOptions, loading,
        loadSession, saveSession, restartSession,
        chooseAction, spinAction, generateOptions } = useStory();
```

- [ ] **Step 2: 节点加载后触发选项生成**

在 `loadNode` 执行完毕后（组件中 `useEffect` 或回调中），调用 `generateOptions`。最佳方案是在 `loadNode` 返回后立即调用：

在 `loadSession` 的 `await loadNode` 之后：

实际上，`loadNode` 和 `generateOptions` 都在 `useStory` 内部。我们需要在 `loadNode` 完成时自动触发选项生成，或者在 `page-player-story.tsx` 中监听 `currentNode` 变化。

修改方式：在 `page-player-story.tsx` 中添加一个 `useEffect`：

```typescript
// 到达节点后自动生成选项
useEffect(() => {
    if (currentNode && session?.sessionId && !loading) {
      generateOptions(currentNode.id).catch(() => {
        toast.error('选项生成失败，请检查 LLM 配置后重试');
      });
    }
  }, [currentNode?.id, session?.sessionId, loading]);
```

- [ ] **Step 3: 修改 handleChoose — 接受 targetNodeId + label**

```typescript
const handleChoose = async (targetNodeId: number, optionLabel: string) => {
    setActionDisabled(true);
    try {
      const result = await chooseAction(targetNodeId, optionLabel);
      if (!sessionId) return;

      // 选项标签用于故事展示
      const choiceLabel = result?.chosenOptionLabel || optionLabel || '做出了选择';

      // 解析设置，判断转盘是否触发
      if (session?.settingsJson) {
        try {
          const settings = JSON.parse(session.settingsJson);
          const rate = settings.randomRate || 0;
          pendingWheelRef.current = Math.random() * 100 < rate;
        } catch { /* ignore */ }
      }

      // 生成选择后的故事
      triggerStory(sessionId, choiceLabel, choiceLabel);
    } catch { setActionDisabled(false); }
  };
```

- [ ] **Step 4: 更新 ChoicePanel 的 onChoose 映射**

```typescript
{!streaming && currentOptions.length > 0 && !showWheel && (
    <ChoicePanel
      options={currentOptions}
      disabled={actionDisabled}
      onChoose={handleChoose}
    />
)}
```

> 注意：`options` 直接传 `currentOptions`（已经是 `OptionItem[]` 格式），不再需要 `.map()` 转换。`character` prop 也可以去掉（ChoicePanel 不再需要它）。

- [ ] **Step 5: 更新 loading 骨架屏中的 ChoicePanel 占位**

loading 骨架屏中的 ChoicePanel 占位保持不变（已经是通用骨架屏），无需修改。

- [ ] **Step 6: 编译检查**

```bash
cd D:/project/novel-simulator/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 无类型错误。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/page-player-story.tsx
git commit -m "refactor: update story page - auto-generate options on node arrival, adapt handleChoose"
```

---

### Task 10: 前端 — 修改 Admin 节点编辑器

**Files:**
- Modify: `frontend/src/pages/page-admin-node-editor.tsx`

- [ ] **Step 1: 去掉 dbOptions 状态定义**

删除 `const [dbOptions, setDbOptions] = useState<any[]>([]);` 这一行。

- [ ] **Step 2: 去掉加载时的 options 读取**

找到加载节点数据的代码（大致在 `res.data.data.options` 的位置），删除：
```typescript
const opts = res.data.data.options || [];
setDbOptions(opts);
```

- [ ] **Step 3: 去掉保存时的 options 发送**

找到保存代码，从请求体中去掉 `options: dbOptions`：
```typescript
// 修改前：
const res = await api.put(`/admin/novel/${novelId}/nodes`, {
    nodes: novelNodes,
    edges: novelEdges,
    options: dbOptions,
});

// 修改后：
const res = await api.put(`/admin/novel/${novelId}/nodes`, {
    nodes: novelNodes,
    edges: novelEdges,
});
```

- [ ] **Step 4: 编译检查**

```bash
cd D:/project/novel-simulator/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/page-admin-node-editor.tsx
git commit -m "refactor: remove dbOptions from admin node editor"
```

---

### Task 11: 全量编译验证

- [ ] **Step 1: 后端编译**

```bash
cd D:/project/novel-simulator
mvn compile -q
```

Expected: BUILD SUCCESS。

- [ ] **Step 2: 前端类型检查**

```bash
cd D:/project/novel-simulator/frontend
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 3: 前端构建**

```bash
npm run build 2>&1 | tail -5
```

Expected: 构建成功，无报错。

- [ ] **Step 4: Commit 所有剩余改动**

```bash
git add -A
git commit -m "feat: complete OptionChain implementation"
```

---

## 不涉及改动的确认

| 模块 | 原因 |
|------|------|
| `EventChain.java` | 不受影响 |
| `StoryChain.java` | 不受影响 |
| `BranchChain.java` | 不受影响（空文件） |
| 转盘组件 (`WheelOfFortune.tsx`) | 不受影响 |
| `StoryViewer.tsx` | 不受影响 |
| `CharacterPanel.tsx` | 不受影响 |
| `EndingModal.tsx` | 不受影响 |
| `SaveLoadModal.tsx` | 不受影响 |
| `useSSE.ts` | 不受影响 |
| 数据库 DDL | node_option 表保留不动 |
| application.yml | 配置不变 |
