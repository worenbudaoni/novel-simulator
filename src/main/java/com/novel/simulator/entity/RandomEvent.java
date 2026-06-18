package com.novel.simulator.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("random_event")
public class RandomEvent {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long novelId;
    private Long nodeId;
    private String title;
    private String content;
    private Integer eventType;
    private Integer deathProbability;
    private String attrChanges;
    private Boolean isLlmGen;
    private Integer weight;
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
    public Long getNodeId() { return nodeId; }
    public void setNodeId(Long nodeId) { this.nodeId = nodeId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Integer getEventType() { return eventType; }
    public void setEventType(Integer eventType) { this.eventType = eventType; }
    public Integer getDeathProbability() { return deathProbability; }
    public void setDeathProbability(Integer deathProbability) { this.deathProbability = deathProbability; }
    public String getAttrChanges() { return attrChanges; }
    public void setAttrChanges(String attrChanges) { this.attrChanges = attrChanges; }
    public Boolean getIsLlmGen() { return isLlmGen; }
    public void setIsLlmGen(Boolean isLlmGen) { this.isLlmGen = isLlmGen; }
    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
