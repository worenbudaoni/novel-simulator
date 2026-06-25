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
        sb.append("你来到了「").append(currentNode.getTitle()).append("」.\n\n");
        if (currentNode.getDescription() != null && !currentNode.getDescription().isEmpty()) {
            sb.append(currentNode.getDescription()).append("\n\n");
        }
        if (actionDescription != null && !actionDescription.isEmpty()) {
            sb.append(actionDescription).append("\n\n");
        }
        sb.append("四周的环境让你感到既熟悉又陌生。你握紧了手中的武器，继续前行。\n");
        return sb.toString();
    }

    public String generateSummary(String fullStory) {
        if (fullStory == null || fullStory.length() < 100) return fullStory;
        return fullStory.substring(0, 100) + "...（后续内容已压缩）";
    }
}
