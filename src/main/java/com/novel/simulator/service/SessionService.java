package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class SessionService {

    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final NodeMapper nodeMapper;
    private final ObjectMapper objectMapper;

    public SessionService(UserSessionMapper userSessionMapper,
                          UserCharacterMapper userCharacterMapper,
                          NodeMapper nodeMapper,
                          ObjectMapper objectMapper) {
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.nodeMapper = nodeMapper;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public UserSession create(Long novelId, Long userId) {
        return create(novelId, userId, null, null, null, null, null, null, null);
    }

    @Transactional
    public UserSession create(Long novelId, Long userId, String characterName,
                               Integer hp, Integer attack, Integer defense,
                               Integer intelligence, Integer charm, Integer luck) {
        Node startNode = nodeMapper.selectOne(
            new LambdaQueryWrapper<Node>()
                .eq(Node::getNovelId, novelId).eq(Node::getIsStart, true));
        if (startNode == null) throw new RuntimeException("该作品没有起始节点");

        String sessionId = UUID.randomUUID().toString();
        UserSession session = new UserSession();
        session.setSessionId(sessionId);
        session.setUserId(userId);
        session.setNovelId(novelId);
        session.setCurrentNodeId(startNode.getId());
        session.setHistoryPath("[]");
        session.setStoryText("");
        session.setStorySummary("");
        session.setNodeStateJson("{}");
        session.setIsActive(true);
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.insert(session);

        UserCharacter character = new UserCharacter();
        character.setSessionId(sessionId);
        character.setHp(hp != null ? hp : 100);
        character.setAttack(attack != null ? attack : 10);
        character.setDefense(defense != null ? defense : 10);
        character.setIntelligence(intelligence != null ? intelligence : 50);
        character.setCharm(charm != null ? charm : 50);
        character.setLuck(luck != null ? luck : 50);
        character.setChoicesMade(0);
        character.setEventsTriggered(0);
        character.setTimesDied(0);
        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.insert(character);

        return session;
    }

    public UserSession getBySessionId(String sessionId) {
        UserSession session = userSessionMapper.selectOne(
            new LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getSessionId, sessionId));
        if (session == null) throw new RuntimeException("会话不存在");
        return session;
    }

    public Map<String, Object> getSessionState(String sessionId) {
        UserSession session = getBySessionId(sessionId);
        UserCharacter character = userCharacterMapper.selectOne(
            new LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));

        Map<String, Object> result = new HashMap<>();
        result.put("session", session);
        result.put("character", character);
        return result;
    }

    public void saveSettings(String sessionId, Map<String, Object> settings) {
        UserSession session = getBySessionId(sessionId);
        try {
            session.setSettingsJson(objectMapper.writeValueAsString(settings));
            session.setUpdatedAt(LocalDateTime.now());
            userSessionMapper.updateById(session);
        } catch (Exception e) {
            throw new RuntimeException("保存设置失败", e);
        }
    }

    public void save(String sessionId) {
        UserSession session = getBySessionId(sessionId);
        session.setLastSaveAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);
    }

    public UserSession load(String sessionId) {
        return getBySessionId(sessionId);
    }

    @Transactional
    public UserSession restart(String sessionId) {
        UserSession session = getBySessionId(sessionId);
        Node startNode = nodeMapper.selectOne(
            new LambdaQueryWrapper<Node>()
                .eq(Node::getNovelId, session.getNovelId()).eq(Node::getIsStart, true));
        if (startNode == null) throw new RuntimeException("该作品没有起始节点");

        session.setCurrentNodeId(startNode.getId());
        session.setHistoryPath("[]");
        session.setStoryText("");
        session.setStorySummary("");
        session.setLastSaveAt(null);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        UserCharacter character = userCharacterMapper.selectOne(
            new LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));
        if (character != null) {
            character.setHp(100); character.setAttack(10); character.setDefense(10);
            character.setIntelligence(50); character.setCharm(50); character.setLuck(50);
            character.setChoicesMade(0); character.setEventsTriggered(0); character.setTimesDied(0);
            character.setCurrentTitle(null); character.setTitlesJson(null);
            character.setFinalScore(null); character.setFinalRank(null); character.setRankReason(null);
            character.setUpdatedAt(LocalDateTime.now());
            userCharacterMapper.updateById(character);
        }
        return session;
    }

    public List<UserSession> listByUser(Long userId) {
        return userSessionMapper.selectList(
            new LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getUserId, userId)
                .eq(UserSession::getIsActive, true)
                .orderByDesc(UserSession::getUpdatedAt));
    }
}
