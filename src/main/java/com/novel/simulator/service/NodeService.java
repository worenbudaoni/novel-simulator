package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.novel.simulator.dto.SaveNodesRequest;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.mapper.NodeMapper;
import com.novel.simulator.mapper.NodeEdgeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NodeService {

    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;

    public NodeService(NodeMapper nodeMapper, NodeEdgeMapper nodeEdgeMapper) {
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
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

    @Transactional
    public void saveNodes(Long novelId, SaveNodesRequest request) {
        // Delete existing nodes and edges for this novel
        List<Node> existingNodes = nodeMapper.selectList(
            new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId));
        if (!existingNodes.isEmpty()) {
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
    }
}
