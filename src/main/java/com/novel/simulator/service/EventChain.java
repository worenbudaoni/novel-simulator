package com.novel.simulator.service;

import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.NovelMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;

@Service
public class EventChain {
    private static final Logger log = LoggerFactory.getLogger(EventChain.class);
    private static final String HISTORY_KEY_PREFIX = "cache:session:";

    private final NovelMapper novelMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public EventChain(NovelMapper novelMapper,
                      ObjectMapper objectMapper, StringRedisTemplate redisTemplate) {
        this.novelMapper = novelMapper;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
    }

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

    private int getInt(Object value) {
        if (value instanceof Number) return ((Number) value).intValue();
        return 0;
    }
}
