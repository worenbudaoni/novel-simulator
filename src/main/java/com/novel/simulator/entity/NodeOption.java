package com.novel.simulator.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("node_option")
public class NodeOption {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long nodeId;
    private String label;
    private Long targetNodeId;
    private Boolean triggerEvent;
    private String riskHint;
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getNodeId() { return nodeId; }
    public void setNodeId(Long nodeId) { this.nodeId = nodeId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
    public Boolean getTriggerEvent() { return triggerEvent; }
    public void setTriggerEvent(Boolean triggerEvent) { this.triggerEvent = triggerEvent; }
    public String getRiskHint() { return riskHint; }
    public void setRiskHint(String riskHint) { this.riskHint = riskHint; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
