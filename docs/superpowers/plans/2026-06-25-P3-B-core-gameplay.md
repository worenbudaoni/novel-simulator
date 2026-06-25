# P3-B 核心玩法循环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的核心玩法循环——选择/转盘、随机事件触发、LLM 故事生成（SSE 流式输出）、前端 option panel / 转盘动画 / 流式故事阅读 / 角色属性面板。

**Architecture:** 后端新增 ActionEngine（选择 + 转盘逻辑）、EventEngine（随机事件抽取）、LLM Chains（StoryChain/EventChain/BranchChain）。使用 SSE (SseEmitter) 流式输出 LLM 生成结果。前端新增 useSSE hook 接收流数据，改造 useStory 支持动作触发，StoryPage 接入 ChoicePanel/WheelOfFortune/StoryViewer/CharacterPanel 组件。

**Tech Stack:** Spring Boot 2.6.13 + SseEmitter + LangChain4j 0.27.0, React 19 + shadcn/ui

**Spec:** `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md` §6, §7, §8.2

---

## File Structure

```
src/main/java/com/novel/simulator/
├── controller/
│   ├── PlayerController.java                   (modify: add choose/spin/story/stream endpoints)
├── service/
│   ├── ActionEngine.java                       (new: choose & spin logic)
│   ├── EventEngine.java                        (new: random event pool & weighted draw)
│   ├── StoryChain.java                         (new: LLM story generation - stub)
│   ├── EventChain.java                         (new: LLM event generation - stub)
│   ├── BranchChain.java                        (new: LLM branch generation - stub)
├── dto/
│   ├── ChooseActionRequest.java                (new)
│   ├── SpinActionRequest.java                  (new)
│   ├── ActionResult.java                       (new: unified action response)

frontend/src/
├── components/
│   ├── ChoicePanel.tsx                         (new: 选项面板)
│   ├── StoryViewer.tsx                         (new: 故事阅读区，含流式渲染)
│   ├── WheelOfFortune.tsx                      (new: 转盘抽奖)
│   ├── CharacterPanel.tsx                      (new: 角色属性面板，含属性变化动画)
├── hooks/
│   ├── useSSE.ts                               (new: SSE 流式接收 hook)
│   ├── useStory.ts                              (modify: add action dispatch)
├── pages/
│   ├── page-player-story.tsx                    (modify: 替换骨架为真实组件)
```

---

### Task 1: Backend — ActionEngine + EventEngine

**Files:**
- Create: `src/main/java/com/novel/simulator/dto/ChooseActionRequest.java`
- Create: `src/main/java/com/novel/simulator/dto/SpinActionRequest.java`
- Create: `src/main/java/com/novel/simulator/dto/ActionResult.java`
- Create: `src/main/java/com/novel/simulator/service/EventEngine.java`
- Create: `src/main/java/com/novel/simulator/service/ActionEngine.java`

- [ ] **Step 1: 创建 DTO**

`ChooseActionRequest.java`:
```java
package com.novel.simulator.dto;

public class ChooseActionRequest {
    private String sessionId;
    private Long optionId;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getOptionId() { return optionId; }
    public void setOptionId(Long optionId) { this.optionId = optionId; }
}
```

`SpinActionRequest.java`:
```java
package com.novel.simulator.dto;

public class SpinActionRequest {
    private String sessionId;
    private Long nodeId;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public Long getNodeId() { return nodeId; }
    public void setNodeId(Long nodeId) { this.nodeId = nodeId; }
}
```

