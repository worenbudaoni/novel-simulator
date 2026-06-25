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

        String prompt = "你是一个互动叙事大师，正在创作一部根据以下世界观改编的互动故事。\n\n"
            + "【世界观】\n" + (worldView != null ? worldView : "未知") + "\n\n"
            + "【当前场景】\n"
            + "节点：" + (currentNode.getTitle() != null ? currentNode.getTitle() : "未知") + "\n"
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
