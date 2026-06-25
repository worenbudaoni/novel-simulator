package com.novel.simulator.service;

import com.novel.simulator.dto.PermissionTreeNode;
import com.novel.simulator.entity.Permission;
import com.novel.simulator.mapper.PermissionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class PermissionService {

    private final PermissionMapper permissionMapper;

    public PermissionService(PermissionMapper permissionMapper) {
        this.permissionMapper = permissionMapper;
    }

    /**
     * 获取全量权限树（仅 status=1）
     */
    public List<PermissionTreeNode> getPermissionTree() {
        List<Permission> all = permissionMapper.selectList(
            new LambdaQueryWrapper<Permission>().eq(Permission::getStatus, 1)
                .orderByAsc(Permission::getSortOrder));
        return buildTree(all, 0L);
    }

    /**
     * 获取当前用户可见的菜单树（仅 type=1）
     */
    public List<PermissionTreeNode> getMenuTree(List<String> userPermissionCodes) {
        if (userPermissionCodes == null || userPermissionCodes.isEmpty()) {
            return Collections.emptyList();
        }

        Set<String> codeSet = new HashSet<>(userPermissionCodes);

        List<Permission> allMenus = permissionMapper.selectList(
            new LambdaQueryWrapper<Permission>().eq(Permission::getType, 1)
                .eq(Permission::getStatus, 1)
                .orderByAsc(Permission::getSortOrder));

        if (allMenus.isEmpty()) {
            return Collections.emptyList();
        }

        // 构建菜单 ID -> 对象映射
        Map<Long, Permission> menuMap = allMenus.stream()
            .collect(Collectors.toMap(Permission::getId, p -> p));

        // 获取所有按钮权限，用于判断子权限可见性
        List<Permission> allButtons = permissionMapper.selectList(
            new LambdaQueryWrapper<Permission>().eq(Permission::getType, 2)
                .eq(Permission::getStatus, 1));
        Map<Long, List<Permission>> buttonsByParent = allButtons.stream()
            .collect(Collectors.groupingBy(Permission::getParentId));

        // 判断哪些菜单可见
        Set<Long> visibleIds = new HashSet<>();
        for (Permission menu : allMenus) {
            if (isMenuVisible(menu, codeSet, buttonsByParent)) {
                visibleIds.add(menu.getId());
            }
        }

        // 收集所有祖先节点
        Set<Long> allVisible = new HashSet<>(visibleIds);
        for (Long id : visibleIds) {
            Long pid = menuMap.get(id).getParentId();
            while (pid != null && pid != 0 && menuMap.containsKey(pid)) {
                allVisible.add(pid);
                pid = menuMap.get(pid).getParentId();
            }
        }

        List<Permission> visibleMenus = allMenus.stream()
            .filter(m -> allVisible.contains(m.getId()))
            .collect(Collectors.toList());

        return buildTree(visibleMenus, 0L);
    }

    /**
     * 递归构建树
     */
    private List<PermissionTreeNode> buildTree(List<Permission> flatList, Long parentId) {
        List<PermissionTreeNode> result = new ArrayList<>();
        for (Permission p : flatList) {
            if (Objects.equals(p.getParentId(), parentId)) {
                PermissionTreeNode node = new PermissionTreeNode(
                    p.getId(), p.getParentId(), p.getName(), p.getCode(),
                    p.getType(), p.getRoute(), p.getStatus(), p.getSortOrder());
                node.setChildren(buildTree(flatList, p.getId()));
                result.add(node);
            }
        }
        return result;
    }

    /**
     * 判断菜单是否对用户可见
     */
    private boolean isMenuVisible(Permission menu, Set<String> userCodes,
                                  Map<Long, List<Permission>> buttonsByParent) {
        // 如果菜单本身的 code 在用户权限中
        if (menu.getCode() != null && userCodes.contains(menu.getCode())) {
            return true;
        }
        // 检查直接子按钮
        List<Permission> buttons = buttonsByParent.get(menu.getId());
        if (buttons != null) {
            for (Permission btn : buttons) {
                if (btn.getCode() != null && userCodes.contains(btn.getCode())) {
                    return true;
                }
            }
        }
        return false;
    }
}