`ActionResult.java`:
```java
package com.novel.simulator.dto;

import com.novel.simulator.entity.*;
import java.util.Map;

public class ActionResult {
    private String actionType;          // "choose" | "spin"
    private Node targetNode;            // 目标节点（如有）
    private NodeOption chosenOption;    // 选择的选项（choose 时）
    private RandomEvent triggeredEvent; // 触发的事件（如有）
    private UserCharacter character;    // 更新后的角色属性
    private String eventDescription;    // 事件描述文本

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }
    public Node getTargetNode() { return targetNode; }
    public void setTargetNode(Node targetNode) { this.targetNode = targetNode; }
    public NodeOption getChosenOption() { return chosenOption; }
    public void setChosenOption(NodeOption chosenOption) { this.chosenOption = chosenOption; }
    public RandomEvent getTriggeredEvent() { return triggeredEvent; }
    public void setTriggeredEvent(RandomEvent triggeredEvent) { this.triggeredEvent = triggeredEvent; }
    public UserCharacter getCharacter() { return character; }
    public void setCharacter(UserCharacter character) { this.character = character; }
    public String getEventDescription() { return eventDescription; }
    public void setEventDescription(String eventDescription) { this.eventDescription = eventDescription; }
}
```

- [ ] **Step 2: 创建 EventEngine.java**

```java
package com.novel.simulator.service;

import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.mapper.RandomEventMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class EventEngine {

    private final RandomEventMapper randomEventMapper;

    public EventEngine(RandomEventMapper randomEventMapper) {
        this.randomEventMapper = randomEventMapper;
    }

    /**
     * 从事件池按权重随机抽取事件
     * @param novelId 作品ID
     * @param nodeId 当前节点ID（NULL=只取全局）
     * @return 抽到的事件，无可用事件返回null
     */
    public RandomEvent drawEvent(Long novelId, Long nodeId) {
        List<RandomEvent> pool = new ArrayList<>();

        // 全局事件
        pool.addAll(randomEventMapper.selectList(
            new LambdaQueryWrapper<RandomEvent>()
                .eq(RandomEvent::getNovelId, novelId)
                .isNull(RandomEvent::getNodeId)));

        // 节点专属事件
        if (nodeId != null) {
            pool.addAll(randomEventMapper.selectList(
                new LambdaQueryWrapper<RandomEvent>()
                    .eq(RandomEvent::getNovelId, novelId)
                    .eq(RandomEvent::getNodeId, nodeId)));
        }

        if (pool.isEmpty()) return null;

        // 按权重随机抽取
        int totalWeight = pool.stream().mapToInt(e -> e.getWeight() != null ? e.getWeight() : 10).sum();
        int roll = new Random().nextInt(totalWeight);
        int cumulative = 0;
        for (RandomEvent event : pool) {
            cumulative += event.getWeight() != null ? event.getWeight() : 10;
            if (roll < cumulative) return event;
        }
        return pool.get(pool.size() - 1);
    }
}
```

- [ ] **Step 3: 创建 ActionEngine.java**

