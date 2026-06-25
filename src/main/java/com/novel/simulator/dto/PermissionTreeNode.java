package com.novel.simulator.dto;

import java.util.List;

public class PermissionTreeNode {
    private Long id;
    private Long parentId;
    private String name;
    private String code;
    private Integer type;
    private String route;
    private Integer status;
    private Integer sortOrder;
    private List<PermissionTreeNode> children;

    public PermissionTreeNode() {}

    public PermissionTreeNode(Long id, Long parentId, String name, String code,
                              Integer type, String route, Integer status, Integer sortOrder) {
        this.id = id;
        this.parentId = parentId;
        this.name = name;
        this.code = code;
        this.type = type;
        this.route = route;
        this.status = status;
        this.sortOrder = sortOrder;
    }

    // getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public Integer getType() { return type; }
    public void setType(Integer type) { this.type = type; }
    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public List<PermissionTreeNode> getChildren() { return children; }
    public void setChildren(List<PermissionTreeNode> children) { this.children = children; }
}
