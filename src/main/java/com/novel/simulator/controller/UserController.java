package com.novel.simulator.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.novel.simulator.common.Result;
import com.novel.simulator.entity.User;
import com.novel.simulator.entity.UserRole;
import com.novel.simulator.mapper.UserMapper;
import com.novel.simulator.mapper.UserRoleMapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/user")
public class UserController {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;

    public UserController(UserMapper userMapper, UserRoleMapper userRoleMapper) {
        this.userMapper = userMapper;
        this.userRoleMapper = userRoleMapper;
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('user:read')")
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String enabled) {
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<User>();
        if (keyword != null && !keyword.isEmpty()) {
            qw.like(User::getUsername, keyword);
        }
        if ("true".equals(enabled)) {
            qw.eq(User::getEnabled, true);
        } else if ("false".equals(enabled)) {
            qw.eq(User::getEnabled, false);
        }
        qw.orderByDesc(User::getCreatedAt);
        IPage<User> p = userMapper.selectPage(new Page<>(page, size), qw);
        List<Map<String, Object>> items = p.getRecords().stream().map(u -> {
            Map<String, Object> item = new java.util.HashMap<>();
            item.put("id", u.getId());
            item.put("username", u.getUsername());
            item.put("nickname", u.getNickname());
            item.put("enabled", u.getEnabled());
            item.put("createdAt", u.getCreatedAt());
            List<Long> roleIds = userRoleMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserRole>()
                    .eq(UserRole::getUserId, u.getId()))
                .stream().map(UserRole::getRoleId).collect(Collectors.toList());
            item.put("roleIds", roleIds);
            return item;
        }).collect(Collectors.toList());
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("items", items);
        result.put("total", p.getTotal());
        result.put("page", p.getCurrent());
        result.put("size", p.getSize());
        return Result.success(result);
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAuthority('user:update_role')")
    public Result<Void> setRoles(@PathVariable Long id, @RequestBody List<Long> roleIds) {
        userRoleMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserRole>()
            .eq(UserRole::getUserId, id));
        if (roleIds != null) {
            for (Long rid : roleIds) {
                UserRole ur = new UserRole();
                ur.setUserId(id);
                ur.setRoleId(rid);
                userRoleMapper.insert(ur);
            }
        }
        return Result.success();
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAuthority('user:disable')")
    public Result<Void> setStatus(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        User user = userMapper.selectById(id);
        if (user == null) return Result.error(404, "用户不存在");
        user.setEnabled(body.getOrDefault("enabled", true));
        userMapper.updateById(user);
        return Result.success();
    }
}
