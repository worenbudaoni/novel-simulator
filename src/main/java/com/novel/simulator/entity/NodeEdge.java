package com.novel.simulator.entity;

import com.baomidou.mybatisplus.annotation.*;

@TableName("node_edge")
public class NodeEdge {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long novelId;
    private Long sourceNodeId;
    private Long targetNodeId;
    private String conditionDesc;
    private Integer edgeType;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
    public Long getSourceNodeId() { return sourceNodeId; }
    public void setSourceNodeId(Long sourceNodeId) { this.sourceNodeId = sourceNodeId; }
    public Long getTargetNodeId() { return targetNodeId; }
    public void setTargetNodeId(Long targetNodeId) { this.targetNodeId = targetNodeId; }
    public String getConditionDesc() { return conditionDesc; }
    public void setConditionDesc(String conditionDesc) { this.conditionDesc = conditionDesc; }
    public Integer getEdgeType() { return edgeType; }
    public void setEdgeType(Integer edgeType) { this.edgeType = edgeType; }
}
