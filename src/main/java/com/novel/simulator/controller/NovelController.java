package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.CreateNovelRequest;
import com.novel.simulator.dto.SetVisibilityRequest;
import com.novel.simulator.dto.UpdateNovelRequest;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.service.NovelService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/novel")
public class NovelController {

    private final NovelService novelService;

    public NovelController(NovelService novelService) {
        this.novelService = novelService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Novel> create(@Valid @RequestBody CreateNovelRequest request,
                                 Authentication authentication) {
        Map<String, Object> user = (Map<String, Object>) authentication.getPrincipal();
        Long userId = Long.valueOf(user.get("userId").toString());
        return Result.success(novelService.create(request, userId));
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('novel:read')")
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<Novel> p = novelService.list(page, size, keyword);
        Map<String, Object> result = new HashMap<>();
        result.put("items", p.getRecords());
        result.put("total", p.getTotal());
        result.put("page", p.getCurrent());
        result.put("size", p.getSize());
        return Result.success(result);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('novel:read')")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        Novel novel = novelService.getById(id);
        List<Long> roleIds = novelService.getVisibilityRoleIds(id);
        Map<String, Object> result = new HashMap<>();
        result.put("novel", novel);
        result.put("visibilityRoleIds", roleIds);
        return Result.success(result);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('novel:update')")
    public Result<Novel> update(@PathVariable Long id, @Valid @RequestBody UpdateNovelRequest request) {
        return Result.success(novelService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('novel:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        novelService.delete(id);
        return Result.success();
    }

    @PutMapping("/{id}/visibility")
    @PreAuthorize("hasAuthority('novel:set_visibility')")
    public Result<Void> setVisibility(@PathVariable Long id, @RequestBody SetVisibilityRequest request) {
        novelService.setVisibility(id, request.getRoleIds());
        return Result.success();
    }
}
