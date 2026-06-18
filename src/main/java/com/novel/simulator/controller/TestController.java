package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/auth")
    public Result<Map<String, String>> testAuth() {
        Map<String, String> data = new HashMap<>();
        data.put("message", "Authenticated successfully");
        data.put("status", "ok");
        return Result.success(data);
    }

    @GetMapping("/admin")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, String>> testAdmin() {
        Map<String, String> data = new HashMap<>();
        data.put("message", "You have admin permission (novel:create)");
        return Result.success(data);
    }

    @GetMapping("/player")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<Map<String, String>> testPlayer() {
        Map<String, String> data = new HashMap<>();
        data.put("message", "You have player permission (player:play)");
        return Result.success(data);
    }
}
