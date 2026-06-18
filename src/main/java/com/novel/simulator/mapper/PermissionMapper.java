package com.novel.simulator.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.novel.simulator.entity.Permission;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PermissionMapper extends BaseMapper<Permission> {}