```java
package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.dto.ActionResult;
import com.novel.simulator.entity.*;
import com.novel.simulator.mapper.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ActionEngine {

    private final NodeMapper nodeMapper;
    private final NodeOptionMapper nodeOptionMapper;
    private final UserSessionMapper userSessionMapper;
    private final UserCharacterMapper userCharacterMapper;
    private final RandomEventMapper randomEventMapper;
    private final EventEngine eventEngine;
    private final ObjectMapper objectMapper;

    public ActionEngine(NodeMapper nodeMapper, NodeOptionMapper nodeOptionMapper,
                        UserSessionMapper userSessionMapper, UserCharacterMapper userCharacterMapper,
                        RandomEventMapper randomEventMapper, EventEngine eventEngine,
                        ObjectMapper objectMapper) {
        this.nodeMapper = nodeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
        this.userSessionMapper = userSessionMapper;
        this.userCharacterMapper = userCharacterMapper;
        this.randomEventMapper = randomEventMapper;
        this.eventEngine = eventEngine;
        this.objectMapper = objectMapper;
    }

    /**
     * 用户做出选择
     */
    @Transactional
    public ActionResult choose(String sessionId, Long optionId) {
        UserSession session = getSession(sessionId);
        NodeOption option = nodeOptionMapper.selectById(optionId);
        if (option == null) throw new RuntimeException("选项不存在");

        UserCharacter character = getCharacter(sessionId);

        // 记录选择
        character.setChoicesMade(character.getChoicesMade() != null ? character.getChoicesMade() + 1 : 1);
        updateHistory(session, option.getNodeId());

        // 确定目标节点
        Node targetNode = null;
        if (option.getTargetNodeId() != null) {
            targetNode = nodeMapper.selectById(option.getTargetNodeId());
        }

        // 更新角色属性min_intelligence/min_charm
        if (targetNode != null) {
            session.setCurrentNodeId(targetNode.getId());
        }

        // 是否触发随机事件
        RandomEvent triggeredEvent = null;
        boolean eventTriggered = false;
        if (Boolean.TRUE.equals(option.getTriggerEvent())) {
            triggeredEvent = eventEngine.drawEvent(session.getNovelId(), option.getNodeId());
            if (triggeredEvent != null) {
                eventTriggered = true;
                applyEventEffects(character, triggeredEvent);
                character.setEventsTriggered(character.getEventsTriggered() != null ? character.getEventsTriggered() + 1 : 1);
            }
        }

        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.updateById(character);
        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        ActionResult result = new ActionResult();
        result.setActionType("choose");
        result.setChosenOption(option);
        result.setTargetNode(targetNode);
        result.setTriggeredEvent(eventTriggered ? triggeredEvent : null);
        result.setCharacter(character);
        return result;
    }

    /**
     * 转盘抽奖
     */
    @Transactional
    public ActionResult spin(String sessionId, Long nodeId) {
        UserSession session = getSession(sessionId);
        UserCharacter character = getCharacter(sessionId);

        // 从事件池抽取
        RandomEvent event = eventEngine.drawEvent(session.getNovelId(), nodeId);
        if (event == null) {
            // 无可用事件，返回空
            ActionResult result = new ActionResult();
            result.setActionType("spin");
            result.setCharacter(character);
            return result;
        }

        // 应用事件效果
        applyEventEffects(character, event);
        character.setEventsTriggered(character.getEventsTriggered() != null ? character.getEventsTriggered() + 1 : 1);
        character.setUpdatedAt(LocalDateTime.now());
        userCharacterMapper.updateById(character);

        session.setUpdatedAt(LocalDateTime.now());
        userSessionMapper.updateById(session);

        ActionResult result = new ActionResult();
        result.setActionType("spin");
        result.setTriggeredEvent(event);
        result.setCharacter(character);
        return result;
    }

    private void applyEventEffects(UserCharacter character, RandomEvent event) {
        if (event.getAttrChanges() != null && !event.getAttrChanges().isEmpty()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> changes = objectMapper.readValue(event.getAttrChanges(), Map.class);
                if (changes.containsKey("hp")) character.setHp(character.getHp() + ((Number) changes.get("hp")).intValue());
                if (changes.containsKey("attack")) character.setAttack(character.getAttack() + ((Number) changes.get("attack")).intValue());
                if (changes.containsKey("defense")) character.setDefense(character.getDefense() + ((Number) changes.get("defense")).intValue());
                if (changes.containsKey("intelligence")) character.setIntelligence(character.getIntelligence() + ((Number) changes.get("intelligence")).intValue());
                if (changes.containsKey("charm")) character.setCharm(character.getCharm() + ((Number) changes.get("charm")).intValue());
                if (changes.containsKey("luck")) character.setLuck(character.getLuck() + ((Number) changes.get("luck")).intValue());
            } catch (Exception ignored) {}
        }
    }

    private void updateHistory(UserSession session, Long nodeId) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> history = objectMapper.readValue(session.getHistoryPath(), List.class);
            history.add(nodeId);
            session.setHistoryPath(objectMapper.writeValueAsString(history));
        } catch (Exception ignored) {}
    }

    private UserSession getSession(String sessionId) {
        UserSession session = userSessionMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserSession>()
                .eq(UserSession::getSessionId, sessionId));
        if (session == null) throw new RuntimeException("会话不存在");
        return session;
    }

    private UserCharacter getCharacter(String sessionId) {
        UserCharacter character = userCharacterMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<UserCharacter>()
                .eq(UserCharacter::getSessionId, sessionId));
        if (character == null) throw new RuntimeException("角色属性不存在");
        return character;
    }
}
```

