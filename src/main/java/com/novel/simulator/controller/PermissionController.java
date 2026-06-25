package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.PermissionTreeNode;
import com.novel.simulator.entity.Permission;
import com.novel.simulator.entity.RolePermission;
import com.novel.simulator.mapper.PermissionMapper;
import com.novel.simulator.mapper.RolePermissionMapper;
import com.novel.simulator.service.PermissionService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/admin/permissions")
public class PermissionController {

    private final PermissionService permissionService;
    private final PermissionMapper permissionMapper;
    private final RolePermissionMapper rolePermissionMapper;

    public PermissionController(PermissionService permissionService,
                                 PermissionMapper permissionMapper,
                                 RolePermissionMapper rolePermissionMapper) {
        this.permissionService = permissionService;
        this.permissionMapper = permissionMapper;
        this.rolePermissionMapper = rolePermissionMapper;
    }

    @GetMapping("/tree")
    @PreAuthorize("hasAuthority('role:read')")
    public Result<List<PermissionTreeNode>> getTree() {
        return Result.success(permissionService.getPermissionTree());
    }

    @GetMapping
    @PreAuthorize("hasAuthority('role:read')")
    public Result<List<Permission>> list() {
        return Result.success(permissionMapper.selectList(null));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Permission> create(@RequestBody Permission permission) {
        permission.setCreatedAt(LocalDateTime.now());
        permission.setUpdatedAt(LocalDateTime.now());
        if (permission.getStatus() == null) permission.setStatus(1);
        if (permission.getType() == null) permission.setType(2);
        permissionMapper.insert(permission);
        return Result.success(permission);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Permission> update(@PathVariable Long id, @RequestBody Permission permission) {
        Permission existing = permissionMapper.selectById(id);
        if (existing == null) return Result.error(404, "权限不存在");
        permission.setId(id);
        permission.setUpdatedAt(LocalDateTime.now());
        permissionMapper.updateById(permission);
        return Result.success(permissionMapper.selectById(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Void> delete(@PathVariable Long id) {
        // 删除本节点的角色关联
        rolePermissionMapper.delete(new LambdaQueryWrapper<RolePermission>()
            .eq(RolePermission::getPermissionId, id));
        // 递归删除子节点
        deleteChildren(id);
        permissionMapper.deleteById(id);
        return Result.success();
    }

    private void deleteChildren(Long parentId) {
        List<Permission> children = permissionMapper.selectList(
            new LambdaQueryWrapper<Permission>().eq(Permission::getParentId, parentId));
        for (Permission child : children) {
            rolePermissionMapper.delete(new LambdaQueryWrapper<RolePermission>()
                .eq(RolePermission::getPermissionId, child.getId()));
            deleteChildren(child.getId());
            permissionMapper.deleteById(child.getId());
        }
    }
}
