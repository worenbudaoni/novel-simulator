package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.AuthResponse;
import com.novel.simulator.dto.LoginRequest;
import com.novel.simulator.dto.PermissionTreeNode;
import com.novel.simulator.dto.RegisterRequest;
import com.novel.simulator.service.AuthService;
import com.novel.simulator.service.PermissionService;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final PermissionService permissionService;

    public AuthController(AuthService authService, PermissionService permissionService) {
        this.authService = authService;
        this.permissionService = permissionService;
    }

    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return Result.success();
    }

    @PostMapping("/login")
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return Result.success(response);
    }

    @PostMapping("/logout")
    public Result<Void> logout(HttpServletRequest request) {
        String sessionId = extractSessionId(request);
        if (sessionId != null) {
            authService.logout(sessionId);
        }
        return Result.success();
    }

    @GetMapping("/me")
    public Result<?> me(HttpServletRequest request) {
        String sessionId = extractSessionId(request);
        if (sessionId == null) {
            return Result.unauthorized("未登录");
        }
        AuthResponse user = authService.getCurrentUser(sessionId);
        if (user == null) {
            return Result.unauthorized("会话已过期");
        }
        return Result.success(user);
    }

    @GetMapping("/menus")
    public Result<List<PermissionTreeNode>> getMenus(HttpServletRequest request) {
        @SuppressWarnings("unchecked")
        Map<String, Object> currentUser = (Map<String, Object>) request.getAttribute("currentUser");
        if (currentUser == null) {
            return Result.success(java.util.Collections.emptyList());
        }
        @SuppressWarnings("unchecked")
        List<String> permissions = (List<String>) currentUser.get("permissions");
        if (permissions == null || permissions.isEmpty()) {
            return Result.success(java.util.Collections.emptyList());
        }
        return Result.success(permissionService.getMenuTree(permissions));
    }

    private String extractSessionId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
