# P3-A Player 基础（作品列表 + 会话管理）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Player 端的基础能力——浏览可见作品、开始冒险、创建会话、进入故事页。

**Architecture:** 新建 `PlayerController` 提供 Player API（作品列表、节点树、会话 CRUD、用户设置），新建 `SessionService` 管理游戏会话和角色属性。前端新建 NovelSelect 作品选择页、SettingsPage 设置页、StoryPlay 故事主界面骨架，新建 `useStory` hook 管理游戏状态。路由新增 `/player` 下的子路由。

**Tech Stack:** Spring Boot 2.6.13 + MyBatisPlus + Redis, React 19 + shadcn/ui + Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md` §7, §8.2

---

## File Structure

```
src/main/java/com/novel/simulator/
├── controller/
│   ├── PlayerController.java                   (new: /api/player/* endpoints)
├── service/
│   ├── SessionService.java                     (new: game session CRUD)
├── dto/
│   ├── CreateSessionRequest.java               (new)
│   ├── SaveSettingsRequest.java                (new)
│   ├── PlayerNovelVO.java                      (new: player-facing novel list VO)

frontend/src/
├── pages/
│   ├── page-player-novels.tsx                  (new: 作品选择页)
│   ├── page-player-settings.tsx                (new: 冒险前设置页)
│   ├── page-player-story.tsx                   (new: 故事主界面骨架)
├── hooks/
│   ├── useStory.ts                             (new: 游戏状态管理 hook)
├── App.tsx                                     (modify: add player sub-routes)
```

---

### Task 1: Backend — PlayerController（作品列表 + 节点树）

**Files:**
- Create: `src/main/java/com/novel/simulator/controller/PlayerController.java`
- Create: `src/main/java/com/novel/simulator/dto/PlayerNovelVO.java`

- [ ] **Step 1: 创建 PlayerNovelVO.java**

```java
package com.novel.simulator.dto;

import java.util.List;

public class PlayerNovelVO {
    private Long id;
    private String title;
    private String author;
    private String worldView;
    private Integer contentType;
    private String coverUrl;
    private Integer status;

    public PlayerNovelVO() {}

    public PlayerNovelVO(Long id, String title, String author, String worldView,
                         Integer contentType, String coverUrl, Integer status) {
        this.id = id; this.title = title; this.author = author;
        this.worldView = worldView; this.contentType = contentType;
        this.coverUrl = coverUrl; this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getWorldView() { return worldView; }
    public void setWorldView(String worldView) { this.worldView = worldView; }
    public Integer getContentType() { return contentType; }
    public void setContentType(Integer contentType) { this.contentType = contentType; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
```

- [ ] **Step 2: 创建 PlayerController.java**

```java
package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.PlayerNovelVO;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import com.novel.simulator.service.NovelService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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

    public PlayerController(NovelService novelService,
                            NovelRoleVisibilityMapper novelRoleVisibilityMapper,
                            RoleMapper roleMapper,
                            NodeMapper nodeMapper,
                            NodeEdgeMapper nodeEdgeMapper,
                            NodeOptionMapper nodeOptionMapper) {
        this.novelService = novelService;
        this.novelRoleVisibilityMapper = novelRoleVisibilityMapper;
        this.roleMapper = roleMapper;
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
    }

    /**
     * 当前用户可见的作品列表
     * 根据当前用户的角色列表查询 novel_role_visibility
     */
    @GetMapping("/novel/list")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<List<PlayerNovelVO>> listNovels(HttpServletRequest request) {
        @SuppressWarnings("unchecked")
        Map<String, Object> currentUser = (Map<String, Object>) request.getAttribute("currentUser");
        List<String> roles = currentUser != null ? (List<String>) currentUser.get("roles") : Collections.singletonList("GUEST");
        if (roles == null || roles.isEmpty()) roles = Collections.singletonList("GUEST");

        // 查出当前用户角色对应的 role_id
        List<Long> roleIds = roleMapper.selectList(
            new LambdaQueryWrapper<Role>().in(Role::getCode, roles)
        ).stream().map(Role::getId).collect(Collectors.toList());

        if (roleIds.isEmpty()) return Result.success(Collections.emptyList());

        // 查出这些角色可见的 novel_id
        List<Long> novelIds = novelRoleVisibilityMapper.selectList(
            new LambdaQueryWrapper<NovelRoleVisibility>().in(NovelRoleVisibility::getRoleId, roleIds)
        ).stream().map(NovelRoleVisibility::getNovelId).distinct().collect(Collectors.toList());

        if (novelIds.isEmpty()) return Result.success(Collections.emptyList());

        // 查出作品详情（只返回已发布且 parseStatus=2 的）
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
     * 获取完整节点树（含节点、边、选项）
     */
    @GetMapping("/novel/{novelId}/full")
    @PreAuthorize("hasAuthority('player:play')")
    public Result<Map<String, Object>> getFullTree(@PathVariable Long novelId) {
        // 校验作品存在且已发布
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
     * 获取节点详情 + 该节点的选项
     */
    @GetMapping("/node/{nodeId}")
    @PreAuthorize("hasAuthority('player:play')")
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
}
```

- [ ] **Step 3: 编译验证**

```bash
cd D:\project\novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/controller/PlayerController.java src/main/java/com/novel/simulator/dto/PlayerNovelVO.java
git commit -m "feat: P3-A PlayerController - novel list and node tree"
```

---

### Task 2: Backend — SessionService（游戏会话管理）

**Files:**
- Create: `src/main/java/com/novel/simulator/dto/CreateSessionRequest.java`
- Create: `src/main/java/com/novel/simulator/dto/SaveSettingsRequest.java`
- Create: `src/main/java/com/novel/simulator/service/SessionService.java`

- [ ] **Step 1: 创建 DTO**

`CreateSessionRequest.java`:
```java
package com.novel.simulator.dto;

public class CreateSessionRequest {
    private Long novelId;

    public Long getNovelId() { return novelId; }
    public void setNovelId(Long novelId) { this.novelId = novelId; }
}
```

`SaveSettingsRequest.java`:
```java
package com.novel.simulator.dto;

import java.util.Map;

public class SaveSettingsRequest {
    private String sessionId;
    private Map<String, Object> settings;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Map<String, Object> getSettings() { return settings; }
    public void setSettings(Map<String, Object> settings) { this.settings = settings; }
}
```

- [ ] **Step 2: 创建 SessionService.java**

```java
package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class SessionService {

    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final NodeMapper nodeMapper;
    private final ObjectMapper objectMapper;

    public SessionService(UserSessionMapper userSessionMapper,
                          UserCharacterMapper userCharacterMapper,
                          NodeMapper nodeMapper,
                          ObjectMapper objectMapper) {
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.nodeMapper = nodeMapper;
        this.objectMapper = objectMapper;
    }

    /**
     * 创建游戏会话
     */
    @Transactional
    public UserSession create(Long novelId, Long userId) {
        // 找到起始节点
        Node startNode = nodeMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Node>()
                .eq(Node::getNovelId, novelId).eq(Node::getIsStart, true));
        if (startNode == null) throw new RuntimeException("该作品没有起始节点");

        String sessionId = UUID.randomUUID().toString();

        // 创建会话
        UserSession session = new UserSession();
        session.setSessionId(sessionId);
        session.setUserId(userId);
        session.setNovelId(novelId);
        session.setCurrentNodeId(startNode.getId());
        session.setHistoryPath("[]");
        session.setStoryText("");
        session.setStorySummary("");
        session.setNodeStateJson("{}");
        session.setIsActive(true);
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.insert(session);

        // 创建角色属性
        UserCharacter character = new UserCharacter();
        character.setSessionId(sessionId);
        character.setHp(100);
        character.setAttack(10);
        character.setDefense(10);
        character.setIntelligence(50);
        character.setCharm(50);
        character.setLuck(50);
        character.setChoicesMade(0);
        character.setEventsTriggered(0);
        character.setTimesDied(0);
        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.insert(character);

        return session;
    }

    /**
     * 获取会话
     */
    public UserSession getBySessionId(String sessionId) {
        UserSession session = userSessionMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getSessionId, sessionId));
        if (session == null) throw new RuntimeException("会话不存在");
        return session;
    }

    /**
     * 获取会话完整状态（含角色属性）
     */
    public Map<String, Object> getSessionState(String sessionId) {
        UserSession session = getBySessionId(sessionId);
        UserCharacter character = userCharacterMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));

        Map<String, Object> result = new HashMap<>();
        result.put("session", session);
        result.put("character", character);
        return result;
    }

    /**
     * 保存用户设置到 Redis（会话级别）
     */
    public void saveSettings(String sessionId, Map<String, Object> settings) {
        UserSession session = getBySessionId(sessionId);
        try {
            session.setSettingsJson(objectMapper.writeValueAsString(settings));
            session.setUpdatedAt(LocalDateTime.now());
            userSessionMapper.updateById(session);
        } catch (Exception e) {
            throw new RuntimeException("保存设置失败", e);
        }
    }

    /**
     * 手动存档
     */
    public void save(String sessionId) {
        UserSession session = getBySessionId(sessionId);
        session.setLastSaveAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);
    }

    /**
     * 读档
     */
    public UserSession load(String sessionId) {
        return getBySessionId(sessionId);
    }

    /**
     * 重新开始
     */
    @Transactional
    public UserSession restart(String sessionId) {
        UserSession session = getBySessionId(sessionId);
        // 找起始节点
        Node startNode = nodeMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Node>()
                .eq(Node::getNovelId, session.getNovelId()).eq(Node::getIsStart, true));
        if (startNode == null) throw new RuntimeException("该作品没有起始节点");

        session.setCurrentNodeId(startNode.getId());
        session.setHistoryPath("[]");
        session.setStoryText("");
        session.setStorySummary("");
        session.setLastSaveAt(null);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        // 重置角色属性
        UserCharacter character = userCharacterMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));
        if (character != null) {
            character.setHp(100); character.setAttack(10); character.setDefense(10);
            character.setIntelligence(50); character.setCharm(50); character.setLuck(50);
            character.setChoicesMade(0); character.setEventsTriggered(0); character.setTimesDied(0);
            character.setCurrentTitle(null); character.setTitlesJson(null);
            character.setFinalScore(null); character.setFinalRank(null); character.setRankReason(null);
            character.setUpdatedAt(LocalDateTime.now());
            userCharacterMapper.updateById(character);
        }

        return session;
    }

    /**
     * 列出用户的所有活跃会话
     */
    public List<UserSession> listByUser(Long userId) {
        return userSessionMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getUserId, userId)
                .eq(UserSession::getIsActive, true)
                .orderByDesc(UserSession::getUpdatedAt));
    }
}
```

- [ ] **Step 3: 在 PlayerController 中添加会话端点**

在 `PlayerController.java` 中添加以下端点。在类中加入 `SessionService` 依赖和对应端点：

在类顶部的 import 区添加：
```java
import com.novel.simulator.dto.CreateSessionRequest;
import com.novel.simulator.dto.SaveSettingsRequest;
import com.novel.simulator.service.SessionService;
import javax.servlet.http.HttpServletRequest;
```

在类中添加 `SessionService` 字段和构造函数参数：
```java
private final SessionService sessionService;

