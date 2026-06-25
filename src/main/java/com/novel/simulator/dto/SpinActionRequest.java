package com.novel.simulator.dto;

public class SpinActionRequest {
    private String sessionId;
    private Long nodeId;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getNodeId() { return nodeId; }
    public void setNodeId(Long nodeId) { this.nodeId = nodeId; }
}
