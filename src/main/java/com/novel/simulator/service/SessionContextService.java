package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.UserCharacter;
import com.novel.simulator.entity.UserSession;
import com.novel.simulator.mapper.NovelMapper;
import com.novel.simulator.mapper.NodeMapper;
import com.novel.simulator.mapper.UserCharacterMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class SessionContextService {
    private static final Logger log = LoggerFactory.getLogger(SessionContextService.class);

    private static final String KEY_PREFIX = "cache:session:";
    private static final String KEY_SUFFIX = ":context";
    private static final int MAX_ROUNDS = 6;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final NovelMapper novelMapper;
    private final NodeMapper nodeMapper;
    private final UserCharacterMapper userCharacterMapper;

    public SessionContextService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper,
                                  NovelMapper novelMapper, NodeMapper nodeMapper,
                                  UserCharacterMapper userCharacterMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.novelMapper = novelMapper;
        this.nodeMapper = nodeMapper;
        this.userCharacterMapper = userCharacterMapper;
    }

    public void buildContext(UserSession session) {
        Novel novel = novelMapper.selectById(session.getNovelId());
        Node node = nodeMapper.selectById(session.getCurrentNodeId());
        UserCharacter character = userCharacterMapper.selectOne(
            new LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, session.getSessionId()));

        Map<String, Object> ctx = new HashMap<>();
        ctx.put("worldview", novel != null ? novel.getWorldView() : "");
        ctx.put("novelTitle", novel != null ? novel.getTitle() : "");
        ctx.put("currentNodeId", node != null ? node.getId() : 0);
        ctx.put("currentNodeTitle", node != null ? node.getTitle() : "");
        ctx.put("currentNodeDescription", node != null ? node.getDescription() : "");
        ctx.put("nodeDangerLevel", node != null && node.getDangerLevel() != null ? node.getDangerLevel() : 3);

        Map<String, Integer> charMap = new HashMap<>();
        if (character != null) {
            charMap.put("hp", character.getHp());
            charMap.put("attack", character.getAttack());
            charMap.put("defense", character.getDefense());
            charMap.put("intelligence", character.getIntelligence());
            charMap.put("charm", character.getCharm());
            charMap.put("luck", character.getLuck());
        }
        ctx.put("character", charMap);
        ctx.put("recentRounds", new ArrayList<>());

        try {
            String json = objectMapper.writeValueAsString(ctx);
            redisTemplate.opsForValue().set(KEY_PREFIX + session.getSessionId() + KEY_SUFFIX, json, 24, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Failed to serialize and save context for session {}: {}", session.getSessionId(), e.getMessage());
        }
    }

    public void appendRound(String sessionId, String userAction, String checkResult, String storyText) {
        try {
            String json = redisTemplate.opsForValue().get(KEY_PREFIX + sessionId + KEY_SUFFIX);
            if (json == null) return;
            @SuppressWarnings("unchecked")
            Map<String, Object> ctx = objectMapper.readValue(json, Map.class);
            List<Map<String, String>> rounds = (List<Map<String, String>>) ctx.getOrDefault("recentRounds", new ArrayList<>());
            Map<String, String> round = new HashMap<>();
            round.put("userAction", userAction);
            round.put("checkResult", checkResult);
            round.put("storyText", storyText);
            rounds.add(round);
            while (rounds.size() > MAX_ROUNDS) rounds.remove(0);
            ctx.put("recentRounds", rounds);
            redisTemplate.opsForValue().set(KEY_PREFIX + sessionId + KEY_SUFFIX, objectMapper.writeValueAsString(ctx), 24, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Failed to append round for session {}: {}", sessionId, e.getMessage());
        }
    }

    public void updateNode(String sessionId, Long newNodeId) {
        try {
            String json = redisTemplate.opsForValue().get(KEY_PREFIX + sessionId + KEY_SUFFIX);
            if (json == null) return;
            Map<String, Object> ctx = objectMapper.readValue(json, Map.class);
            Node node = nodeMapper.selectById(newNodeId);
            if (node != null) {
                ctx.put("currentNodeId", node.getId());
                ctx.put("currentNodeTitle", node.getTitle());
                ctx.put("currentNodeDescription", node.getDescription());
                ctx.put("nodeDangerLevel", node.getDangerLevel() != null ? node.getDangerLevel() : 3);
            }
            redisTemplate.opsForValue().set(KEY_PREFIX + sessionId + KEY_SUFFIX, objectMapper.writeValueAsString(ctx), 24, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Failed to update node for session {}: {}", sessionId, e.getMessage());
        }
    }
}