// 修改构造函数，加入 SessionService 参数
```

添加以下端点方法到 PlayerController 内：

```java
@PostMapping("/session/create")
@PreAuthorize("hasAuthority('player:play')")
public Result<Map<String, Object>> createSession(@RequestBody CreateSessionRequest request,
                                                  HttpServletRequest httpRequest) {
    @SuppressWarnings("unchecked")
    Map<String, Object> currentUser = (Map<String, Object>) httpRequest.getAttribute("currentUser");
    Long userId = currentUser != null ? Long.valueOf(currentUser.get("userId").toString()) : null;
    UserSession session = sessionService.create(request.getNovelId(), userId);
    Map<String, Object> state = sessionService.getSessionState(session.getSessionId());
    return Result.success(state);
}

@GetMapping("/session/{sessionId}")
@PreAuthorize("hasAuthority('player:play')")
public Result<Map<String, Object>> getSession(@PathVariable String sessionId) {
    return Result.success(sessionService.getSessionState(sessionId));
}

@PostMapping("/session/save")
@PreAuthorize("hasAuthority('player:play')")
public Result<Void> saveSession(@RequestBody Map<String, String> request) {
    sessionService.save(request.get("sessionId"));
    return Result.success();
}

@PostMapping("/session/load")
@PreAuthorize("hasAuthority('player:play')")
public Result<Map<String, Object>> loadSession(@RequestBody Map<String, String> request) {
    UserSession session = sessionService.load(request.get("sessionId"));
    Map<String, Object> state = sessionService.getSessionState(session.getSessionId());
    return Result.success(state);
}

