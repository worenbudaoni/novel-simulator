package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.AuthResponse;
import com.novel.simulator.dto.LoginRequest;
import com.novel.simulator.dto.RegisterRequest;
import com.novel.simulator.service.AuthService;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
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

    private String extractSessionId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