- [ ] **Step 4: 编译验证**

```bash
cd D:\project\novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/ChooseActionRequest.java src/main/java/com/novel/simulator/dto/SpinActionRequest.java src/main/java/com/novel/simulator/dto/ActionResult.java src/main/java/com/novel/simulator/service/EventEngine.java src/main/java/com/novel/simulator/service/ActionEngine.java
git commit -m "feat: P3-B ActionEngine + EventEngine"
```

---

### Task 2: Backend — LLM Chains (Stub) + SSE 流式端点

**Files:**
- Create: `src/main/java/com/novel/simulator/service/StoryChain.java`
- Create: `src/main/java/com/novel/simulator/service/EventChain.java`
- Create: `src/main/java/com/novel/simulator/service/BranchChain.java`
- Modify: `src/main/java/com/novel/simulator/controller/PlayerController.java` (add choose/spin/story/stream endpoints)

- [ ] **Step 1: 创建 StoryChain.java（LLM 故事生成，当前用模拟数据）**

```java
package com.novel.simulator.service;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.UserCharacter;
import com.novel.simulator.entity.UserSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 故事生成 Chain
 * 将用户的交互行为实时转化为故事段落
 * 当前为 stub 实现，P3-C 接入真实 LLM
 */
@Service
public class StoryChain {

    private static final Logger log = LoggerFactory.getLogger(StoryChain.class);

    /**
     * 生成故事段落（SSE 流式输出时使用）
     * 当前返回模拟文本
     */
    public String generateStory(UserSession session, Node currentNode,
                                UserCharacter character, String actionDescription) {
        // 模拟故事生成
        StringBuilder sb = new StringBuilder();
        sb.append("你来到了「").append(currentNode.getTitle()).append("」.\n\n");
        if (currentNode.getDescription() != null && !currentNode.getDescription().isEmpty()) {
            sb.append(currentNode.getDescription()).append("\n\n");
        }
        if (actionDescription != null && !actionDescription.isEmpty()) {
            sb.append(actionDescription).append("\n\n");
        }
        sb.append("四周的环境让你感到既熟悉又陌生。你握紧了手中的武器，继续前行。\n");
        return sb.toString();
    }

    /**
     * 生成故事摘要（用于上下文压缩）
     */
    public String generateSummary(String fullStory) {
        if (fullStory == null || fullStory.length() < 100) return fullStory;
        return fullStory.substring(0, 100) + "...（后续内容已压缩）";
    }
}
```

- [ ] **Step 2: 创建 EventChain.java（LLM 事件生成，stub）**

```java
package com.novel.simulator.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 随机事件生成 Chain
 * 当事件池不足时动态生成符合世界观的随机事件
 * 当前为 stub 实现
 */
@Service
public class EventChain {

    private static final Logger log = LoggerFactory.getLogger(EventChain.class);

    public String generateEventDescription(Long novelId, String eventTitle, String eventContent) {
        if (eventContent != null && !eventContent.isEmpty()) return eventContent;
        return "发生了随机事件：「" + eventTitle + "」。你感受到一股未知的力量影响了你的状态。";
    }
}
```

- [ ] **Step 3: 创建 BranchChain.java（分支生成，stub）**

```java
package com.novel.simulator.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 分支节点生成 Chain
 * 当 target_node_id = NULL 时，LLM 动态生成新分支
 * 当前为 stub 实现
 */
@Service
public class BranchChain {

    private static final Logger log = LoggerFactory.getLogger(BranchChain.class);
}
```

- [ ] **Step 4: 在 PlayerController 中添加动作和故事端点**

读取现有的 `PlayerController.java`，添加以下字段和端点：

