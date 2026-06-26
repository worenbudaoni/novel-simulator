package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.ResolutionResult;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Service
public class ActionEngine {

    private final NodeMapper nodeMapper;
    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final EventChain eventChain;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    public ActionEngine(NodeMapper nodeMapper,
                        UserSessionMapper userSessionMapper, UserCharacterMapper userCharacterMapper,
                        EventChain eventChain,
                        ObjectMapper objectMapper,
                        StringRedisTemplate redisTemplate) {
        this.nodeMapper = nodeMapper;
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.eventChain = eventChain;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
    }

    // ========== Public API ==========

    /**
     * 统一 resolve 入口：合并旧 choose + spin。
     * 根据 riskLevel 走不同检定分支。
     */
    @Transactional
    public ResolutionResult resolve(String sessionId, Long targetNodeId,
                                    String choiceLabel, String riskLevel, String checkAttr) {
        UserSession session = getSession(sessionId);
        UserCharacter character = getCharacter(sessionId);

        // 记录当前节点到历史
        if (session.getCurrentNodeId() != null) {
            updateHistory(session, session.getCurrentNodeId());
        }

        // 导航到目标节点
        Node targetNode = targetNodeId != null ? nodeMapper.selectById(targetNodeId) : null;
        if (targetNode != null) {
            session.setCurrentNodeId(targetNode.getId());
        }

        // 获取当前节点危险度
        Node currentNode = targetNodeId != null ? nodeMapper.selectById(targetNodeId) : null;
        int nodeDangerLevel = currentNode != null && currentNode.getDangerLevel() != null
            ? currentNode.getDangerLevel() : 3;

        // 增加选择计数
        character.setChoicesMade(character.getChoicesMade() != null ? character.getChoicesMade() + 1 : 1);

        // 根据风险等级走不同分支
        ResolutionResult result;
        switch (riskLevel != null ? riskLevel : "safe") {
            case "risky":
                result = resolveRisky(character, choiceLabel, checkAttr, nodeDangerLevel, session, currentNode);
                break;
            case "daring":
                result = resolveDaring(character, session, currentNode, choiceLabel);
                break;
            default:
                result = resolveSafe(character, nodeDangerLevel);
                break;
        }

        result.setActionType("resolve");
        result.setTargetNodeId(targetNode != null ? targetNode.getId() : null);
        result.setRiskLevel(riskLevel != null ? riskLevel : "safe");
        result.setChoiceLabel(choiceLabel);

        // 持久化
        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.updateById(character);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        result.setIsDead(character.getHp() != null && character.getHp() <= 0);

        // 将 resolution 写入 Redis 供 SSE 读取
        try {
            String json = objectMapper.writeValueAsString(result);
            redisTemplate.opsForValue().set(
                "cache:session:" + sessionId + ":pending_resolution",
                json, 5, TimeUnit.MINUTES);
        } catch (Exception e) {
            // log but don't fail the request
        }

        return result;
    }

    // ========== 三种分支 ==========

    /** safe: 稳定小收益，无需检定 */
    private ResolutionResult resolveSafe(UserCharacter c, int nodeDangerLevel) {
        int maxHpGain = nodeDangerLevel >= 4 ? 5 : 10;
        int hpGain = ThreadLocalRandom.current().nextInt(maxHpGain) + 5; // 5~10 或 5~7
        c.setHp(Math.min(100, (c.getHp() != null ? c.getHp() : 100) + hpGain));

        // 随机微增一个属性 +1
        String[] attrs = {"attack", "defense", "intelligence", "charm", "luck"};
        String gainAttr = attrs[ThreadLocalRandom.current().nextInt(attrs.length)];
        int oldVal = getAttr(c, gainAttr);
        setAttr(c, gainAttr, oldVal + 1);

        Map<String, Integer> changes = new HashMap<>();
        changes.put("hp", hpGain);
        changes.put(gainAttr, 1);

        ResolutionResult r = new ResolutionResult();
        r.setAttrChanges(changes);
        r.setSuccess(true);
        return r;
    }

