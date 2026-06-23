package com.novel.simulator.dto;

import java.util.List;

public class SetVisibilityRequest {

    private List<Long> roleIds;

    public List<Long> getRoleIds() { return roleIds; }
    public void setRoleIds(List<Long> roleIds) { this.roleIds = roleIds; }
}
