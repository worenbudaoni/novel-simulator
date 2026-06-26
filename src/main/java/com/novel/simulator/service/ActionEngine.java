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
                                    String choiceLabel, String riskLevel) {
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

        // 增加选择计数
        character.setChoicesMade(character.getChoicesMade() != null ? character.getChoicesMade() + 1 : 1);

        // 根据风险等级走不同分支
        ResolutionResult result;
        switch (riskLevel != null ? riskLevel : "safe") {
            case "risky":
                result = resolveRisky(character, choiceLabel, session);
                break;
            case "daring":
                result = resolveDaring(character, session, targetNode);
                break;
            default:
                result = resolveSafe(character);
                break;
        }

        result.setActionType("resolve");
        result.setTargetNodeId(targetNode != null ? targetNode.getId() : null);
        result.setRiskLevel(riskLevel != null ? riskLevel : "safe");

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
    private ResolutionResult resolveSafe(UserCharacter c) {
        int hpGain = 5 + ThreadLocalRandom.current().nextInt(6); // 5-10
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

    /** risky: d20 属性检定 */
    private ResolutionResult resolveRisky(UserCharacter c, String label, UserSession session) {
        String attr = detectAttr(label);
        int attrValue = getAttr(c, attr);
        int modifier = (attrValue - 50) / 10;  // 50→0, 70→+2, 30→-2
        int roll = ThreadLocalRandom.current().nextInt(1, 21);
        int dc = pickDC(attrValue);
        int total = roll + modifier;
        boolean success = total >= dc;

        Map<String, Integer> changes = new HashMap<>();
        String eventTitle = null;
        String eventContent = null;

        if (success) {
            // 成功: 正面收益
            int hpGain = 10 + ThreadLocalRandom.current().nextInt(11); // 10-20
            int attrGain = 2 + ThreadLocalRandom.current().nextInt(4); // 2-5
            c.setHp(Math.min(100, (c.getHp() != null ? c.getHp() : 100) + hpGain));
            setAttr(c, attr, getAttr(c, attr) + attrGain);

            changes.put("hp", hpGain);
            changes.put(attr, attrGain);

            // 大成功 → 触发正面事件
            if (total >= dc + 5) {
                Map<String, Object> eventData = eventChain.generateEvent(session, null, c, "risky_success");
                eventTitle = (String) eventData.get("title");
                eventContent = (String) eventData.get("content");
                applyEventChanges(c, eventData, changes);
                c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);
            }
        } else {
            // 失败: 属性损失
            int hpLoss = 10 + ThreadLocalRandom.current().nextInt(11); // 10-20
            int attrLoss = 1 + ThreadLocalRandom.current().nextInt(3); // 1-3
            c.setHp(Math.max(0, (c.getHp() != null ? c.getHp() : 100) - hpLoss));
            setAttr(c, attr, Math.max(0, getAttr(c, attr) - attrLoss));

            changes.put("hp", -hpLoss);
            changes.put(attr, -attrLoss);

            // 严重失败 → 触发负面事件
            if (total < dc - 3) {
                Map<String, Object> eventData = eventChain.generateEvent(session, null, c, "risky_fail");
                eventTitle = (String) eventData.get("title");
                eventContent = (String) eventData.get("content");
                applyEventChanges(c, eventData, changes);
                c.setEventsTriggered(c.getEventsTriggered() != null ? c.getEventsTriggered() + 1 : 1);
            }
        }

        ResolutionResult r = new ResolutionResult();
        r.setCheckAttr(attr);
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
    private ResolutionResult resolveDaring(UserCharacter c, UserSession session, Node currentNode) {
        Map<String, Object> eventData = eventChain.generateEvent(session, currentNode, c, "daring");
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

    /** 从选项 label 推断关联属性 */
    private String detectAttr(String label) {
        String l = label != null ? label : "";
        if (l.contains("察") || l.contains("读") || l.contains("研") || l.contains("搜")) return "intelligence";
        if (l.contains("说") || l.contains("交") || l.contains("骗") || l.contains("服")) return "charm";
        if (l.contains("战") || l.contains("打") || l.contains("冲") || l.contains("攻")) return "attack";
        if (l.contains("躲") || l.contains("防") || l.contains("守")) return "defense";
        if (l.contains("探") || l.contains("寻") || l.contains("找")) return "intelligence";
        return "luck";
    }

    /** 根据属性值选取 DC */
    private int pickDC(int attrValue) {
        if (attrValue >= 80) return 15;
        if (attrValue >= 60) return 13;
        if (attrValue >= 40) return 12;
        return 10;
    }

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
