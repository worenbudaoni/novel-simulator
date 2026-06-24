package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.NovelRoleVisibility;
import com.novel.simulator.entity.Permission;
import com.novel.simulator.entity.Role;
import com.novel.simulator.entity.RolePermission;
import com.novel.simulator.mapper.NovelMapper;
import com.novel.simulator.mapper.NovelRoleVisibilityMapper;
import com.novel.simulator.mapper.PermissionMapper;
import com.novel.simulator.mapper.RoleMapper;
import com.novel.simulator.mapper.RolePermissionMapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/role")
public class RoleController {

    private final RoleMapper roleMapper;
    private final PermissionMapper permissionMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final NovelRoleVisibilityMapper novelRoleVisibilityMapper;
    private final NovelMapper novelMapper;

    public RoleController(RoleMapper roleMapper, PermissionMapper permissionMapper,
                          RolePermissionMapper rolePermissionMapper,
                          NovelRoleVisibilityMapper novelRoleVisibilityMapper,
                          NovelMapper novelMapper) {
        this.roleMapper = roleMapper;
        this.permissionMapper = permissionMapper;
        this.rolePermissionMapper = rolePermissionMapper;
        this.novelRoleVisibilityMapper = novelRoleVisibilityMapper;
        this.novelMapper = novelMapper;
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('role:read')")
    public Result<List<Role>> list() {
        return Result.success(roleMapper.selectList(null));
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('role:read')")
    public Result<List<Permission>> listPermissions() {
        return Result.success(permissionMapper.selectList(null));
    }

    @GetMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('role:read')")
    public Result<List<Long>> getRolePermissionIds(@PathVariable Long id) {
        List<Long> ids = rolePermissionMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RolePermission>()
                .eq(RolePermission::getRoleId, id))
            .stream().map(RolePermission::getPermissionId).collect(java.util.stream.Collectors.toList());
        return Result.success(ids);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Role> create(@RequestBody Role role) {
        role.setCreatedAt(LocalDateTime.now());
        role.setSystem(false);
        roleMapper.insert(role);
        return Result.success(role);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Void> update(@PathVariable Long id, @RequestBody Role role) {
        Role existing = roleMapper.selectById(id);
        if (existing == null) return Result.error(404, "角色不存在");
        if (existing.getSystem()) return Result.error(400, "系统预设角色不可修改");
        role.setId(id);
        roleMapper.updateById(role);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Void> delete(@PathVariable Long id) {
        Role existing = roleMapper.selectById(id);
        if (existing == null) return Result.error(404, "角色不存在");
        if (existing.getSystem()) return Result.error(400, "系统预设角色不可删除");
        rolePermissionMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RolePermission>()
            .eq(RolePermission::getRoleId, id));
        roleMapper.deleteById(id);
        return Result.success();
    }

    @PutMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Void> setPermissions(@PathVariable Long id, @RequestBody List<Long> permissionIds) {
        rolePermissionMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RolePermission>()
            .eq(RolePermission::getRoleId, id));
        if (permissionIds != null) {
            for (Long pid : permissionIds) {
                RolePermission rp = new RolePermission();
                rp.setRoleId(id);
                rp.setPermissionId(pid);
                rolePermissionMapper.insert(rp);
            }
        }
        return Result.success();
    }

    @GetMapping("/{id}/novels")
    @PreAuthorize("hasAuthority('role:read')")
    public Result<List<Long>> getVisibleNovelIds(@PathVariable Long id) {
        List<Long> ids = novelRoleVisibilityMapper.selectList(
            new LambdaQueryWrapper<NovelRoleVisibility>().eq(NovelRoleVisibility::getRoleId, id))
            .stream().map(NovelRoleVisibility::getNovelId).collect(java.util.stream.Collectors.toList());
        return Result.success(ids);
    }

    @GetMapping("/{id}/novels/selectable")
    @PreAuthorize("hasAuthority('role:read')")
    public Result<Map<String, Object>> getSelectableNovels(
            @PathVariable Long id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        // Get visible novel IDs for this role
        Set<Long> visibleIds = novelRoleVisibilityMapper.selectList(
            new LambdaQueryWrapper<NovelRoleVisibility>().eq(NovelRoleVisibility::getRoleId, id))
            .stream().map(NovelRoleVisibility::getNovelId).collect(Collectors.toSet());

        // Query novels with keyword
        LambdaQueryWrapper<Novel> qw = new LambdaQueryWrapper<Novel>();
        if (keyword != null && !keyword.isEmpty()) {
            qw.like(Novel::getTitle, keyword);
        }
        qw.orderByDesc(Novel::getCreatedAt);
        IPage<Novel> p = novelMapper.selectPage(new Page<>(page, size), qw);

        // Build response: selected novels first, then rest
        List<Map<String, Object>> items = new java.util.ArrayList<>();
        List<Map<String, Object>> selectedItems = new java.util.ArrayList<>();
        List<Map<String, Object>> unselectedItems = new java.util.ArrayList<>();

        for (Novel n : p.getRecords()) {
            Map<String, Object> item = new java.util.HashMap<>();
            item.put("id", n.getId());
            item.put("title", n.getTitle());
            item.put("selected", visibleIds.contains(n.getId()));
            (visibleIds.contains(n.getId()) ? selectedItems : unselectedItems).add(item);
        }
        items.addAll(selectedItems);
        items.addAll(unselectedItems);

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("items", items);
        result.put("total", p.getTotal());
        result.put("page", p.getCurrent());
        result.put("size", p.getSize());
        return Result.success(result);
    }

    @PutMapping("/{id}/novels")
    @PreAuthorize("hasAuthority('role:manage')")
    public Result<Void> setVisibleNovels(@PathVariable Long id, @RequestBody List<Long> novelIds) {
        novelRoleVisibilityMapper.delete(
            new LambdaQueryWrapper<NovelRoleVisibility>().eq(NovelRoleVisibility::getRoleId, id));
        if (novelIds != null) {
            for (Long nid : novelIds) {
                NovelRoleVisibility nrv = new NovelRoleVisibility();
                nrv.setRoleId(id);
                nrv.setNovelId(nid);
                novelRoleVisibilityMapper.insert(nrv);
            }
        }
        return Result.success();
    }
}
