package com.novel.simulator.service;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.UserCharacter;
import com.novel.simulator.entity.UserSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class StoryChain {
    private static final Logger log = LoggerFactory.getLogger(StoryChain.class);

    public String generateStory(UserSession session, Node currentNode,
                                UserCharacter character, String actionDescription) {
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
