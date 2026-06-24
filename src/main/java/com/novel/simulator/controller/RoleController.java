package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.entity.Role;
import com.novel.simulator.mapper.RoleMapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/role")
public class RoleController {

    private final RoleMapper roleMapper;

    public RoleController(RoleMapper roleMapper) {
        this.roleMapper = roleMapper;
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('role:read')")
    public Result<List<Role>> list() {
        return Result.success(roleMapper.selectList(null));
    }
}
