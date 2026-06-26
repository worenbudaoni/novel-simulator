package com.novel.simulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.ResolutionResult;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.UserCharacter;
import com.novel.simulator.entity.UserSession;
import com.novel.simulator.mapper.NovelMapper;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.output.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class StoryChain {
    private static final Logger log = LoggerFactory.getLogger(StoryChain.class);
    private static final String REDIS_KEY_PREFIX = "cache:session:";
    private static final String HISTORY_KEY_SUFFIX = ":chat_history";
    private static final long REDIS_TTL = 24;

    private final NovelMapper novelMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final SessionContextService sessionContextService;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public StoryChain(NovelMapper novelMapper, StringRedisTemplate redisTemplate, ObjectMapper objectMapper,
                       SessionContextService sessionContextService) {
        this.novelMapper = novelMapper;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.sessionContextService = sessionContextService;
    }

    // ========== Public API ==========

    public String generateStory(UserSession session, Node currentNode,
                                UserCharacter character, String actionDescription) {
        if (llmApiKey != null && !llmApiKey.isEmpty()) {
            try {
                return generateStoryWithLlm(session, currentNode, character, actionDescription);
            } catch (Exception e) {
                log.warn("LLM story generation failed, falling back to stub: {}", e.getMessage());
            }
        }
        return generateStoryStub(currentNode, character, actionDescription);
    }

    /**
     * 新方法：接收完整 ResolutionResult，嵌入式检定数据到 prompt
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

    public String generateSummary(String fullStory) {
        if (fullStory == null || fullStory.length() < 100) return fullStory;
        return fullStory.substring(0, 100) + "...（后续内容已压缩）";
    }

    public void clearHistory(String sessionId) {
        redisTemplate.delete(REDIS_KEY_PREFIX + sessionId + HISTORY_KEY_SUFFIX);
    }

    // ========== LLM Chat ==========

    private ChatLanguageModel buildModel(double temperature, int maxTokens) {
        return OpenAiChatModel.builder()
            .apiKey(llmApiKey != null ? llmApiKey : "sk-placeholder")
            .modelName(llmModelName)
            .baseUrl(llmApiUrl)
            .temperature(temperature)
            .maxTokens(maxTokens)
            .timeout(Duration.ofSeconds(60))
            .build();
    }

    // ========== Redis Chat History (OpenAI format) ==========

    private String historyKey(String sessionId) {
        return REDIS_KEY_PREFIX + sessionId + HISTORY_KEY_SUFFIX;
    }

    /** 从 Redis 读取完整对话历史 */
    private List<Map<String, String>> loadHistory(String sessionId) {
        String json = redisTemplate.opsForValue().get(historyKey(sessionId));
        if (json == null || json.isEmpty()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, String>>>() {});
        } catch (Exception e) {
            log.warn("Failed to deserialize chat history, starting fresh: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    /** 保存完整对话历史到 Redis */
    private void saveHistory(String sessionId, List<Map<String, String>> history) {
        try {
            String json = objectMapper.writeValueAsString(history);
            redisTemplate.opsForValue().set(historyKey(sessionId), json, REDIS_TTL, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Failed to serialize chat history: {}", e.getMessage());
        }
    }

    /** 追加一条消息到对话历史 */
    private void appendMessage(String sessionId, String role, String content) {
        List<Map<String, String>> history = loadHistory(sessionId);
        Map<String, String> msg = new HashMap<>();
        msg.put("role", role);
        msg.put("content", content);
        history.add(msg);
        saveHistory(sessionId, history);
    }

    /** 将 Redis 里 JSON 格式的历史转为 LangChain4j ChatMessage 列表 */
    private List<ChatMessage> historyToChatMessages(List<Map<String, String>> history) {
        List<ChatMessage> messages = new ArrayList<>();
        for (Map<String, String> msg : history) {
            String role = msg.get("role");
            String content = msg.get("content");
            if (content == null) continue;
            switch (role) {
                case "system":
                    messages.add(new SystemMessage(content));
                    break;
                case "user":
                    messages.add(new UserMessage(content));
                    break;
                case "assistant":
                    messages.add(new AiMessage(content));
                    break;
            }
        }
        return messages;
    }

    // ========== 初始上下文 ==========

    /** 创建初始 system 消息：世界观、作品名、场景、角色状态、规则 */
    private String buildSystemPrompt(Novel novel, Node currentNode, UserCharacter character) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个互动叙事作家。请用中文第二人称「你」写沉浸式互动故事。\n\n");

        // 作品信息
        String title = novel != null ? novel.getTitle() : "未知";
        String worldView = novel != null ? novel.getWorldView() : "";
        sb.append("作品：《").append(title).append("》\n");
        if (worldView != null && !worldView.isEmpty()) {
            sb.append("世界观：").append(worldView).append("\n");
        }

        // 当前场景
        sb.append("\n当前场景：").append(currentNode.getTitle() != null ? currentNode.getTitle() : "未知");
        if (currentNode.getDescription() != null && !currentNode.getDescription().isEmpty()) {
            sb.append(" — ").append(currentNode.getDescription());
        }
        sb.append("\n");

        // 角色状态（供参考，不直接提及数值）
        int hp = character.getHp() != null ? character.getHp() : 100;
        int atk = character.getAttack() != null ? character.getAttack() : 10;
        int def = character.getDefense() != null ? character.getDefense() : 10;
        int inte = character.getIntelligence() != null ? character.getIntelligence() : 50;
        int cha = character.getCharm() != null ? character.getCharm() : 50;
        int luk = character.getLuck() != null ? character.getLuck() : 50;
        sb.append("\n角色状态：气血").append(hp).append("/100，攻击").append(atk)
            .append("，防御").append(def).append("，智力").append(inte)
            .append("，魅力").append(cha).append("，气运").append(luk).append("\n");

        // 写作规则
        sb.append("\n【写作规则】\n");
        sb.append("- 用第二人称「你」叙述，让读者沉浸其中。\n");
        sb.append("- 只输出正文，不要标题、不要「你选择了」「你决定」等引导语。\n");
        sb.append("- 属性影响行为，但不直接提及数值。\n");
        sb.append("- 用具体的场景、动作、对话、感官细节来推进故事。\n");
        sb.append("- 前面发生的事件要作为已经发生的来承接。\n");
        sb.append("- 结尾留下悬念或期待。\n");
        sb.append("- 每次写一段 300-500 字的连续性叙述。\n");
        sb.append("- 后续玩家的每次操作会以 user 消息给出，请根据对话历史续写。");

        return sb.toString();
    }

    // ========== Story Generation ==========

    private String generateStoryWithLlm(UserSession session, Node currentNode,
                                        UserCharacter character, String actionDescription) {
        // 如果 description 很短，尝试从 Redis 读取待处理事件
        if (actionDescription == null || actionDescription.length() < 20) {
            String pendingEvent = redisTemplate.opsForValue().get(
                REDIS_KEY_PREFIX + session.getSessionId() + ":pending_event");
            if (pendingEvent != null && !pendingEvent.isEmpty()) {
                actionDescription = pendingEvent;
                redisTemplate.delete(REDIS_KEY_PREFIX + session.getSessionId() + ":pending_event");
            }
        }

        Novel novel = novelMapper.selectById(session.getNovelId());

        // 1. 检查是否有对话历史
        List<Map<String, String>> history = loadHistory(session.getSessionId());

        if (history.isEmpty()) {
            // 首次生成：创建 system prompt 作为初始上下文
            String systemPrompt = buildSystemPrompt(novel, currentNode, character);
            Map<String, String> sysMsg = new HashMap<>();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);
            history.add(sysMsg);
        }

        // 2. 追加当前操作为 user 消息
        String userContent = actionDescription != null && !actionDescription.isEmpty()
            ? actionDescription : "继续推进故事";
        Map<String, String> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", userContent);
        history.add(userMsg);

        // 3. 构建完整消息列表
        List<ChatMessage> messages = historyToChatMessages(history);
        ChatLanguageModel model = buildModel(0.8, 4096);
        Response<AiMessage> llmResponse = model.generate(messages);
        String storyText = llmResponse.content().text();
        log.info("LLM generated {} chars for session {}", storyText.length(), session.getSessionId());

        // 4. 追加 assistant 回复到历史
        Map<String, String> assistantMsg = new HashMap<>();
        assistantMsg.put("role", "assistant");
        assistantMsg.put("content", storyText);
        history.add(assistantMsg);

        // 5. 保存完整历史到 Redis
        saveHistory(session.getSessionId(), history);

        return storyText;
    }

    // ========== Story with ResolutionResult ==========

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
        userContent.append("你的选择：").append(resolution.getRiskLevel() != null ? resolution.getRiskLevel() : "").append("行动\n");
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
            for (Map.Entry<String, Integer> e : resolution.getAttrChanges().entrySet()) {
                userContent.append(e.getKey()).append(e.getValue() >= 0 ? "+" : "").append(e.getValue()).append(" ");
            }
            userContent.append("\n");
        }

        // 事件
        if (resolution.getEventTitle() != null) {
            userContent.append("- 触发事件：").append(resolution.getEventTitle()).append("\n");
            if (resolution.getEventContent() != null) {
                userContent.append("  事件内容：").append(resolution.getEventContent()).append("\n");
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

        sessionContextService.appendRound(session.getSessionId(),
            "选择「" + (resolution.getChoiceLabel() != null ? resolution.getChoiceLabel() : "") + "」(" + resolution.getRiskLevel() + ")",
            buildCheckSummary(resolution),
            storyText);

        return storyText;
    }

    // ========== Ending Generation ==========

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

        // 读取完整对话历史
        List<Map<String, String>> history = loadHistory(session.getSessionId());

        // 追加结局请求
        String endingPrompt = "请为这段冒险写一个结局。\n\n"
            + "世界观：" + (worldView != null ? worldView : "未知") + "\n"
            + "角色最终状态：气血" + hp + "/100，攻击" + atk + "，防御" + def
            + "，智力" + inte + "，魅力" + cha + "，气运" + luk + "\n"
            + "共做出 " + choices + " 次选择，经历了 " + events + " 次事件\n\n"
            + "要求：\n"
            + "- 回顾历程，呼应关键节点\n"
            + "- 根据最终状态决定基调（气血高→圆满，中等→遗憾但坚持，低→壮烈）\n"
            + "- 融入世界观，让结局有意义\n"
            + "- 200-300 字";

        Map<String, String> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", endingPrompt);
        history.add(userMsg);

        List<ChatMessage> messages = historyToChatMessages(history);
        ChatLanguageModel model = buildModel(0.8, 2048);
        Response<AiMessage> llmResponse = model.generate(messages);
        String endingText = llmResponse.content().text();

        Map<String, String> assistantMsg = new HashMap<>();
        assistantMsg.put("role", "assistant");
        assistantMsg.put("content", endingText);
        history.add(assistantMsg);
        saveHistory(session.getSessionId(), history);

        return endingText;
    }

    // ========== Check Summary ==========

    private String buildCheckSummary(ResolutionResult resolution) {
        StringBuilder sb = new StringBuilder();
        if ("risky".equals(resolution.getRiskLevel()) && resolution.getCheckAttr() != null) {
            sb.append(resolution.getCheckAttr()).append("=").append(resolution.getAttrValue())
                .append(", D").append(resolution.getDiceRoll())
                .append(resolution.getModifier() >= 0 ? "+" : "").append(resolution.getModifier())
                .append("=").append(resolution.getTotal())
                .append(" vs DC").append(resolution.getDc())
                .append(" → ").append(resolution.isSuccess() ? "成功" : "失败");
        } else {
            sb.append("无检定");
        }
        return sb.toString();
    }

    // ========== Stub fallbacks ==========

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

    /** Stub 降级：附带检定摘要 */
    public String generateStoryStub(Node currentNode, UserCharacter character, ResolutionResult resolution) {
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
}
