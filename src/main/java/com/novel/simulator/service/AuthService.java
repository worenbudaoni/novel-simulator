package com.novel.simulator.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.AuthResponse;
import com.novel.simulator.dto.LoginRequest;
import com.novel.simulator.dto.RegisterRequest;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final String SESSION_PREFIX = "auth:sessions:";
    private static final long SESSION_TTL = 24;

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final PermissionMapper permissionMapper;
    private final BCryptPasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public AuthService(UserMapper userMapper, UserRoleMapper userRoleMapper,
                       RoleMapper roleMapper, RolePermissionMapper rolePermissionMapper,
                       PermissionMapper permissionMapper,
                       BCryptPasswordEncoder passwordEncoder,
                       StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.userMapper = userMapper;
        this.userRoleMapper = userRoleMapper;
        this.roleMapper = roleMapper;
        this.rolePermissionMapper = rolePermissionMapper;
        this.permissionMapper = permissionMapper;
        this.passwordEncoder = passwordEncoder;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void register(RegisterRequest request) {
        User existing = userMapper.selectOne(
            new LambdaQueryWrapper<User>().eq(User::getUsername, request.getUsername()));
        if (existing != null) {
            throw new RuntimeException("用户名已存在");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setNickname(request.getNickname() != null ? request.getNickname() : request.getUsername());
        user.setEnabled(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(user);

        Role userRole = roleMapper.selectOne(
            new LambdaQueryWrapper<Role>().eq(Role::getCode, "USER"));
        if (userRole != null) {
            UserRole ur = new UserRole();
            ur.setUserId(user.getId());
            ur.setRoleId(userRole.getId());
            userRoleMapper.insert(ur);
        }
    }

    public AuthResponse login(LoginRequest request) {
        User user = userMapper.selectOne(
            new LambdaQueryWrapper<User>().eq(User::getUsername, request.getUsername()));
        if (user == null) {
            throw new RuntimeException("用户名或密码错误");
        }
        if (!user.getEnabled()) {
            throw new RuntimeException("账号已被禁用");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("用户名或密码错误");
        }

        List<UserRole> userRoles = userRoleMapper.selectList(
            new LambdaQueryWrapper<UserRole>().eq(UserRole::getUserId, user.getId()));
        List<Long> roleIds = userRoles.stream().map(UserRole::getRoleId).collect(Collectors.toList());

        List<String> roleCodes = roleMapper.selectBatchIds(roleIds)
            .stream().map(Role::getCode).collect(Collectors.toList());

        List<RolePermission> rolePermissions = rolePermissionMapper.selectList(
            new LambdaQueryWrapper<RolePermission>().in(RolePermission::getRoleId, roleIds));
        List<Long> permissionIds = rolePermissions.stream()
            .map(RolePermission::getPermissionId).collect(Collectors.toList());

        List<String> permissionCodes;
        if (roleCodes.contains("ADMIN")) {
            permissionCodes = permissionMapper.selectList(
                new LambdaQueryWrapper<Permission>().eq(Permission::getStatus, 1))
                .stream().map(Permission::getCode).collect(Collectors.toList());
        } else {
            permissionCodes = permissionMapper.selectBatchIds(permissionIds)
                .stream().map(Permission::getCode).collect(Collectors.toList());
        }

        String sessionId = UUID.randomUUID().toString();
        String sessionKey = SESSION_PREFIX + sessionId;

        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("userId", user.getId());
        sessionData.put("username", user.getUsername());
        sessionData.put("nickname", user.getNickname());
        sessionData.put("roles", roleCodes);
        sessionData.put("permissions", permissionCodes);

        try {
            redisTemplate.opsForValue().set(
                sessionKey,
                objectMapper.writeValueAsString(sessionData),
                SESSION_TTL,
                TimeUnit.HOURS
            );
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to create session");
        }

        return new AuthResponse(sessionId, user.getId(), user.getUsername(),
            user.getNickname(), roleCodes, permissionCodes);
    }

    public void logout(String sessionId) {
        redisTemplate.delete(SESSION_PREFIX + sessionId);
    }

    public AuthResponse getCurrentUser(String sessionId) {
        String sessionKey = SESSION_PREFIX + sessionId;
        String sessionJson = redisTemplate.opsForValue().get(sessionKey);
        if (sessionJson == null) return null;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(sessionJson, Map.class);
            return new AuthResponse(
                sessionId,
                Long.valueOf(data.get("userId").toString()),
                (String) data.get("username"),
                (String) data.get("nickname"),
                (List<String>) data.get("roles"),
                (List<String>) data.get("permissions")
            );
        } catch (Exception e) {
            return null;
        }
    }
}