@GetMapping("/session/list")
@PreAuthorize("hasAuthority('player:play')")
public Result<List<UserSession>> listSessions(HttpServletRequest httpRequest) {
    @SuppressWarnings("unchecked")
    Map<String, Object> currentUser = (Map<String, Object>) httpRequest.getAttribute("currentUser");
    if (currentUser == null) return Result.success(java.util.Collections.emptyList());
    Long userId = Long.valueOf(currentUser.get("userId").toString());
    return Result.success(sessionService.listByUser(userId));
}

@PostMapping("/session/restart")
@PreAuthorize("hasAuthority('player:play')")
public Result<Map<String, Object>> restartSession(@RequestBody Map<String, String> request) {
    UserSession session = sessionService.restart(request.get("sessionId"));
    return Result.success(sessionService.getSessionState(session.getSessionId()));
}

@PostMapping("/session/settings")
@PreAuthorize("hasAuthority('player:play')")
public Result<Void> saveSettings(@RequestBody SaveSettingsRequest request) {
    sessionService.saveSettings(request.getSessionId(), request.getSettings());
    return Result.success();
}
```

- [ ] **Step 4: 编译验证**

```bash
cd D:\project\novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/CreateSessionRequest.java src/main/java/com/novel/simulator/dto/SaveSettingsRequest.java src/main/java/com/novel/simulator/service/SessionService.java
git commit -m "feat: P3-A SessionService - game session CRUD"
```

---

### Task 3: Frontend — useStory hook

**Files:**
- Create: `frontend/src/hooks/useStory.ts`

- [ ] **Step 1: 创建 useStory.ts**

```typescript
import { useState, useCallback } from 'react';
import api from '@/hooks/useApi';

