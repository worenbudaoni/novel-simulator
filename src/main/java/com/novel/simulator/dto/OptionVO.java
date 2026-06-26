package com.novel.simulator.dto;

public class OptionVO {
    private Long id;
    private String label;
    private Long targetNodeId;
    private String riskLevel;        // "safe" | "risky" | "daring"
    private String attrHint;         // "需要一定洞察力"
    private String expectedOutcome;  // "可能发现宝藏，但也有危险"
    private String checkAttr;        // "intelligence"|"charm"|"attack"|"defense"|"luck"

    public OptionVO() {}

    public OptionVO(String label, Long targetNodeId, String riskLevel, String attrHint, String expectedOutcome) {
        this.label = label;
        this.targetNodeId = targetNodeId;
        this.riskLevel = riskLevel;
        this.attrHint = attrHint;
        this.expectedOutcome = expectedOutcome;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getAttrHint() { return attrHint; }
    public void setAttrHint(String attrHint) { this.attrHint = attrHint; }
    public String getExpectedOutcome() { return expectedOutcome; }
    public void setExpectedOutcome(String expectedOutcome) { this.expectedOutcome = expectedOutcome; }
    public String getCheckAttr() { return checkAttr; }
    public void setCheckAttr(String checkAttr) { this.checkAttr = checkAttr; }
}
