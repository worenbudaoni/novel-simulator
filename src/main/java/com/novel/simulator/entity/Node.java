package com.novel.simulator.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("node")
public class Node {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long novelId;
    private String title;
    private String description;
    private Integer nodeType;
    private Boolean isStart;
    private Boolean isEnd;
    private Integer minIntelligence;
    private Integer minCharm;
    private String requiredTitle;
    private Integer sortOrder;
    private Integer dangerLevel;
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getNodeType() { return nodeType; }
    public void setNodeType(Integer nodeType) { this.nodeType = nodeType; }
    public Boolean getIsStart() { return isStart; }
    public void setIsStart(Boolean isStart) { this.isStart = isStart; }
    public Boolean getIsEnd() { return isEnd; }
    public void setIsEnd(Boolean isEnd) { this.isEnd = isEnd; }
    public Integer getMinIntelligence() { return minIntelligence; }
    public void setMinIntelligence(Integer minIntelligence) { this.minIntelligence = minIntelligence; }
    public Integer getMinCharm() { return minCharm; }
    public void setMinCharm(Integer minCharm) { this.minCharm = minCharm; }
    public String getRequiredTitle() { return requiredTitle; }
    public void setRequiredTitle(String requiredTitle) { this.requiredTitle = requiredTitle; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public Integer getDangerLevel() { return dangerLevel; }
    public void setDangerLevel(Integer dangerLevel) { this.dangerLevel = dangerLevel; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
