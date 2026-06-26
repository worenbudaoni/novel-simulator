package com.novel.simulator.dto;

public class ChooseActionRequest {
    private String sessionId;
    private Long targetNodeId;
    private String label;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
