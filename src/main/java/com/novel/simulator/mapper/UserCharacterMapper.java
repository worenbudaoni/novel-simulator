package com.novel.simulator.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.novel.simulator.entity.UserCharacter;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserCharacterMapper extends BaseMapper<UserCharacter> {}
