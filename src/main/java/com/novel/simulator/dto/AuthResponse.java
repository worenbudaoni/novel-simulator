package com.novel.simulator.dto;

import java.util.List;

public class AuthResponse {
    private String sessionId;
    private Long userId;
    private String username;
    private String nickname;
    private List<String> roles;
    private List<String> permissions;

    public AuthResponse() {}

    public AuthResponse(String sessionId, Long userId, String username,
                        String nickname, List<String> roles, List<String> permissions) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.username = username;
        this.nickname = nickname;
        this.roles = roles;
        this.permissions = permissions;
    }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public List<String> getRoles() { return roles; }
    public void setRoles(List<String> roles) { this.roles = roles; }
    public List<String> getPermissions() { return permissions; }
    public void setPermissions(List<String> permissions) { this.permissions = permissions; }
}