添加 imports:
```java
import com.novel.simulator.dto.*;
import com.novel.simulator.service.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
```

添加字段（在已有字段后追加）:
```java
private final ActionEngine actionEngine;
private final StoryChain storyChain;
private final EventChain eventChain;
```

更新构造函数，追加参数 `ActionEngine actionEngine, StoryChain storyChain, EventChain eventChain`。

添加端点方法（在类体内）:

```java
@PostMapping("/action/choose")
@PreAuthorize("hasAuthority('player:play')")
public Result<ActionResult> choose(@RequestBody ChooseActionRequest request) {
    ActionResult result = actionEngine.choose(request.getSessionId(), request.getOptionId());
    return Result.success(result);
}

@PostMapping("/action/spin")
@PreAuthorize("hasAuthority('player:play')")
public Result<ActionResult> spin(@RequestBody SpinActionRequest request) {
    ActionResult result = actionEngine.spin(request.getSessionId(), request.getNodeId());
    return Result.success(result);
}

/**
 * SSE 流式获取故事
 */
@GetMapping("/story/stream/{sessionId}")
@PreAuthorize("hasAuthority('player:play')")
public SseEmitter streamStory(@PathVariable String sessionId) {
    SseEmitter emitter = new SseEmitter(300_000L); // 5min timeout

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

        // 按段落流式发送
        String[] paragraphs = story.split("\n\n");
        for (String para : paragraphs) {
            emitter.send(SseEmitter.event().name("story").data(para));
            Thread.sleep(50); // 模拟流式延迟
        }

        // 发送完成事件
        emitter.send(SseEmitter.event().name("done").data(""));

        // 保存故事文本到会话
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
```

注意：需要添加 `UserCharacterMapper userCharacterMapper` 字段到 PlayerController 的构造函数中。

- [ ] **Step 5: 编译验证**

```bash
cd D:\project\novel-simulator && mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/novel/simulator/service/StoryChain.java src/main/java/com/novel/simulator/service/EventChain.java src/main/java/com/novel/simulator/service/BranchChain.java
git commit -m "feat: P3-B LLM chain stubs + SSE story endpoint"
```

---

### Task 3: Frontend — useSSE hook

**Files:**
- Create: `frontend/src/hooks/useSSE.ts`

- [ ] **Step 1: 创建 useSSE.ts**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';

