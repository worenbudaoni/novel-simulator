package com.novel.simulator.dto;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import java.util.List;

public class SaveNodesRequest {
    private Long novelId;
    private List<Node> nodes;
    private List<NodeEdge> edges;

    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
    public List<Node> getNodes() { return nodes; }
    public void setNodes(List<Node> nodes) { this.nodes = nodes; }
    public List<NodeEdge> getEdges() { return edges; }
    public void setEdges(List<NodeEdge> edges) { this.edges = edges; }
}
