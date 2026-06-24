package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.novel.simulator.dto.SaveNodesRequest;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import com.novel.simulator.mapper.NodeMapper;
import com.novel.simulator.mapper.NodeEdgeMapper;
import com.novel.simulator.mapper.NodeOptionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NodeService {

    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final NodeOptionMapper nodeOptionMapper;

    public NodeService(NodeMapper nodeMapper, NodeEdgeMapper nodeEdgeMapper,
                       NodeOptionMapper nodeOptionMapper) {
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
    }

    public List<Node> getNodesByNovelId(Long novelId) {
        return nodeMapper.selectList(
            new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId)
                .orderByAsc(Node::getSortOrder));
    }

    public List<NodeEdge> getEdgesByNovelId(Long novelId) {
        return nodeEdgeMapper.selectList(
            new LambdaQueryWrapper<NodeEdge>().eq(NodeEdge::getNovelId, novelId));
    }

    public List<NodeOption> getOptionsByNodeIds(List<Long> nodeIds) {
        if (nodeIds.isEmpty()) return Collections.emptyList();
        return nodeOptionMapper.selectList(
            new LambdaQueryWrapper<NodeOption>().in(NodeOption::getNodeId, nodeIds));
    }

    @Transactional
    public void saveNodes(Long novelId, SaveNodesRequest request) {
        // Delete existing nodes, edges, options for this novel
        List<Node> existingNodes = nodeMapper.selectList(
            new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId));
        if (!existingNodes.isEmpty()) {
            List<Long> existingIds = existingNodes.stream().map(Node::getId).collect(Collectors.toList());
            nodeOptionMapper.delete(new LambdaQueryWrapper<NodeOption>().in(NodeOption::getNodeId, existingIds));
            nodeEdgeMapper.delete(new LambdaQueryWrapper<NodeEdge>().eq(NodeEdge::getNovelId, novelId));
            nodeMapper.delete(new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId));
        }

        // Insert nodes
        if (request.getNodes() != null) {
            for (Node node : request.getNodes()) {
                node.setNovelId(novelId);
                node.setCreatedAt(LocalDateTime.now());
                nodeMapper.insert(node);
            }
        }

        // Insert edges
        if (request.getEdges() != null) {
            for (NodeEdge edge : request.getEdges()) {
                edge.setNovelId(novelId);
                nodeEdgeMapper.insert(edge);
            }
        }

        // Insert options
        if (request.getOptions() != null) {
            for (NodeOption option : request.getOptions()) {
                option.setCreatedAt(LocalDateTime.now());
                nodeOptionMapper.insert(option);
            }
        }
    }
}
