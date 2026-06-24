package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.novel.simulator.dto.CreateNovelRequest;
import com.novel.simulator.dto.UpdateNovelRequest;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.NovelRoleVisibility;
import com.novel.simulator.mapper.NovelMapper;
import com.novel.simulator.mapper.NovelRoleVisibilityMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NovelService {

    private final NovelMapper novelMapper;
    private final NovelRoleVisibilityMapper visibilityMapper;

    public NovelService(NovelMapper novelMapper, NovelRoleVisibilityMapper visibilityMapper) {
        this.novelMapper = novelMapper;
        this.visibilityMapper = visibilityMapper;
    }

    public Page<Novel> list(int page, int size, String keyword) {
        LambdaQueryWrapper<Novel> qw = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            qw.like(Novel::getTitle, keyword);
        }
        qw.orderByDesc(Novel::getCreatedAt);
        return novelMapper.selectPage(new Page<>(page, size), qw);
    }

    public Novel getById(Long id) {
        Novel novel = novelMapper.selectById(id);
        if (novel == null) {
            throw new RuntimeException("作品不存在");
        }
        return novel;
    }

    @Transactional
    public Novel create(CreateNovelRequest request, Long userId) {
        Novel novel = new Novel();
        novel.setTitle(request.getTitle());
        novel.setAuthor(request.getAuthor());
        novel.setContentType(request.getContentType() != null ? request.getContentType() : 0);
        novel.setCoverUrl(request.getCoverUrl());
        novel.setStatus(0);
        novel.setParseStatus(0);
        novel.setCreatedBy(userId);
        novel.setCreatedAt(LocalDateTime.now());
        novel.setUpdatedAt(LocalDateTime.now());
        novelMapper.insert(novel);
        return novel;
    }

    @Transactional
    public Novel update(Long id, UpdateNovelRequest request) {
        Novel novel = getById(id);
        if (request.getTitle() != null) novel.setTitle(request.getTitle());
        if (request.getAuthor() != null) novel.setAuthor(request.getAuthor());
        if (request.getWorldView() != null) novel.setWorldView(request.getWorldView());
        if (request.getContentType() != null) novel.setContentType(request.getContentType());
        if (request.getCoverUrl() != null) novel.setCoverUrl(request.getCoverUrl());
        if (request.getStatus() != null) novel.setStatus(request.getStatus());
        novel.setUpdatedAt(LocalDateTime.now());
        novelMapper.updateById(novel);
        return novel;
    }

    @Transactional
    public void delete(Long id) {
        Novel novel = getById(id);
        novelMapper.deleteById(id);
    }

    public List<Long> getVisibilityRoleIds(Long novelId) {
        List<NovelRoleVisibility> list = visibilityMapper.selectList(
            new LambdaQueryWrapper<NovelRoleVisibility>()
                .eq(NovelRoleVisibility::getNovelId, novelId));
        return list.stream().map(NovelRoleVisibility::getRoleId).collect(Collectors.toList());
    }

    public NovelMapper getBaseMapper() {
        return novelMapper;
    }

    @Transactional
    public void setVisibility(Long novelId, List<Long> roleIds) {
        getById(novelId);
        visibilityMapper.delete(new LambdaQueryWrapper<NovelRoleVisibility>()
            .eq(NovelRoleVisibility::getNovelId, novelId));
        if (roleIds != null && !roleIds.isEmpty()) {
            List<NovelRoleVisibility> list = roleIds.stream().map(roleId -> {
                NovelRoleVisibility nrv = new NovelRoleVisibility();
                nrv.setNovelId(novelId);
                nrv.setRoleId(roleId);
                return nrv;
            }).collect(Collectors.toList());
            for (NovelRoleVisibility nrv : list) {
                visibilityMapper.insert(nrv);
            }
        }
    }
}
