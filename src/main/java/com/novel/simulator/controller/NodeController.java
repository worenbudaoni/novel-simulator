package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.SaveNodesRequest;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import com.novel.simulator.service.NovelService;
import com.novel.simulator.service.NodeService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/novel")
public class NodeController {

    private final NodeService nodeService;
    private final NovelService novelService;

    public NodeController(NodeService nodeService, NovelService novelService) {
        this.nodeService = nodeService;
        this.novelService = novelService;
    }

    @GetMapping("/{id}/nodes")
    @PreAuthorize("hasAuthority('node:read')")
    public Result<Map<String, Object>> getNodes(@PathVariable Long id) {
        novelService.getById(id); // validate exists
        List<Node> nodes = nodeService.getNodesByNovelId(id);
        List<NodeEdge> edges = nodeService.getEdgesByNovelId(id);
        List<Long> nodeIds = nodes.stream().map(Node::getId).collect(Collectors.toList());
        List<NodeOption> options = nodeService.getOptionsByNodeIds(nodeIds);

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        result.put("options", options);
        return Result.success(result);
    }

    @PutMapping("/{id}/nodes")
    @PreAuthorize("hasAuthority('node:update')")
    public Result<Void> saveNodes(@PathVariable Long id, @RequestBody SaveNodesRequest request) {
        novelService.getById(id); // validate exists
        nodeService.saveNodes(id, request);
        return Result.success();
    }
}