export interface NodeData {
  id: number;
  novelId: number;
  title: string;
  description: string;
  nodeType: number;
  isStart: boolean;
  isEnd: boolean;
  sortOrder: number;
}

export interface NodeOption {
  id: number;
  nodeId: number;
  label: string;
  targetNodeId?: number;
  triggerEvent: boolean;
  riskHint?: string;
}

export interface CharacterData {
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  currentTitle?: string;
  choicesMade: number;
  eventsTriggered: number;
  timesDied: number;
}

export interface SessionData {
  sessionId: string;
  novelId: number;
  userId?: number;
  currentNodeId: number;
  historyPath: string;
  storyText: string;
  settingsJson?: string;
}

export function useStory() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [currentNode, setCurrentNode] = useState<NodeData | null>(null);
  const [currentOptions, setCurrentOptions] = useState<NodeOption[]>([]);
  const [loading, setLoading] = useState(false);

  const createSession = useCallback(async (novelId: number) => {
    setLoading(true);
    try {
      const res = await api.post('/player/session/create', { novelId });
      if (res.data.code === 200) {
        const data = res.data.data;
        setSession(data.session);
        setCharacter(data.character);
        if (data.session?.currentNodeId) {
          await loadNode(data.session.currentNodeId);
        }
        return data;
      }
    } finally { setLoading(false); }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/player/session/${sessionId}`);
      if (res.data.code === 200) {
        const data = res.data.data;
        setSession(data.session);
        setCharacter(data.character);
        if (data.session?.currentNodeId) {
          await loadNode(data.session.currentNodeId);
        }
      }
    } finally { setLoading(false); }
  }, []);

  const loadNode = useCallback(async (nodeId: number) => {
    const res = await api.get(`/player/node/${nodeId}`);
    if (res.data.code === 200) {
      setCurrentNode(res.data.data.node);
      setCurrentOptions(res.data.data.options || []);
    }
  }, []);

  const saveSession = useCallback(async () => {
    if (!session?.sessionId) return;
    await api.post('/player/session/save', { sessionId: session.sessionId });
  }, [session]);

  const restartSession = useCallback(async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      const res = await api.post('/player/session/restart', { sessionId: session.sessionId });
      if (res.data.code === 200) {
        const data = res.data.data;
        setSession(data.session);
        setCharacter(data.character);
        if (data.session?.currentNodeId) {
          await loadNode(data.session.currentNodeId);
        }
      }
    } finally { setLoading(false); }
  }, [session, loadNode]);

  const saveSettings = useCallback(async (settings: Record<string, any>) => {
    if (!session?.sessionId) return;
    await api.post('/player/session/settings', { sessionId: session.sessionId, settings });
  }, [session]);

  return {
    session, character, currentNode, currentOptions, loading,
    createSession, loadSession, loadNode, saveSession, restartSession, saveSettings,
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/hooks/useStory.ts
git commit -m "feat: P3-A useStory hook"
```

---

### Task 4: Frontend — 作品选择页

**Files:**
- Create: `frontend/src/pages/page-player-novels.tsx`

- [ ] **Step 1: 创建作品选择页**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'src/components/ui/card';
import { Badge } from 'src/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import api from '@/hooks/useApi';
import { BookOpenIcon, Loader2Icon } from 'lucide-react';

interface NovelItem {
  id: number;
  title: string;
  author: string;
  worldView: string;
  contentType: number;
  coverUrl: string;
}

export default function PlayerNovelsPage() {
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/player/novel/list').then(res => {
      if (res.data.code === 200) setNovels(res.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const typeLabel = (t: number) => ['小说', '动漫', '漫画'][t] || '未知';

  const startGame = (novelId: number) => {
    navigate(`/player/settings/${novelId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">作品列表</h2>
      <p className="text-sm text-muted-foreground mb-6">选择一部作品开始你的冒险</p>

      {novels.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpenIcon className="size-12 mx-auto mb-3 opacity-30" />
          <p>暂无可见作品</p>
          {!user && <p className="text-xs mt-1">登录后可查看更多作品</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {novels.map(novel => (
            <Card key={novel.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => startGame(novel.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{novel.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px] shrink-0">{typeLabel(novel.contentType)}</Badge>
                </div>
                {novel.author && <CardDescription className="text-xs">{novel.author}</CardDescription>}
              </CardHeader>
              <CardContent>
                {novel.worldView ? (
                  <p className="text-xs text-muted-foreground line-clamp-3">{novel.worldView}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/50">暂无简介</p>
                )}
                <Button size="sm" className="w-full mt-3">开始冒险</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!user && (
        <p className="text-center text-xs text-muted-foreground mt-6">
          当前为游客模式，登录后可永久保存进度
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/pages/page-player-novels.tsx
git commit -m "feat: P3-A player novel selection page"
```

---

### Task 5: Frontend — 冒险前设置页

**Files:**
- Create: `frontend/src/pages/page-player-settings.tsx`

- [ ] **Step 1: 创建设置页**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'src/components/ui/card';
import { Label } from 'src/components/ui/label';
import { Input } from 'src/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useStory } from '@/hooks/useStory';
import api from '@/hooks/useApi';
import { Loader2Icon, ArrowLeftIcon } from 'lucide-react';

export default function PlayerSettingsPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createSession } = useStory();

  const [novel, setNovel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // 设置
  const [randomRate, setRandomRate] = useState(50);
  const [deathRate, setDeathRate] = useState(30);
  const [llmUrl, setLlmUrl] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const [llmModel, setLlmModel] = useState('');

  useEffect(() => {
    if (!novelId) return;
    api.get(`/player/novel/${novelId}/full`).then(res => {
      if (res.data.code === 200) setNovel(res.data.data.novel);
    }).finally(() => setLoading(false));
  }, [novelId]);

  const handleStart = async () => {
    if (!novelId) return;
    setStarting(true);
    try {
      const sessionData = await createSession(Number(novelId));
      if (sessionData?.session?.sessionId) {
        // 保存设置
        await api.post('/player/session/settings', {
          sessionId: sessionData.session.sessionId,
          settings: { randomRate, deathRate, llmUrl, llmKey, llmModel },
        });
        navigate(`/player/story/${sessionData.session.sessionId}`);
      }
    } catch (e: any) {
      // error handled by interceptor
    } finally { setStarting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/player')} className="mb-4">
        <ArrowLeftIcon className="size-4 mr-1" /> 返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{novel?.title || '开始冒险'}</CardTitle>
          <CardDescription>配置冒险参数后开始</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 随机事件概率 */}
          <div className="space-y-2">
            <Label>随机事件概率 ({randomRate}%)</Label>
            <input type="range" min={0} max={100} value={randomRate}
              onChange={e => setRandomRate(Number(e.target.value))}
              className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground">做选择时触发随机事件的概率</p>
          </div>

          {/* 死亡率 */}
          <div className="space-y-2">
            <Label>死亡率 ({deathRate}%)</Label>
            <input type="range" min={0} max={100} value={deathRate}
              onChange={e => setDeathRate(Number(e.target.value))}
              className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground">负面事件中角色死亡的概率</p>
          </div>

          {/* LLM 配置 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">LLM 配置（可选）</Label>
            <Input placeholder="API 地址" value={llmUrl} onChange={e => setLlmUrl(e.target.value)} />
            <Input placeholder="API Key" type="password" value={llmKey} onChange={e => setLlmKey(e.target.value)} />
            <Input placeholder="模型名称" value={llmModel} onChange={e => setLlmModel(e.target.value)} />
          </div>

          {!user && (
            <p className="text-xs text-amber-600 text-center">
              当前为游客模式，退出后存档不可恢复
            </p>
          )}

          <Button onClick={handleStart} disabled={starting} className="w-full" size="lg">
            {starting ? <><Loader2Icon className="size-4 animate-spin mr-2" /> 准备中...</> : '开始冒险'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/pages/page-player-settings.tsx
git commit -m "feat: P3-A player settings page"
```

---

### Task 6: Frontend — 故事主界面骨架

**Files:**
- Create: `frontend/src/pages/page-player-story.tsx`

- [ ] **Step 1: 创建故事主界面**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Badge } from 'src/components/ui/badge';
import { Card, CardContent } from 'src/components/ui/card';
import { useStory } from '@/hooks/useStory';
import api from '@/hooks/useApi';
import { Loader2Icon, ArrowLeftIcon, SaveIcon, RotateCcwIcon } from 'lucide-react';

export default function PlayerStoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, character, currentNode, currentOptions, loading, loadSession, saveSession, restartSession } = useStory();
  const [fullTree, setFullTree] = useState<any>(null);

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (session?.novelId) {
      api.get(`/player/novel/${session.novelId}/full`).then(res => {
        if (res.data.code === 200) setFullTree(res.data.data);
      });
    }
  }, [session?.novelId]);

  const handleSave = async () => {
    await saveSession();
  };

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/player')}>
          <ArrowLeftIcon className="size-4 mr-1" /> 返回
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <SaveIcon className="size-4 mr-1" /> 存档
          </Button>
          <Button variant="outline" size="sm" onClick={async () => { await restartSession(); }}>
            <RotateCcwIcon className="size-4 mr-1" /> 重新开始
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        {/* 主区域 */}
        <div className="space-y-4">
          {/* 当前节点 */}
          {currentNode && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{currentNode.title}</h3>
                  {currentNode.isEnd && <Badge variant="secondary">结局</Badge>}
                  {currentNode.isStart && <Badge variant="outline">起点</Badge>}
                </div>
                {currentNode.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{currentNode.description}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 故事阅读区（P3-B 实现流式渲染） */}
          <Card>
            <CardContent className="pt-4">
              {session.storyText ? (
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{session.storyText}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  故事即将开始...
                </p>
              )}
            </CardContent>
          </Card>

          {/* 选项面板（P3-B 实现） */}
          {currentOptions.length > 0 && (
            <div className="space-y-2">
              {currentOptions.map(opt => (
                <Button key={opt.id} variant="outline" className="w-full justify-start text-left h-auto py-3 px-4">
                  <span className="text-sm">{opt.label}</span>
                  {opt.riskHint && (
                    <Badge variant="destructive" className="ml-auto text-[10px]">{opt.riskHint}</Badge>
                  )}
                </Button>
              ))}
            </div>
          )}

          {/* 转盘抽奖按钮（P3-B 实现） */}
          <Button variant="secondary" className="w-full" disabled>
            🎰 转盘抽奖（P3-B 实现）
          </Button>
        </div>

        {/* 角色属性侧栏 */}
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <h4 className="text-sm font-semibold">角色属性</h4>
              {character ? (
                <>
                  <AttrRow label="❤️ HP" value={character.hp} />
                  <AttrRow label="⚔️ 攻击" value={character.attack} />
                  <AttrRow label="🛡 防御" value={character.defense} />
                  <AttrRow label="🧠 智力" value={character.intelligence} />
                  <AttrRow label="✨ 魅力" value={character.charm} />
                  <AttrRow label="🍀 运气" value={character.luck} />
                  <div className="text-xs text-muted-foreground pt-1">
                    选择: {character.choicesMade} 次 | 事件: {character.eventsTriggered} 次
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">加载中...</p>
              )}
            </CardContent>
          </Card>

          {/* 节点图入口 */}
          <Button variant="outline" size="sm" className="w-full" disabled>
            🗺️ 节点地图（P3-B 实现）
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'text-green-600' : value >= 40 ? 'text-foreground' : 'text-red-500';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/pages/page-player-story.tsx
git commit -m "feat: P3-A story page skeleton"
```

---

### Task 7: Frontend — 更新路由

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 添加 Player 子路由**

在 `App.tsx` 中添加 import：
```tsx
import PlayerNovelsPage from 'src/pages/page-player-novels';
import PlayerSettingsPage from 'src/pages/page-player-settings';
import PlayerStoryPage from 'src/pages/page-player-story';
```

修改 `/player` 路由。当前 `PlayerPage` 渲染 `SectionCards`，改为让 `/player` 路由直接渲染 `PlayerNovelsPage`。

替换现有的路由块：
```tsx
<Route path="/player" element={<PlayerPage />} />
```

为：
```tsx
<Route path="/player" element={<PlayerPage />} />
<Route path="/player/settings/:novelId" element={
  <DashboardLayout><PlayerSettingsPage /></DashboardLayout>
} />
<Route path="/player/story/:sessionId" element={
  <DashboardLayout><PlayerStoryPage /></DashboardLayout>
} />
```

注意：`PlayerPage` 已经渲染了 `DashboardLayout`（已登录）或 `GuestPlayerPage`（未登录），所以 `/player` 路由不变，新增的子路由需要单独包裹 `DashboardLayout`。

- [ ] **Step 2: 编译验证**

```bash
cd D:\project\novel-simulator\frontend && npx tsc -b --noEmit 2>&1 | head -20
```
Expected: 0 new errors (pre-existing errors in node-editor/novels/roles may remain)

- [ ] **Step 3: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/App.tsx
git commit -m "feat: P3-A player routes for settings and story"
```

---

## Self-Review

1. **Spec coverage:**
   - §7.1 主循环 → P3-B
   - §7.3 用户设置 → Task 5 (SettingsPage) + Task 2 (saveSettings) ✓
   - §7.4 游客 vs 登录用户 → Task 4 (guest提示) ✓
   - §8.2 Player API → Task 1 (novel/list, novel/full, node) + Task 2 (session CRUD) ✓
   - §9 前端组件（player部分）→ Task 4 (NovelSelect) + Task 5 (SettingsPage) + Task 6 (StoryPlay骨架) ✓
   - §13.2 冒险流程 → 基础流程已覆盖 ✓

2. **Placeholder scan:** No TBD/TODO found.

3. **Type consistency:** Frontend `NodeData`/`NodeOption`/`CharacterData`/`SessionData` interfaces match backend entity fields. API paths match between frontend and backend.
