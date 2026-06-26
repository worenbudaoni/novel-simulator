package com.novel.simulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.OptionVO;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
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
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OptionChain {

    private static final Logger log = LoggerFactory.getLogger(OptionChain.class);

    private static final String HISTORY_KEY_PREFIX = "cache:session:";
    private static final String HISTORY_KEY_SUFFIX = ":chat_history";

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

    private String callLlm(String prompt) {
        if (llmApiKey == null || llmApiKey.isEmpty()) {
            throw new RuntimeException("LLM API Key 未配置");
        }
        ChatLanguageModel model = OpenAiChatModel.builder()
            .apiKey(llmApiKey)
            .modelName(llmModelName)
            .baseUrl(llmApiUrl)
            .temperature(0.7)
            .maxTokens(1024)
            .timeout(Duration.ofSeconds(60))
            .build();
        List<ChatMessage> messages = Collections.singletonList(new UserMessage(prompt));
        Response<AiMessage> response = model.generate(messages);
        String text = response.content().text();
        if (text == null || text.trim().isEmpty()) {
            throw new RuntimeException("LLM 返回内容为空");
        }
        return text;
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

    private String loadRecentContext(String sessionId) {
        String historyJson = redisTemplate.opsForValue().get(HISTORY_KEY_PREFIX + sessionId + HISTORY_KEY_SUFFIX);
        if (historyJson == null || historyJson.isEmpty()) {
            return "";
        }
        try {
            List<Map<String, String>> history = objectMapper.readValue(historyJson,
                new TypeReference<List<Map<String, String>>>() {});
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
            return ctx.toString();
        } catch (Exception e) {
            log.warn("Failed to parse chat history: {}", e.getMessage());
            return "";
        }
    }

    private String buildPrompt(Novel novel, String worldView, Node currentNode,
                               int hp, int atk, int def, int inte, int cha, int luk,
                               StringBuilder connSb, String recentContext) {
        return "你是一个互动叙事游戏的设计师。请根据以下信息，为玩家生成 3-4 个选择。\n\n"
            + "【作品】" + (novel != null ? novel.getTitle() : "") + "\n"
            + "【世界观】" + worldView + "\n"
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
    }

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

        if (character == null) {
            log.warn("No UserCharacter found for sessionId: {}", sessionId);
        }

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
        Map<Long, Node> targetNodeMap = targetNodes.stream().collect(Collectors.toMap(Node::getId, n -> n, (a, b) -> a));

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
        String recentContext = loadRecentContext(sessionId);

        // 7. 构建属性文本
        int hp = character != null && character.getHp() != null ? character.getHp() : 100;
        int atk = character != null && character.getAttack() != null ? character.getAttack() : 10;
        int def = character != null && character.getDefense() != null ? character.getDefense() : 10;
        int inte = character != null && character.getIntelligence() != null ? character.getIntelligence() : 50;
        int cha = character != null && character.getCharm() != null ? character.getCharm() : 50;
        int luk = character != null && character.getLuck() != null ? character.getLuck() : 50;

        // 8. 构建 Prompt
        String prompt = buildPrompt(novel, worldView, currentNode, hp, atk, def, inte, cha, luk, connSb, recentContext);

        // 9. 调用 LLM
        String llmText;
        try {
            llmText = callLlm(prompt);
        } catch (Exception e) {
            throw new RuntimeException("选项生成失败: " + e.getMessage());
        }

        // 10. 解析 JSON
        List<OptionVO> options;
        try {
            String json = extractJson(llmText);
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
