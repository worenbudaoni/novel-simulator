package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.*;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import com.novel.simulator.service.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/player")
public class PlayerController {

    private final NovelService novelService;
    private final NovelRoleVisibilityMapper novelRoleVisibilityMapper;
    private final RoleMapper roleMapper;
    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final NodeOptionMapper nodeOptionMapper;
    private final SessionService sessionService;
    private final ActionEngine actionEngine;
    private final StoryChain storyChain;
    private final EventChain eventChain;
    private final UserCharacterMapper userCharacterMapper;
    private final UserSessionMapper userSessionMapper;

    public PlayerController(NovelService novelService,
                            NovelRoleVisibilityMapper novelRoleVisibilityMapper,
                            RoleMapper roleMapper,
                            NodeMapper nodeMapper,
                            NodeEdgeMapper nodeEdgeMapper,
                            NodeOptionMapper nodeOptionMapper,
                            SessionService sessionService,
                            ActionEngine actionEngine,
                            StoryChain storyChain,
                            EventChain eventChain,
                            UserCharacterMapper userCharacterMapper,
                            UserSessionMapper userSessionMapper) {
        this.novelService = novelService;
        this.novelRoleVisibilityMapper = novelRoleVisibilityMapper;
        this.roleMapper = roleMapper;
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
        this.sessionService = sessionService;
        this.actionEngine = actionEngine;
        this.storyChain = storyChain;
        this.eventChain = eventChain;
        this.userCharacterMapper = userCharacterMapper;
        this.userSessionMapper = userSessionMapper;
    }

    /**
     * 当前用户可见的作品列表
     */
    @GetMapping("/novel/list")
    public Result<List<PlayerNovelVO>> listNovels(HttpServletRequest request) {
        @SuppressWarnings("unchecked")
        Map<String, Object> currentUser = (Map<String, Object>) request.getAttribute("currentUser");
        List<String> roles = currentUser != null ? (List<String>) currentUser.get("roles") : new ArrayList<>();
        if (roles == null) roles = new ArrayList<>();
        // 未登录用户只能看 GUEST 可见作品；已登录用户同时看自己角色+GUEST 可见作品
        if (currentUser == null) {
            roles = Collections.singletonList("GUEST");
        } else if (!roles.contains("GUEST")) {
            roles = new ArrayList<>(roles);
            roles.add("GUEST");
        }

        List<Long> roleIds = roleMapper.selectList(
            new LambdaQueryWrapper<Role>().in(Role::getCode, roles)
        ).stream().map(Role::getId).collect(Collectors.toList());

        if (roleIds.isEmpty()) return Result.success(Collections.emptyList());

        List<Long> novelIds = novelRoleVisibilityMapper.selectList(
            new LambdaQueryWrapper<NovelRoleVisibility>().in(NovelRoleVisibility::getRoleId, roleIds)
        ).stream().map(NovelRoleVisibility::getNovelId).distinct().collect(Collectors.toList());

        if (novelIds.isEmpty()) return Result.success(Collections.emptyList());

        List<Novel> novels = novelService.getBaseMapper().selectList(
            new LambdaQueryWrapper<Novel>().in(Novel::getId, novelIds)
                .eq(Novel::getStatus, 1).eq(Novel::getParseStatus, 2)
                .orderByDesc(Novel::getUpdatedAt));

        List<PlayerNovelVO> result = novels.stream()
            .map(n -> new PlayerNovelVO(n.getId(), n.getTitle(), n.getAuthor(),
                n.getWorldView(), n.getContentType(), n.getCoverUrl(), n.getStatus()))
            .collect(Collectors.toList());
        return Result.success(result);
    }

