package com.novel.simulator.entity;

import com.baomidou.mybatisplus.annotation.*;

@TableName("novel_role_visibility")
public class NovelRoleVisibility {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long novelId;
    private Long roleId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
    public Long getRoleId() { return roleId; }
    public void setRoleId(Long roleId) { this.roleId = roleId; }
}
