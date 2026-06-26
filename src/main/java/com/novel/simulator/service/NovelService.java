package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.novel.simulator.dto.CreateNovelRequest;
import com.novel.simulator.dto.UpdateNovelRequest;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.NovelRoleVisibility;
import com.novel.simulator.mapper.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NovelService {

    private final NovelMapper novelMapper;
    private final NovelRoleVisibilityMapper visibilityMapper;
    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final NodeOptionMapper nodeOptionMapper;
    private final RandomEventMapper randomEventMapper;
    private final ParseRecordMapper parseRecordMapper;

    public NovelService(NovelMapper novelMapper, NovelRoleVisibilityMapper visibilityMapper,
                        UserSessionMapper userSessionMapper, UserCharacterMapper userCharacterMapper,
                        NodeMapper nodeMapper, NodeEdgeMapper nodeEdgeMapper,
                        NodeOptionMapper nodeOptionMapper, RandomEventMapper randomEventMapper,
                        ParseRecordMapper parseRecordMapper) {
        this.novelMapper = novelMapper;
        this.visibilityMapper = visibilityMapper;
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
        this.randomEventMapper = randomEventMapper;
        this.parseRecordMapper = parseRecordMapper;
    }

    public Page<Novel> list(int page, int size, String keyword) {
        LambdaQueryWrapper<Novel> qw = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            qw.like(Novel::getTitle, keyword);
        }
        qw.orderByDesc(Novel::getCreatedAt);
        return novelMapper.selectPage(new Page<>(page, size), qw);
    }

    public Novel findByTitle(String title) {
        return novelMapper.selectOne(
            new LambdaQueryWrapper<Novel>().eq(Novel::getTitle, title));
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
        // 1. 删除关联的角色属性（FK → user_session）
        List<com.novel.simulator.entity.UserSession> sessions = userSessionMapper.selectList(
            new LambdaQueryWrapper<com.novel.simulator.entity.UserSession>()
                .eq(com.novel.simulator.entity.UserSession::getNovelId, id));
        for (com.novel.simulator.entity.UserSession s : sessions) {
            userCharacterMapper.delete(new LambdaQueryWrapper<com.novel.simulator.entity.UserCharacter>()
                .eq(com.novel.simulator.entity.UserCharacter::getSessionId, s.getSessionId()));
        }
        // 2. 删除用户会话（FK → novel）
        userSessionMapper.delete(new LambdaQueryWrapper<com.novel.simulator.entity.UserSession>()
            .eq(com.novel.simulator.entity.UserSession::getNovelId, id));

        // 3. 查找本作品的所有节点 ID
        List<Long> nodeIds = nodeMapper.selectList(
            new LambdaQueryWrapper<com.novel.simulator.entity.Node>()
                .eq(com.novel.simulator.entity.Node::getNovelId, id))
            .stream().map(com.novel.simulator.entity.Node::getId).collect(Collectors.toList());

        if (!nodeIds.isEmpty()) {
            // 4. 删除节点选项（FK → node）
            nodeOptionMapper.delete(new LambdaQueryWrapper<com.novel.simulator.entity.NodeOption>()
                .in(com.novel.simulator.entity.NodeOption::getNodeId, nodeIds));
        }

        // 5. 删除节点边
        nodeEdgeMapper.delete(new LambdaQueryWrapper<com.novel.simulator.entity.NodeEdge>()
            .eq(com.novel.simulator.entity.NodeEdge::getNovelId, id));
        // 6. 删除节点
        nodeMapper.delete(new LambdaQueryWrapper<com.novel.simulator.entity.Node>()
            .eq(com.novel.simulator.entity.Node::getNovelId, id));
        // 7. 删除随机事件
        randomEventMapper.delete(new LambdaQueryWrapper<com.novel.simulator.entity.RandomEvent>()
            .eq(com.novel.simulator.entity.RandomEvent::getNovelId, id));
        // 8. 删除解析记录
        parseRecordMapper.delete(new LambdaQueryWrapper<com.novel.simulator.entity.ParseRecord>()
            .eq(com.novel.simulator.entity.ParseRecord::getNovelId, id));
        // 9. 删除可见角色配置
        visibilityMapper.delete(new LambdaQueryWrapper<NovelRoleVisibility>()
            .eq(NovelRoleVisibility::getNovelId, id));
        // 10. 最后删除作品本身
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