    /**
     * 获取完整节点树
     */
    @GetMapping("/novel/{novelId}/full")
    public Result<Map<String, Object>> getFullTree(@PathVariable Long novelId) {
        Novel novel = novelService.getById(novelId);
        if (novel.getStatus() != 1) return Result.error(400, "作品未发布");

        List<Node> nodes = nodeMapper.selectList(
            new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId)
                .orderByAsc(Node::getSortOrder));
        List<NodeEdge> edges = nodeEdgeMapper.selectList(
            new LambdaQueryWrapper<NodeEdge>().eq(NodeEdge::getNovelId, novelId));
        List<Long> nodeIds = nodes.stream().map(Node::getId).collect(Collectors.toList());
        List<NodeOption> options = nodeIds.isEmpty() ? Collections.emptyList() :
            nodeOptionMapper.selectList(
                new LambdaQueryWrapper<NodeOption>().in(NodeOption::getNodeId, nodeIds));

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        result.put("options", options);
        result.put("novel", novel);
        return Result.success(result);
    }

    /**
     * 获取节点详情 + 选项
     */
    @GetMapping("/node/{nodeId}")
    public Result<Map<String, Object>> getNode(@PathVariable Long nodeId) {
        Node node = nodeMapper.selectById(nodeId);
        if (node == null) return Result.error(404, "节点不存在");

        List<NodeOption> options = nodeOptionMapper.selectList(
            new LambdaQueryWrapper<NodeOption>().eq(NodeOption::getNodeId, nodeId));

        Map<String, Object> result = new HashMap<>();
        result.put("node", node);
        result.put("options", options);
        return Result.success(result);
    }

    @PostMapping("/session/create")
    public Result<Map<String, Object>> createSession(@RequestBody CreateSessionRequest request,
                                                      HttpServletRequest httpRequest) {
        @SuppressWarnings("unchecked")
        Map<String, Object> currentUser = (Map<String, Object>) httpRequest.getAttribute("currentUser");
        Long userId = currentUser != null ? Long.valueOf(currentUser.get("userId").toString()) : null;
        UserSession session = sessionService.create(request.getNovelId(), userId);
        return Result.success(sessionService.getSessionState(session.getSessionId()));
    }

    @GetMapping("/session/{sessionId}")
    public Result<Map<String, Object>> getSession(@PathVariable String sessionId) {
        return Result.success(sessionService.getSessionState(sessionId));
    }

    @PostMapping("/session/save")
    public Result<Void> saveSession(@RequestBody Map<String, String> request) {
        sessionService.save(request.get("sessionId"));
        return Result.success();
    }

    @PostMapping("/session/load")
    public Result<Map<String, Object>> loadSession(@RequestBody Map<String, String> request) {
        UserSession session = sessionService.load(request.get("sessionId"));
        return Result.success(sessionService.getSessionState(session.getSessionId()));
    }

    @GetMapping("/session/list")
    public Result<List<UserSession>> listSessions(HttpServletRequest httpRequest) {
        @SuppressWarnings("unchecked")
        Map<String, Object> currentUser = (Map<String, Object>) httpRequest.getAttribute("currentUser");
        if (currentUser == null) return Result.success(java.util.Collections.emptyList());
        Long userId = Long.valueOf(currentUser.get("userId").toString());
        return Result.success(sessionService.listByUser(userId));
    }

    @PostMapping("/session/restart")
    public Result<Map<String, Object>> restartSession(@RequestBody Map<String, String> request) {
        UserSession session = sessionService.restart(request.get("sessionId"));
        return Result.success(sessionService.getSessionState(session.getSessionId()));
    }

    @PostMapping("/session/settings")
    public Result<Void> saveSettings(@RequestBody SaveSettingsRequest request) {
        sessionService.saveSettings(request.getSessionId(), request.getSettings());
        return Result.success();
    }

    @PostMapping("/action/choose")
    public Result<ActionResult> choose(@RequestBody ChooseActionRequest request) {
        ActionResult result = actionEngine.choose(request.getSessionId(), request.getOptionId());
        return Result.success(result);
    }

    @PostMapping("/action/spin")
    public Result<ActionResult> spin(@RequestBody SpinActionRequest request) {
        ActionResult result = actionEngine.spin(request.getSessionId(), request.getNodeId());
        return Result.success(result);
    }

    @GetMapping("/story/stream/{sessionId}")
    public SseEmitter streamStory(@PathVariable String sessionId) {
        SseEmitter emitter = new SseEmitter(300_000L);
        try {
            UserSession session = sessionService.getBySessionId(sessionId);
            Node currentNode = nodeMapper.selectById(session.getCurrentNodeId());
            UserCharacter character = userCharacterMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                    .eq(UserCharacter::getSessionId, sessionId));

            if (currentNode == null) {
                emitter.send(SseEmitter.event().name("error").data("当前节点不存在"));
                emitter.complete();
                return emitter;
            }

            String story = storyChain.generateStory(session, currentNode, character, "");
            String[] paragraphs = story.split("\n\n");
            for (String para : paragraphs) {
                emitter.send(SseEmitter.event().name("story").data(para));
                Thread.sleep(50);
            }
            emitter.send(SseEmitter.event().name("done").data(""));

            String existingStory = session.getStoryText() != null ? session.getStoryText() : "";
            session.setStoryText(existingStory + "\n\n" + story);
            session.setStorySummary(storyChain.generateSummary(session.getStoryText()));
            session.setUpdatedAt(java.time.LocalDateTime.now());
            userSessionMapper.updateById(session);

            emitter.complete();
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("生成故事失败: " + e.getMessage()));
            } catch (Exception ignored) {}
            emitter.completeWithError(e);
        }
        return emitter;
    }
}
