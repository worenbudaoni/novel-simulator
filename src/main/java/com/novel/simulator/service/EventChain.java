package com.novel.simulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
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
import java.util.stream.Collectors;

@Service
public class EventChain {
    private static final Logger log = LoggerFactory.getLogger(EventChain.class);
    private static final String HISTORY_KEY_PREFIX = "cache:session:";
    private static final String HISTORY_KEY_SUFFIX = ":chat_history";

    private final NovelMapper novelMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public EventChain(NovelMapper novelMapper, ObjectMapper objectMapper, StringRedisTemplate redisTemplate) {
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
        String novelTitle = novel != null ? novel.getTitle() : "";

        // 读取共享的对话历史（与 StoryChain 同源），取最近一条 assistant 消息作为上下文
        String storyContext = "";
        try {
            String historyJson = redisTemplate.opsForValue().get(
                HISTORY_KEY_PREFIX + session.getSessionId() + HISTORY_KEY_SUFFIX);
            if (historyJson != null && !historyJson.isEmpty()) {
                List<Map<String, String>> history = objectMapper.readValue(
                    historyJson, new TypeReference<List<Map<String, String>>>() {});
                // 从后往前找最近一条 assistant 消息
                for (int i = history.size() - 1; i >= 0; i--) {
                    if ("assistant".equals(history.get(i).get("role"))) {
                        String content = history.get(i).get("content");
                        if (content != null && !content.isEmpty()) {
                            storyContext = content.length() > 300
                                ? content.substring(content.length() - 300)
                                : content;
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to read chat history for event context: {}", e.getMessage());
        }

        // Null-safe defaults for character stats
        int hp = character.getHp() != null ? character.getHp() : 100;
        int atk = character.getAttack() != null ? character.getAttack() : 10;
        int def = character.getDefense() != null ? character.getDefense() : 10;
        int inte = character.getIntelligence() != null ? character.getIntelligence() : 50;
        int cha = character.getCharm() != null ? character.getCharm() : 50;
        int luk = character.getLuck() != null ? character.getLuck() : 50;

        int sector = new Random().nextInt(6);
        String[] sectorNames = {"奇遇", "宝箱", "战斗", "诅咒", "命运", "邂逅"};
        String sectorName = sectorNames[sector];

        String prompt = "你是一个严格遵循原作的互动故事事件生成器。\n\n"
            + "【作品名称】\n" + (novelTitle != null ? novelTitle : "未知") + "\n\n"
            + "【世界观·设定】\n" + (worldView != null && !worldView.isEmpty() ? worldView : "未知") + "\n\n"
            + "【当前场景】\n" + (currentNode.getTitle() != null ? currentNode.getTitle() : "未知")
            + " — " + (currentNode.getDescription() != null ? currentNode.getDescription() : "") + "\n\n"
            + "【角色状态】\n"
            + "HP=" + hp + ", 攻击=" + atk + ", 防御=" + def + "\n"
            + "悟性=" + inte + ", 魅力=" + cha + ", 气运=" + luk + "\n\n"
            + "【扇区类型】\n" + sectorName + "\n\n"
            + (!storyContext.isEmpty()
                ? "【最近的故事进展（以此为基础继续，不要脱离当前叙事）】\n" + storyContext + "\n\n"
                : "")
            + "请生成一个严格符合该作品世界观的事件，严格返回以下 JSON 格式（不要 markdown 代码块标记，不要额外内容）：\n\n"
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
            + "【必须遵守的规则】\n"
            + "- 所有内容必须严格限定在《" + (novelTitle != null ? novelTitle : "该作品") + "》的世界观范围内\n"
            + "- 禁止出现任何该作品中不存在的人物、地点、概念或设定\n"
            + "- 使用该作品中已有的地名、角色、势力、科技或规则来构建事件\n"
            + "- content：500-1000 字，像小说段落一样丰富，有场景描写、氛围渲染、细节刻画\n"
            + "- title：带情绪/氛围的标题，贴合该作品的风格\n"
            + "- HP 变化范围 -30 到 +30，其他属性 -5 到 +5\n"
            + "- 正面扇区属性变化多为正，负面多为负\n"
            + "- 当前 HP 低时伤害相应减小（避免秒杀）\n"
            + "- 数值合理，符合该作品的逻辑";

        LlmResult llmResult = callLlm(prompt);
        if (llmResult.error != null) {
            throw new RuntimeException(llmResult.error);
        }

        String json = extractJson(llmResult.text);
        Map<String, Object> parsed;
        try {
            parsed = objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("JSON parse failed: " + e.getMessage());
        }

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
}
