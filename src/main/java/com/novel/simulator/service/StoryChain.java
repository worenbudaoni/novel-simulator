package com.novel.simulator.service;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.UserCharacter;
import com.novel.simulator.entity.UserSession;
import com.novel.simulator.mapper.NovelMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Service
public class StoryChain {
    private static final Logger log = LoggerFactory.getLogger(StoryChain.class);
    private static final String REDIS_KEY_PREFIX = "cache:session:";
    private static final long REDIS_TTL = 24;

    private final NovelMapper novelMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public StoryChain(NovelMapper novelMapper, StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.novelMapper = novelMapper;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
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

    public String generateStory(UserSession session, Node currentNode,
                                UserCharacter character, String actionDescription) {
        if (llmApiKey != null && !llmApiKey.isEmpty()) {
            try {
                String result = generateStoryWithLlm(session, currentNode, character, actionDescription);
                // 生成成功后缓存上下文到 Redis
                cacheStoryContext(session.getSessionId(), result);
                return result;
            } catch (Exception e) {
                log.warn("LLM story generation failed, falling back to stub: {}", e.getMessage());
            }
        }
        return generateStoryStub(currentNode, character, actionDescription);
    }

    /** 从 Redis 获取前文缓存，不存在则回退到 MySQL */
    private String getCachedContext(String sessionId) {
        String context = redisTemplate.opsForValue().get(REDIS_KEY_PREFIX + sessionId + ":story_context");
        if (context != null && !context.isEmpty()) return context;
        return null;
    }

    /** 生成后将最近故事缓存到 Redis，用于下次续写上下文 */
    private void cacheStoryContext(String sessionId, String storyText) {
        if (storyText == null || storyText.isEmpty()) return;
        String tail = storyText.length() > 500 ? storyText.substring(storyText.length() - 500) : storyText;
        redisTemplate.opsForValue().set(
            REDIS_KEY_PREFIX + sessionId + ":story_context",
            tail,
            REDIS_TTL,
            TimeUnit.HOURS
        );
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

        // 优先从 Redis 获取上下文，回退到 MySQL
        String storyContext = getCachedContext(session.getSessionId());
        if (storyContext == null) {
            if (session.getStorySummary() != null && !session.getStorySummary().isEmpty()) {
                storyContext = session.getStorySummary();
            } else if (session.getStoryText() != null && session.getStoryText().length() > 100) {
                String full = session.getStoryText();
                storyContext = full.substring(Math.max(0, full.length() - 300));
            }
        }

        StringBuilder prompt = new StringBuilder();
        prompt.append("你正在用中文写一篇互动小说。请续写以下内容，只输出小说正文，不要任何标题、注释或说明。\n\n");

        // 背景：融入式描述，不用标题
        prompt.append("【故事背景】").append("\n");
        if (worldView != null && !worldView.isEmpty()) {
            prompt.append(worldView).append("\n");
        }
        prompt.append("当前所在地：").append(currentNode.getTitle() != null ? currentNode.getTitle() : "未知").append("\n");
        if (currentNode.getDescription() != null && !currentNode.getDescription().isEmpty()) {
            prompt.append(currentNode.getDescription()).append("\n");
        }

        // 角色状态：告诉 LLM 但不让它直接引用数字
        prompt.append("\n【角色状态（仅供你参考，无需在正文中提及具体数值）】").append("\n");
        prompt.append("生命值：").append(hp).append("/100，攻击：").append(atk).append("，防御：").append(def).append("\n");
        prompt.append("智力：").append(inte).append("，魅力：").append(cha).append("，气运：").append(luk).append("\n");

        // 前文：续写的关键上下文
        if (storyContext != null && !storyContext.isEmpty()) {
            prompt.append("\n【已有故事（请以此为基础上续写，不要重复前文内容）】").append("\n");
            prompt.append(storyContext).append("\n");
        }

        // 当前行动
        if (actionDescription != null && !actionDescription.isEmpty()) {
            prompt.append("\n【接下来发生的事件（请将其自然地融入续写中）】").append("\n");
            prompt.append(actionDescription).append("\n");
        }

        prompt.append("\n【写作要求】").append("\n");
        prompt.append("- 用第二人称「你」叙述，让读者沉浸其中。").append("\n");
        prompt.append("- 只输出正文，不要标题、不要「你选择了」「你决定」等引导语。").append("\n");
        prompt.append("- 属性影响行为，但不直接提及数值：「他注意到角落的符文」而不是「你的智力高所以你注意到了」。").append("\n");
        prompt.append("- 用具体的场景、动作、对话、感官细节来推进故事，而非抽象描述。").append("\n");
        prompt.append("- 前面发生的事件要作为已经发生的来承接，不能重复描述。").append("\n");
        prompt.append("- 结尾留下悬念或期待，让故事有继续推进的动力。").append("\n");
        prompt.append("- 写一段 300-500 字的连续性叙述。");

        LlmResult llmResult = callLlm(prompt.toString());
        if (llmResult.error != null) {
            throw new RuntimeException(llmResult.error);
        }
        return llmResult.text;
    }

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

    public String generateSummary(String fullStory) {
        if (fullStory == null || fullStory.length() < 100) return fullStory;
        return fullStory.substring(0, 100) + "...（后续内容已压缩）";
    }
}
