package com.novel.simulator.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.novel.simulator.entity.Novel;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NovelMapper extends BaseMapper<Novel> {}