    /** risky: d20 属性检定，DC 从节点危险度决定 */
    private ResolutionResult resolveRisky(UserCharacter c, String choiceLabel,
                                           String checkAttr, int nodeDangerLevel,
                                           UserSession session, Node currentNode) {
        // DC 公式
        int dc;
        switch (nodeDangerLevel) {
            case 1: dc = 8; break;
            case 2: dc = 11; break;
            case 3: dc = 13; break;
            case 4: dc = 15; break;
            case 5: dc = 17; break;
            default: dc = 13;
        }

        int attrValue = getAttr(c, checkAttr);
        int modifier = (attrValue - 50) / 10;
        int roll = ThreadLocalRandom.current().nextInt(1, 21);
        int total = roll + modifier;
        boolean success = total >= dc;

        // 调 EventChain 生成事件+数值
        Map<String, Object> eventData = eventChain.generateEvent(
            session, currentNode, c, "risky", success, checkAttr, choiceLabel);
        String eventTitle = (String) eventData.get("title");
        String eventContent = (String) eventData.get("content");

        Map<String, Integer> changes = new HashMap<>();
        applyEventChanges(c, eventData, changes);
        c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);

        ResolutionResult r = new ResolutionResult();
        r.setCheckAttr(checkAttr);
        r.setAttrValue(attrValue);
        r.setDiceRoll(roll);
        r.setDc(dc);
        r.setModifier(modifier);
        r.setTotal(total);
        r.setSuccess(success);
        r.setAttrChanges(changes);
        r.setEventTitle(eventTitle);
        r.setEventContent(eventContent);
        return r;
    }

    /** daring: 强制触发事件 */
    private ResolutionResult resolveDaring(UserCharacter c, UserSession session, Node currentNode, String choiceLabel) {
        Map<String, Object> eventData = eventChain.generateEvent(
            session, currentNode, c, "daring", null, null, choiceLabel);
        String eventTitle = (String) eventData.get("title");
        String eventContent = (String) eventData.get("content");

        Map<String, Integer> changes = new HashMap<>();
        applyEventChanges(c, eventData, changes);
        c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);

        ResolutionResult r = new ResolutionResult();
        r.setSuccess(true);
        r.setAttrChanges(changes);
        r.setEventTitle(eventTitle);
        r.setEventContent(eventContent);
        return r;
    }

    // ========== 辅助方法 ==========

    /** 获取某属性的数值 */
    private int getAttr(UserCharacter c, String attr) {
        if (c == null) return 50;
        switch (attr) {
            case "attack": return c.getAttack() != null ? c.getAttack() : 10;
            case "defense": return c.getDefense() != null ? c.getDefense() : 10;
            case "intelligence": return c.getIntelligence() != null ? c.getIntelligence() : 50;
            case "charm": return c.getCharm() != null ? c.getCharm() : 50;
            case "luck": return c.getLuck() != null ? c.getLuck() : 50;
            default: return 50;
        }
    }

    /** 设置某属性的数值 */
    private void setAttr(UserCharacter c, String attr, int value) {
        if (c == null) return;
        switch (attr) {
            case "hp": c.setHp(value); break;
            case "attack": c.setAttack(value); break;
            case "defense": c.setDefense(value); break;
            case "intelligence": c.setIntelligence(value); break;
            case "charm": c.setCharm(value); break;
            case "luck": c.setLuck(value); break;
        }
    }

    /** 应用事件属性变化到角色，并记录到 changes map */
    private void applyEventChanges(UserCharacter c, Map<String, Object> eventData, Map<String, Integer> changes) {
        String[] fields = {"hp", "attack", "defense", "intelligence", "charm", "luck"};
        String[] keys = {"hpChange", "attackChange", "defenseChange", "intelligenceChange", "charmChange", "luckChange"};
        for (int i = 0; i < fields.length; i++) {
            int delta = eventData.containsKey(keys[i]) ? ((Number) eventData.get(keys[i])).intValue() : 0;
            if (delta != 0) {
                int old = getAttr(c, fields[i]);
                int newVal = Math.max(0, old + delta);
                if ("hp".equals(fields[i])) newVal = Math.min(100, newVal);
                setAttr(c, fields[i], newVal);
                changes.put(fields[i], changes.getOrDefault(fields[i], 0) + delta);
            }
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
