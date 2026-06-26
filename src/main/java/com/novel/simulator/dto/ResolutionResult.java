package com.novel.simulator.dto;

import java.util.Map;

/**
 * 玩法流程重构后的统一响应结构。
 * 替代旧的 ActionResult，合并 choose + spin 的返回。
 *
 * 字段分组：
 * - targetNodeId: 导航到的目标节点
 * - riskLevel/checkAttr/attrValue/diceRoll/dc/modifier/total/success: 检定信息（仅 risky/daring 时有意义）
 * - attrChanges: 属性变化 map（如 {"hp": -8, "attack": 3}）
 * - isDead: 角色是否死亡
 * - eventTitle/eventContent: 触发的事件（触发时才有）
 */
public class ResolutionResult {
    private String actionType;           // "resolve"
    private Long targetNodeId;           // 导航到的目标节点 ID

    // 检定信息（risky/daring 时填充）
    private String riskLevel;            // safe / risky / daring
    private String choiceLabel;          // 玩家选择的选项文案
    private String checkAttr;            // 关联属性名（如 "intelligence"）
    private int attrValue;               // 属性值
    private int diceRoll;                // d20 结果 (risky)
    private int dc;                      // 难度值 (risky)
    private int modifier;                // 属性修正 (risky)
    private int total;                   // roll + modifier (risky)
    private boolean success;             // 是否通过 (risky)

    // 结果数据
    private Map<String, Integer> attrChanges;  // {"hp": -8, "attack": 3}
    private boolean isDead;

    // 事件数据（触发时才有）
    private String eventTitle;
    private String eventContent;

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getChoiceLabel() { return choiceLabel; }
    public void setChoiceLabel(String choiceLabel) { this.choiceLabel = choiceLabel; }
    public String getCheckAttr() { return checkAttr; }
    public void setCheckAttr(String checkAttr) { this.checkAttr = checkAttr; }
    public int getAttrValue() { return attrValue; }
    public void setAttrValue(int attrValue) { this.attrValue = attrValue; }
    public int getDiceRoll() { return diceRoll; }
    public void setDiceRoll(int diceRoll) { this.diceRoll = diceRoll; }
    public int getDc() { return dc; }
    public void setDc(int dc) { this.dc = dc; }
    public int getModifier() { return modifier; }
    public void setModifier(int modifier) { this.modifier = modifier; }
    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public Map<String, Integer> getAttrChanges() { return attrChanges; }
    public void setAttrChanges(Map<String, Integer> attrChanges) { this.attrChanges = attrChanges; }
    public boolean isDead() { return isDead; }
    public void setIsDead(boolean isDead) { this.isDead = isDead; }

    public String getEventTitle() { return eventTitle; }
    public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }
    public String getEventContent() { return eventContent; }
    public void setEventContent(String eventContent) { this.eventContent = eventContent; }
}
