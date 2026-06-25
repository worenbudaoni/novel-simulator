package com.novel.simulator.service;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.UserCharacter;
import com.novel.simulator.entity.UserSession;
import com.novel.simulator.mapper.NovelMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class StoryChain {
    private static final Logger log = LoggerFactory.getLogger(StoryChain.class);

    private final NovelMapper novelMapper;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public StoryChain(NovelMapper novelMapper) {
        this.novelMapper = novelMapper;
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
                return generateStoryWithLlm(session, currentNode, character, actionDescription);
            } catch (Exception e) {
                log.warn("LLM story generation failed, falling back to stub: {}", e.getMessage());
            }
        }
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

        // 前情提要：取最近一段故事作为上下文
        String storyContext = "";
        if (session.getStorySummary() != null && !session.getStorySummary().isEmpty()) {
            storyContext = session.getStorySummary();
        } else if (session.getStoryText() != null && session.getStoryText().length() > 100) {
            String full = session.getStoryText();
            storyContext = full.substring(Math.max(0, full.length() - 300));
        }

        String prompt = "你是一个顶级互动叙事作家，正在创作一部沉浸式互动故事。\n\n"
            + "## 世界观设定\n"
            + (worldView != null ? worldView : "未知") + "\n\n"
            + "## 当前场景\n"
            + "地点：" + (currentNode.getTitle() != null ? currentNode.getTitle() : "未知") + "\n"
            + "描述：" + (currentNode.getDescription() != null ? currentNode.getDescription() : "") + "\n\n"
            + "## 角色当前状态\n"
            + "气血：" + hp + "/100　攻击：" + atk + "　防御：" + def + "\n"
            + "悟性：" + inte + "　魅力：" + cha + "　气运：" + luk + "\n"
            + "已做出选择：" + choices + " 次\n\n"
            + (!storyContext.isEmpty()
                ? "## 前情提要\n" + storyContext + "\n\n"
                : "")
            + (actionDescription != null && !actionDescription.isEmpty()
                ? "## 当前行动\n" + actionDescription + "\n\n"
                : "")
            + "---\n\n"
            + "请以上述内容为基础，写一段 300-500 字的故事。要求：\n\n"
            + "1. **以第二人称\"你\"叙述**，让玩家身临其境\n"
            + "2. **以前情提要为基础续写**，保持情节连贯，不能断裂或重复\n"
            + "3. **融入世界观细节**：使用世界观中的地名、人物、势力、规则，让玩家感觉这是一个真实的世界\n"
            + "4. **角色属性影响叙述**：\n"
            + "   - 气血低 → 伤势沉重、步履维艰\n"
            + "   - 悟性高 → 洞察秋毫、发现隐藏线索\n"
            + "   - 魅力高 → 言语动人、他人态度友善\n"
            + "   - 气运高 → 机缘巧合、绝处逢生\n"
            + "5. **【当前行动】存在时**：以当前行动为故事核心展开，如果是事件描述则将其无缝融入叙事\n"
            + "6. **语言生动精彩**：善用比喻、感官描写（视觉/听觉/触觉），避免平铺直叙\n"
            + "7. **结尾留下余韵**：自然过渡到下一步，让玩家有继续探索的欲望\n"
            + "8. **禁止**：出现\"你做出了选择\"\"你决定\"等元描述";

        LlmResult llmResult = callLlm(prompt);
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
