package com.novel.simulator.dto;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import java.util.List;

public class SaveNodesRequest {
    private List<Node> nodes;
    private List<NodeEdge> edges;
    private List<NodeOption> options;

    public List<Node> getNodes() { return nodes; }
    public void setNodes(List<Node> nodes) { this.nodes = nodes; }
    public List<NodeEdge> getEdges() { return edges; }
    public void setEdges(List<NodeEdge> edges) { this.edges = edges; }
    public List<NodeOption> getOptions() { return options; }
    public void setOptions(List<NodeOption> options) { this.options = options; }
}
