package com.novel.simulator.dto;

public class OptionVO {
    private String label;
    private Long targetNodeId;

    public OptionVO() {}

    public OptionVO(String label, Long targetNodeId) {
        this.label = label;
        this.targetNodeId = targetNodeId;
    }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
}
