package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.PlayerNovelVO;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import com.novel.simulator.service.NovelService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/player")
public class PlayerController {

    private final NovelService novelService;
    private final NovelRoleVisibilityMapper novelRoleVisibilityMapper;
    private final RoleMapper roleMapper;
    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final NodeOptionMapper nodeOptionMapper;

    public PlayerController(NovelService novelService,
                            NovelRoleVisibilityMapper novelRoleVisibilityMapper,
                            RoleMapper roleMapper,
                            NodeMapper nodeMapper,
                            NodeEdgeMapper nodeEdgeMapper,
                            NodeOptionMapper nodeOptionMapper) {
        this.novelService = novelService;
        this.novelRoleVisibilityMapper = novelRoleVisibilityMapper;
        this.roleMapper = roleMapper;
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
    }

    /**
     * 当前用户可见的作品列表
     */
    @GetMapping("/novel/list")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<List<PlayerNovelVO>> listNovels(HttpServletRequest request) {
        @SuppressWarnings("unchecked")
        Map<String, Object> currentUser = (Map<String, Object>) request.getAttribute("currentUser");
        List<String> roles = currentUser != null ? (List<String>) currentUser.get("roles") : Collections.singletonList("GUEST");
        if (roles == null || roles.isEmpty()) roles = Collections.singletonList("GUEST");

        List<Long> roleIds = roleMapper.selectList(
            new LambdaQueryWrapper<Role>().in(Role::getCode, roles)
        ).stream().map(Role::getId).collect(Collectors.toList());

        if (roleIds.isEmpty()) return Result.success(Collections.emptyList());

        List<Long> novelIds = novelRoleVisibilityMapper.selectList(
            new LambdaQueryWrapper<NovelRoleVisibility>().in(NovelRoleVisibility::getRoleId, roleIds)
        ).stream().map(NovelRoleVisibility::getNovelId).distinct().collect(Collectors.toList());

        if (novelIds.isEmpty()) return Result.success(Collections.emptyList());

        List<Novel> novels = novelService.getBaseMapper().selectList(
            new LambdaQueryWrapper<Novel>().in(Novel::getId, novelIds)
                .eq(Novel::getStatus, 1).eq(Novel::getParseStatus, 2)
                .orderByDesc(Novel::getUpdatedAt));

        List<PlayerNovelVO> result = novels.stream()
            .map(n -> new PlayerNovelVO(n.getId(), n.getTitle(), n.getAuthor(),
                n.getWorldView(), n.getContentType(), n.getCoverUrl(), n.getStatus()))
            .collect(Collectors.toList());
        return Result.success(result);
    }

    /**
     * 获取完整节点树
     */
    @GetMapping("/novel/{novelId}/full")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<Map<String, Object>> getFullTree(@PathVariable Long novelId) {
        Novel novel = novelService.getById(novelId);
        if (novel.getStatus() != 1) return Result.error(400, "作品未发布");

        List<Node> nodes = nodeMapper.selectList(
            new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId)
                .orderByAsc(Node::getSortOrder));
        List<NodeEdge> edges = nodeEdgeMapper.selectList(
            new LambdaQueryWrapper<NodeEdge>().eq(NodeEdge::getNovelId, novelId));
        List<Long> nodeIds = nodes.stream().map(Node::getId).collect(Collectors.toList());
        List<NodeOption> options = nodeIds.isEmpty() ? Collections.emptyList() :
            nodeOptionMapper.selectList(
                new LambdaQueryWrapper<NodeOption>().in(NodeOption::getNodeId, nodeIds));

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        result.put("options", options);
        result.put("novel", novel);
        return Result.success(result);
    }

    /**
     * 获取节点详情 + 选项
     */
    @GetMapping("/node/{nodeId}")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<Map<String, Object>> getNode(@PathVariable Long nodeId) {
        Node node = nodeMapper.selectById(nodeId);
        if (node == null) return Result.error(404, "节点不存在");

        List<NodeOption> options = nodeOptionMapper.selectList(
            new LambdaQueryWrapper<NodeOption>().eq(NodeOption::getNodeId, nodeId));

        Map<String, Object> result = new HashMap<>();
        result.put("node", node);
        result.put("options", options);
        return Result.success(result);
    }
}
