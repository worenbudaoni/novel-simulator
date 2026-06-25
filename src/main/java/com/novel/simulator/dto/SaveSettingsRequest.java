package com.novel.simulator.dto;

import java.util.Map;

public class SaveSettingsRequest {
    private String sessionId;
    private Map<String, Object> settings;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Map<String, Object> getSettings() { return settings; }
    public void setSettings(Map<String, Object> settings) { this.settings = settings; }
}
