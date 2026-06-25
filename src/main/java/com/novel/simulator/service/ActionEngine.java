package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.ActionResult;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ActionEngine {

    private final NodeMapper nodeMapper;
    private final NodeOptionMapper nodeOptionMapper;
    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final RandomEventMapper randomEventMapper;
    private final EventEngine eventEngine;
    private final ObjectMapper objectMapper;

    public ActionEngine(NodeMapper nodeMapper, NodeOptionMapper nodeOptionMapper,
                        UserSessionMapper userSessionMapper, UserCharacterMapper userCharacterMapper,
                        RandomEventMapper randomEventMapper, EventEngine eventEngine,
                        ObjectMapper objectMapper) {
        this.nodeMapper = nodeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.randomEventMapper = randomEventMapper;
        this.eventEngine = eventEngine;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ActionResult choose(String sessionId, Long optionId) {
        UserSession session = getSession(sessionId);
        NodeOption option = nodeOptionMapper.selectById(optionId);
        if (option == null) throw new RuntimeException("选项不存在");

        UserCharacter character = getCharacter(sessionId);
        character.setChoicesMade(character.getChoicesMade() != null ? character.getChoicesMade() + 1 : 1);
        updateHistory(session, option.getNodeId());

        Node targetNode = null;
        if (option.getTargetNodeId() != null) {
            targetNode = nodeMapper.selectById(option.getTargetNodeId());
        }
        if (targetNode != null) {
            session.setCurrentNodeId(targetNode.getId());
        }

        RandomEvent triggeredEvent = null;
        boolean eventTriggered = false;
        if (Boolean.TRUE.equals(option.getTriggerEvent())) {
            triggeredEvent = eventEngine.drawEvent(session.getNovelId(), option.getNodeId());
            if (triggeredEvent != null) {
                eventTriggered = true;
                applyEventEffects(character, triggeredEvent);
                character.setEventsTriggered(character.getEventsTriggered() != null ? character.getEventsTriggered() + 1 : 1);
            }
        }

        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.updateById(character);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        ActionResult result = new ActionResult();
        result.setActionType("choose");
        result.setChosenOption(option);
        result.setTargetNode(targetNode);
        result.setTriggeredEvent(eventTriggered ? triggeredEvent : null);
        result.setCharacter(character);
        return result;
    }

    @Transactional
    public ActionResult spin(String sessionId, Long nodeId) {
        UserSession session = getSession(sessionId);
        UserCharacter character = getCharacter(sessionId);

        RandomEvent event = eventEngine.drawEvent(session.getNovelId(), nodeId);
        if (event == null) {
            ActionResult result = new ActionResult();
            result.setActionType("spin");
            result.setCharacter(character);
            return result;
        }

        applyEventEffects(character, event);
        character.setEventsTriggered(character.getEventsTriggered() != null ? character.getEventsTriggered() + 1 : 1);
        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.updateById(character);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        ActionResult result = new ActionResult();
        result.setActionType("spin");
        result.setTriggeredEvent(event);
        result.setCharacter(character);
        return result;
    }

    private void applyEventEffects(UserCharacter character, RandomEvent event) {
        if (event.getAttrChanges() != null && !event.getAttrChanges().isEmpty()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> changes = objectMapper.readValue(event.getAttrChanges(), Map.class);
                if (changes.containsKey("hp")) character.setHp(character.getHp() + ((Number) changes.get("hp")).intValue());
                if (changes.containsKey("attack")) character.setAttack(character.getAttack() + ((Number) changes.get("attack")).intValue());
                if (changes.containsKey("defense")) character.setDefense(character.getDefense() + ((Number) changes.get("defense")).intValue());
                if (changes.containsKey("intelligence")) character.setIntelligence(character.getIntelligence() + ((Number) changes.get("intelligence")).intValue());
                if (changes.containsKey("charm")) character.setCharm(character.getCharm() + ((Number) changes.get("charm")).intValue());
                if (changes.containsKey("luck")) character.setLuck(character.getLuck() + ((Number) changes.get("luck")).intValue());
            } catch (Exception ignored) {}
        }
    }

    private void updateHistory(UserSession session, Long nodeId) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> history = objectMapper.readValue(session.getHistoryPath(), List.class);
            history.add(nodeId);
            session.setHistoryPath(objectMapper.writeValueAsString(history));
        } catch (Exception ignored) {}
    }

    private UserSession getSession(String sessionId) {
        UserSession session = userSessionMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getSessionId, sessionId));
        if (session == null) throw new RuntimeException("会话不存在");
        return session;
    }

    private UserCharacter getCharacter(String sessionId) {
        UserCharacter character = userCharacterMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));
        if (character == null) throw new RuntimeException("角色属性不存在");
        return character;
    }
}
