package com.novel.simulator.entity;

import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;

@TableName("user_session")
public class UserSession {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String sessionId;
    private Long userId;
    private Long novelId;
    private Long currentNodeId;
    private String historyPath;
    private String storyText;
    private String storySummary;
    private String settingsJson;
    private String nodeStateJson;
    private LocalDateTime lastSaveAt;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
    public Long getCurrentNodeId() { return currentNodeId; }
    public void setCurrentNodeId(Long currentNodeId) { this.currentNodeId = currentNodeId; }
    public String getHistoryPath() { return historyPath; }
    public void setHistoryPath(String historyPath) { this.historyPath = historyPath; }
    public String getStoryText() { return storyText; }
    public void setStoryText(String storyText) { this.storyText = storyText; }
    public String getStorySummary() { return storySummary; }
    public void setStorySummary(String storySummary) { this.storySummary = storySummary; }
    public String getSettingsJson() { return settingsJson; }
    public void setSettingsJson(String settingsJson) { this.settingsJson = settingsJson; }
    public String getNodeStateJson() { return nodeStateJson; }
    public void setNodeStateJson(String nodeStateJson) { this.nodeStateJson = nodeStateJson; }
    public LocalDateTime getLastSaveAt() { return lastSaveAt; }
    public void setLastSaveAt(LocalDateTime lastSaveAt) { this.lastSaveAt = lastSaveAt; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