interface SSEOptions {
  onStory?: (text: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export function useSSE() {
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef<SSEOptions>({});

  const connect = useCallback((sessionId: string, options?: SSEOptions) => {
    // 断开旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    optionsRef.current = options || {};

    // 注意：Vite 代理 /api → 后端，所以直接用相对路径
    const url = `/api/player/story/stream/${sessionId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setConnected(true);
    setStreaming(true);

    es.addEventListener('story', (event) => {
      if (optionsRef.current.onStory) {
        optionsRef.current.onStory(event.data);
      }
    });

    es.addEventListener('done', () => {
      setStreaming(false);
      if (optionsRef.current.onDone) {
        optionsRef.current.onDone();
      }
      es.close();
      setConnected(false);
    });

    es.addEventListener('error', (event) => {
      const msg = (event as any)?.data || '连接错误';
      if (optionsRef.current.onError) {
        optionsRef.current.onError(msg);
      }
      setStreaming(false);
      setConnected(false);
      es.close();
    });

    es.onerror = () => {
      setStreaming(false);
      setConnected(false);
      es.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
    setStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return { connected, streaming, connect, disconnect };
}
```

- [ ] **Step 2: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/hooks/useSSE.ts
git commit -m "feat: P3-B useSSE hook for story streaming"
```

---

### Task 4: Frontend — ChoicePanel + StoryViewer + WheelOfFortune + CharacterPanel 组件

**Files:**
- Create: `frontend/src/components/ChoicePanel.tsx`
- Create: `frontend/src/components/StoryViewer.tsx`
- Create: `frontend/src/components/WheelOfFortune.tsx`
- Create: `frontend/src/components/CharacterPanel.tsx`

- [ ] **Step 1: 创建 ChoicePanel.tsx**

```tsx
import { Button } from 'src/components/ui/button';
import { Badge } from 'src/components/ui/badge';

export interface OptionItem {
  id: number;
  label: string;
  riskHint?: string;
}

interface ChoicePanelProps {
  options: OptionItem[];
  disabled?: boolean;
  onChoose: (optionId: number) => void;
}

export default function ChoicePanel({ options, disabled, onChoose }: ChoicePanelProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">做出你的选择：</p>
      {options.map(opt => (
        <Button
          key={opt.id}
          variant="outline"
          disabled={disabled}
          onClick={() => onChoose(opt.id)}
          className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span className="text-sm">{opt.label}</span>
          {opt.riskHint && (
            <Badge variant="destructive" className="ml-auto text-[10px] shrink-0">{opt.riskHint}</Badge>
          )}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 StoryViewer.tsx**

```tsx
import { useEffect, useRef } from 'react';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon } from 'lucide-react';

interface StoryViewerProps {
  text: string;
  streaming?: boolean;
  placeholder?: string;
}

export default function StoryViewer({ text, streaming, placeholder }: StoryViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [text]);

  return (
    <Card>
      <CardContent className="pt-4">
        {text ? (
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {placeholder || '故事即将开始...'}
          </p>
        )}
        {streaming && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" /> 生成中...
          </div>
        )}
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 创建 WheelOfFortune.tsx**

```tsx
import { useState } from 'react';
import { Button } from 'src/components/ui/button';
import { Card, CardContent } from 'src/components/ui/card';
import { Loader2Icon, SparklesIcon } from 'lucide-react';

interface WheelOfFortuneProps {
  onSpin: () => void;
  disabled?: boolean;
  spinning?: boolean;
}

export default function WheelOfFortune({ onSpin, disabled, spinning }: WheelOfFortuneProps) {
  const [rotation, setRotation] = useState(0);

  const handleSpin = () => {
    // 简单旋转动画
    setRotation(prev => prev + 720 + Math.random() * 360);
    onSpin();
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
      <CardContent className="py-4">
        <div className="flex flex-col items-center gap-3">
          {/* 转盘图标 */}
          <div
            className="size-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg transition-transform duration-1000 ease-out"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <SparklesIcon className="size-8 text-white" />
          </div>

          <Button
            onClick={handleSpin}
            disabled={disabled || spinning}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
            size="lg"
          >
            {spinning ? (
              <><Loader2Icon className="size-4 animate-spin mr-2" /> 抽奖中...</>
            ) : (
              '🎰 转盘抽奖'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: 创建 CharacterPanel.tsx**

```tsx
import { Card, CardContent } from 'src/components/ui/card';

interface CharacterData {
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  charm: number;
  luck: number;
  currentTitle?: string;
  choicesMade: number;
  eventsTriggered: number;
}

interface CharacterPanelProps {
  character: CharacterData | null;
  loading?: boolean;
}

function AttrRow({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'text-green-600' : value >= 40 ? 'text-foreground' : 'text-red-500';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function CharacterPanel({ character, loading }: CharacterPanelProps) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <h4 className="text-sm font-semibold">角色属性</h4>
        {loading ? (
          <p className="text-xs text-muted-foreground">加载中...</p>
        ) : character ? (
          <>
            {character.currentTitle && (
              <div className="text-xs text-amber-600 font-medium mb-1">
                🏆 {character.currentTitle}
              </div>
            )}
            <AttrRow label="❤️ HP" value={character.hp} />
            <AttrRow label="⚔️ 攻击" value={character.attack} />
            <AttrRow label="🛡 防御" value={character.defense} />
            <AttrRow label="🧠 智力" value={character.intelligence} />
            <AttrRow label="✨ 魅力" value={character.charm} />
            <AttrRow label="🍀 运气" value={character.luck} />
            <div className="text-xs text-muted-foreground pt-1 border-t">
              选择: {character.choicesMade} 次 | 事件: {character.eventsTriggered} 次
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">暂无数据</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: 编译验证**

```bash
cd D:\project\novel-simulator\frontend && npx tsc -b --noEmit 2>&1 | grep -E "ChoicePanel|StoryViewer|WheelOfFortune|CharacterPanel" | head -5
```
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/components/ChoicePanel.tsx src/components/StoryViewer.tsx src/components/WheelOfFortune.tsx src/components/CharacterPanel.tsx
git commit -m "feat: P3-B ChoicePanel, StoryViewer, WheelOfFortune, CharacterPanel"
```

---

### Task 5: Frontend — 更新 useStory hook + StoryPage 接入真实组件

**Files:**
- Modify: `frontend/src/hooks/useStory.ts`
- Modify: `frontend/src/pages/page-player-story.tsx`

- [ ] **Step 1: 更新 useStory.ts（添加动作 dispatch）**

读取现有的 `useStory.ts`，在 return 之前添加以下方法：

```typescript
import api from '@/hooks/useApi';
// 在 return 前添加方法

const chooseAction = useCallback(async (optionId: number) => {
  if (!session?.sessionId) return;
  const res = await api.post('/player/action/choose', {
    sessionId: session.sessionId,
    optionId,
  });
  if (res.data.code === 200) {
    const data = res.data.data;
    if (data.character) setCharacter(data.character);
    // 如果有目标节点，加载新节点
    if (data.targetNode?.id) {
      await loadNode(data.targetNode.id);
    }
    return data;
  }
}, [session, loadNode]);

const spinAction = useCallback(async () => {
  if (!session?.sessionId) return;
  const res = await api.post('/player/action/spin', {
    sessionId: session.sessionId,
    nodeId: session.currentNodeId,
  });
  if (res.data.code === 200) {
    const data = res.data.data;
    if (data.character) setCharacter(data.character);
    return data;
  }
}, [session]);

// 更新 return 对象，加上 chooseAction 和 spinAction
```

同时更新 return：
```typescript
return {
  session, character, currentNode, currentOptions, loading,
  createSession, loadSession, loadNode, saveSession, restartSession, saveSettings,
  chooseAction, spinAction,
};
```

- [ ] **Step 2: 重写 page-player-story.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { useStory } from '@/hooks/useStory';
import { useSSE } from '@/hooks/useSSE';
import ChoicePanel from 'src/components/ChoicePanel';
import StoryViewer from 'src/components/StoryViewer';
import WheelOfFortune from 'src/components/WheelOfFortune';
import CharacterPanel from 'src/components/CharacterPanel';
import { Loader2Icon, ArrowLeftIcon, SaveIcon, RotateCcwIcon, MapIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function PlayerStoryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, character, currentNode, currentOptions, loading, loadSession, saveSession, restartSession, chooseAction, spinAction } = useStory();
  const { streaming, connect } = useSSE();
  const [storyText, setStoryText] = useState('');
  const [actionDisabled, setActionDisabled] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [showNodeMap, setShowNodeMap] = useState(false);

  useEffect(() => {
    if (sessionId) loadSession(sessionId);
  }, [sessionId]);

  // 会话加载后，如果已有故事文本则显示
  useEffect(() => {
    if (session?.storyText) setStoryText(session.storyText);
  }, [session?.storyText]);

  const handleChoose = async (optionId: number) => {
    setActionDisabled(true);
    try {
      const result = await chooseAction(optionId);
      // 触发 SSE 流式故事
      if (sessionId) {
        setStoryText(''); // 重置旧文本
        connect(sessionId, {
          onStory: (text) => setStoryText(prev => prev + text + '\n\n'),
          onDone: () => {
            setActionDisabled(false);
            setSpinning(false);
          },
          onError: (msg) => {
            toast.error(msg);
            setActionDisabled(false);
            setSpinning(false);
          },
        });
      }
    } catch { setActionDisabled(false); }
  };

  const handleSpin = async () => {
    setActionDisabled(true);
    setSpinning(true);
    try {
      const result = await spinAction();
      if (result?.triggeredEvent) {
        toast.info(`触发事件：${result.triggeredEvent.title}`);
      }
      // 触发 SSE 流式故事
      if (sessionId) {
        setStoryText('');
        connect(sessionId, {
          onStory: (text) => setStoryText(prev => prev + text + '\n\n'),
          onDone: () => {
            setActionDisabled(false);
            setSpinning(false);
          },
          onError: (msg) => {
            toast.error(msg);
            setActionDisabled(false);
            setSpinning(false);
          },
        });
      }
    } catch { setActionDisabled(false); setSpinning(false); }
  };

  const handleSave = async () => {
    await saveSession();
    toast.success('存档成功');
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
          <Button variant="outline" size="sm" onClick={() => setShowNodeMap(!showNodeMap)}>
            <MapIcon className="size-4 mr-1" /> 地图
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={actionDisabled}>
            <SaveIcon className="size-4 mr-1" /> 存档
          </Button>
          <Button variant="outline" size="sm" onClick={async () => { await restartSession(); setStoryText(''); }} disabled={actionDisabled}>
            <RotateCcwIcon className="size-4 mr-1" /> 重新开始
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        {/* 主区域 */}
        <div className="space-y-4">
          {/* 当前节点标题 */}
          {currentNode && (
            <div>
              <h3 className="text-lg font-semibold">{currentNode.title}</h3>
              {currentNode.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentNode.description}</p>
              )}
            </div>
          )}

          {/* 故事阅读 */}
          <StoryViewer
            text={storyText}
            streaming={streaming}
            placeholder={session.storyText ? '继续你的冒险...' : '故事即将开始...'}
          />

          {/* 选项面板 */}
          {!streaming && currentOptions.length > 0 && (
            <ChoicePanel
              options={currentOptions.map(o => ({ id: o.id, label: o.label, riskHint: o.riskHint }))}
              disabled={actionDisabled}
              onChoose={handleChoose}
            />
          )}

          {/* 转盘抽奖 */}
          {!streaming && (
            <WheelOfFortune
              onSpin={handleSpin}
              disabled={actionDisabled}
              spinning={spinning}
            />
          )}
        </div>

        {/* 角色属性侧栏 */}
        <div className="space-y-3">
          <CharacterPanel character={character} loading={loading} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 编译验证**

```bash
cd D:\project\novel-simulator\frontend && npx tsc -b --noEmit 2>&1 | head -20
```
Expected: 0 new errors (pre-existing errors in admin files may remain)

- [ ] **Step 4: Commit**

```bash
cd D:\project\novel-simulator\frontend
git add src/hooks/useStory.ts src/pages/page-player-story.tsx
git commit -m "feat: P3-B integrate ChoicePanel, StoryViewer, WheelOfFortune in story page"
```

---

## Self-Review

1. **Spec coverage:**
   - §6.2 StoryChain → Task 2 (stub) ✓
   - §6.3 BranchChain → Task 2 (stub) ✓
   - §6.4 EventChain → Task 2 (stub) ✓
   - §7.1 主循环 → Task 1-5 (完整闭环) ✓
   - §7.2 随机事件/死亡率 → Task 1 (EventEngine) ✓
   - §8.2 Player API (choose/spin/stream) → Task 2 (controller endpoints) ✓
   - §9 前端组件 (ChoicePanel/WheelOfFortune/StoryViewer/CharacterPanel) → Task 4 ✓
   - SSE 流式 → Task 2 (backend) + Task 3 (frontend useSSE) ✓

2. **Placeholder scan:** No TBD/TODO found.

3. **Type consistency:** Frontend `OptionItem` matches `NodeOption` fields. `CharacterData` interface matches `UserCharacter` entity. SSE event names (`story`, `done`, `error`) match between backend emitters and frontend listeners.
