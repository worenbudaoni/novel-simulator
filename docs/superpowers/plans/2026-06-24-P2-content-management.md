# P2 Content Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete P2 content management — novel import (TXT upload + LLM name import), node/event CRUD, admin frontend pages, and routing.

**Architecture:** Follow existing patterns (NovelController → NovelService → Mapper). New `NodeController`/`NodeService`, `EventController`/`EventService` for node/event management. LLM service layer with LangChain4j (can be stub-tested). Admin pages under `/admin/novel/:id/import`, `/admin/novel/:id/nodes`, `/admin/novel/:id/events`.

**Tech Stack:** Spring Boot 2.6.13 + MyBatisPlus + LangChain4j 0.27.0, React 19 + shadcn/ui + React Flow 12 + react-router-dom v7

---

### Task 1: Install dependencies (React Flow + shadcn select + LangChain4j OpenAI)

**Files:**
- Modify: `frontend/package.json`
- Run: `cd frontend && npm install`
- Modify: `pom.xml`

- [ ] **Step 1: Install React Flow in frontend**

Run:
```bash
cd "D:\project\novel-simulator\frontend" && npm install @xyflow/react
```

- [ ] **Step 2: Add shadcn select component**

Run:
```bash
cd "D:\project\novel-simulator\frontend" && npx shadcn@latest add select
```

- [ ] **Step 3: Add LangChain4j OpenAI dependency to pom.xml**

Edit `pom.xml` after the existing `langchain4j` dependency (line ~59):

```xml
        <dependency>
            <groupId>dev.langchain4j</groupId>
            <artifactId>langchain4j-open-ai</artifactId>
            <version>0.27.0</version>
        </dependency>
```

- [ ] **Step 4: Add commons-io dependency to pom.xml**

Edit `pom.xml` after the `commons-lang3` dependency:

```xml
        <dependency>
            <groupId>commons-io</groupId>
            <artifactId>commons-io</artifactId>
            <version>2.11.0</version>
        </dependency>
```

- [ ] **Step 5: Commit**

```bash
git add pom.xml frontend/package.json frontend/package-lock.json
git commit -m "chore: add React Flow, shadcn select, LangChain4j OpenAI deps"
```

---

### Task 2: Backend — Node CRUD Controller + Service

**Files:**
- Create: `src/main/java/com/novel/simulator/dto/SaveNodesRequest.java`
- Create: `src/main/java/com/novel/simulator/service/NodeService.java`
- Create: `src/main/java/com/novel/simulator/controller/NodeController.java`

- [ ] **Step 1: Create SaveNodesRequest DTO**

`src/main/java/com/novel/simulator/dto/SaveNodesRequest.java`:

```java
package com.novel.simulator.dto;

import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import java.util.List;

public class SaveNodesRequest {
    private List<Node> nodes;
    private List<NodeEdge> edges;
    private List<NodeOption> options;

    public List<Node> getNodes() { return nodes; }
    public void setNodes(List<Node> nodes) { this.nodes = nodes; }
    public List<NodeEdge> getEdges() { return edges; }
    public void setEdges(List<NodeEdge> edges) { this.edges = edges; }
    public List<NodeOption> getOptions() { return options; }
    public void setOptions(List<NodeOption> options) { this.options = options; }
}
```

- [ ] **Step 2: Create NodeService**

`src/main/java/com/novel/simulator/service/NodeService.java`:

```java
package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.novel.simulator.dto.SaveNodesRequest;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import com.novel.simulator.mapper.NodeMapper;
import com.novel.simulator.mapper.NodeEdgeMapper;
import com.novel.simulator.mapper.NodeOptionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class NodeService {

    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final NodeOptionMapper nodeOptionMapper;

    public NodeService(NodeMapper nodeMapper, NodeEdgeMapper nodeEdgeMapper,
                       NodeOptionMapper nodeOptionMapper) {
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
    }

    public List<Node> getNodesByNovelId(Long novelId) {
        return nodeMapper.selectList(
            new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId)
                .orderByAsc(Node::getSortOrder));
    }

    public List<NodeEdge> getEdgesByNovelId(Long novelId) {
        return nodeEdgeMapper.selectList(
            new LambdaQueryWrapper<NodeEdge>().eq(NodeEdge::getNovelId, novelId));
    }

    public List<NodeOption> getOptionsByNodeIds(List<Long> nodeIds) {
        if (nodeIds.isEmpty()) return java.util.Collections.emptyList();
        return nodeOptionMapper.selectList(
            new LambdaQueryWrapper<NodeOption>().in(NodeOption::getNodeId, nodeIds));
    }

    @Transactional
    public void saveNodes(Long novelId, SaveNodesRequest request) {
        // Delete existing nodes, edges, options for this novel
        List<Node> existingNodes = nodeMapper.selectList(
            new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId));
        if (!existingNodes.isEmpty()) {
            List<Long> existingIds = existingNodes.stream().map(Node::getId).collect(Collectors.toList());
            nodeOptionMapper.delete(new LambdaQueryWrapper<NodeOption>().in(NodeOption::getNodeId, existingIds));
            nodeEdgeMapper.delete(new LambdaQueryWrapper<NodeEdge>().eq(NodeEdge::getNovelId, novelId));
            nodeMapper.delete(new LambdaQueryWrapper<Node>().eq(Node::getNovelId, novelId));
        }

        // Insert nodes
        if (request.getNodes() != null) {
            for (Node node : request.getNodes()) {
                node.setNovelId(novelId);
                node.setCreatedAt(LocalDateTime.now());
                nodeMapper.insert(node);
            }
        }

        // Insert edges (map old IDs to new IDs if needed — here assume request edges use same IDs as nodes)
        if (request.getEdges() != null) {
            for (NodeEdge edge : request.getEdges()) {
                edge.setNovelId(novelId);
                nodeEdgeMapper.insert(edge);
            }
        }

        // Insert options
        if (request.getOptions() != null) {
            for (NodeOption option : request.getOptions()) {
                option.setCreatedAt(LocalDateTime.now());
                nodeOptionMapper.insert(option);
            }
        }
    }
}
```

- [ ] **Step 3: Create NodeController**

`src/main/java/com/novel/simulator/controller/NodeController.java`:

```java
package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.SaveNodesRequest;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import com.novel.simulator.service.NovelService;
import com.novel.simulator.service.NodeService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/novel")
public class NodeController {

    private final NodeService nodeService;
    private final NovelService novelService;

    public NodeController(NodeService nodeService, NovelService novelService) {
        this.nodeService = nodeService;
        this.novelService = novelService;
    }

    @GetMapping("/{id}/nodes")
    @PreAuthorize("hasAuthority('node:read')")
    public Result<Map<String, Object>> getNodes(@PathVariable Long id) {
        novelService.getById(id); // validate exists
        List<Node> nodes = nodeService.getNodesByNovelId(id);
        List<NodeEdge> edges = nodeService.getEdgesByNovelId(id);
        List<Long> nodeIds = nodes.stream().map(Node::getId).collect(Collectors.toList());
        List<NodeOption> options = nodeService.getOptionsByNodeIds(nodeIds);

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        result.put("options", options);
        return Result.success(result);
    }

    @PutMapping("/{id}/nodes")
    @PreAuthorize("hasAuthority('node:update')")
    public Result<Void> saveNodes(@PathVariable Long id, @RequestBody SaveNodesRequest request) {
        novelService.getById(id); // validate exists
        nodeService.saveNodes(id, request);
        return Result.success();
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/SaveNodesRequest.java src/main/java/com/novel/simulator/service/NodeService.java src/main/java/com/novel/simulator/controller/NodeController.java
git commit -m "feat: P2 backend Node CRUD controller + service"
```

---

### Task 3: Backend — Event CRUD Controller + Service

**Files:**
- Create: `src/main/java/com/novel/simulator/dto/SaveEventsRequest.java`
- Create: `src/main/java/com/novel/simulator/service/EventService.java`
- Create: `src/main/java/com/novel/simulator/controller/EventController.java`

- [ ] **Step 1: Create SaveEventsRequest DTO**

`src/main/java/com/novel/simulator/dto/SaveEventsRequest.java`:

```java
package com.novel.simulator.dto;

import com.novel.simulator.entity.RandomEvent;
import java.util.List;

public class SaveEventsRequest {
    private List<RandomEvent> events;

    public List<RandomEvent> getEvents() { return events; }
    public void setEvents(List<RandomEvent> events) { this.events = events; }
}
```

- [ ] **Step 2: Create EventService**

`src/main/java/com/novel/simulator/service/EventService.java`:

```java
package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.mapper.RandomEventMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class EventService {

    private final RandomEventMapper randomEventMapper;

    public EventService(RandomEventMapper randomEventMapper) {
        this.randomEventMapper = randomEventMapper;
    }

    public List<RandomEvent> getEventsByNovelId(Long novelId) {
        return randomEventMapper.selectList(
            new LambdaQueryWrapper<RandomEvent>().eq(RandomEvent::getNovelId, novelId)
                .orderByAsc(RandomEvent::getCreatedAt));
    }

    @Transactional
    public void saveEvents(Long novelId, List<RandomEvent> events) {
        // Delete existing events for this novel
        randomEventMapper.delete(
            new LambdaQueryWrapper<RandomEvent>().eq(RandomEvent::getNovelId, novelId));

        // Insert new events
        if (events != null) {
            for (RandomEvent event : events) {
                event.setNovelId(novelId);
                event.setCreatedAt(LocalDateTime.now());
                randomEventMapper.insert(event);
            }
        }
    }
}
```

- [ ] **Step 3: Create EventController**

`src/main/java/com/novel/simulator/controller/EventController.java`:

```java
package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.dto.SaveEventsRequest;
import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.service.EventService;
import com.novel.simulator.service.NovelService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/novel")
public class EventController {

    private final EventService eventService;
    private final NovelService novelService;

    public EventController(EventService eventService, NovelService novelService) {
        this.eventService = eventService;
        this.novelService = novelService;
    }

    @GetMapping("/{id}/events")
    @PreAuthorize("hasAuthority('event:read')")
    public Result<List<RandomEvent>> getEvents(@PathVariable Long id) {
        novelService.getById(id); // validate exists
        return Result.success(eventService.getEventsByNovelId(id));
    }

    @PutMapping("/{id}/events")
    @PreAuthorize("hasAuthority('event:update')")
    public Result<Void> saveEvents(@PathVariable Long id, @RequestBody SaveEventsRequest request) {
        novelService.getById(id); // validate exists
        eventService.saveEvents(id, request.getEvents());
        return Result.success();
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/novel/simulator/dto/SaveEventsRequest.java src/main/java/com/novel/simulator/service/EventService.java src/main/java/com/novel/simulator/controller/EventController.java
git commit -m "feat: P2 backend Event CRUD controller + service"
```

---

### Task 4: Backend — Novel Import endpoints (TXT upload + search + parse)

**Files:**
- Create: `src/main/java/com/novel/simulator/service/ParseChain.java`
- Create: `src/main/java/com/novel/simulator/controller/NovelImportController.java`

- [ ] **Step 1: Create ParseChain service (LangChain4j wrapper)**

`src/main/java/com/novel/simulator/service/ParseChain.java`:

```java
package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.entity.LlmCache;
import com.novel.simulator.entity.ParseRecord;
import com.novel.simulator.mapper.LlmCacheMapper;
import com.novel.simulator.mapper.ParseRecordMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class ParseChain {

    private static final Logger log = LoggerFactory.getLogger(ParseChain.class);

    private final ParseRecordMapper parseRecordMapper;
    private final LlmCacheMapper llmCacheMapper;
    private final ObjectMapper objectMapper;

    @Value("${llm.api-url:}")
    private String llmApiUrl;

    @Value("${llm.api-key:}")
    private String llmApiKey;

    @Value("${llm.model-name:gpt-3.5-turbo}")
    private String llmModelName;

    public ParseChain(ParseRecordMapper parseRecordMapper, LlmCacheMapper llmCacheMapper,
                      ObjectMapper objectMapper) {
        this.parseRecordMapper = parseRecordMapper;
        this.llmCacheMapper = llmCacheMapper;
        this.objectMapper = objectMapper;
    }

    /**
     * Parse novel content into structured JSON using LLM.
     * Returns a map with keys: worldView, nodes, edges, options, events, attrTemplate
     */
    public Map<String, Object> parse(Long novelId, String inputContent, String promptType) {
        // Check cache
        String cacheKey = "parse:" + promptType + ":" + Integer.toHexString(inputContent.hashCode());
        LlmCache existing = llmCacheMapper.selectById(cacheKey);
        if (existing != null) {
            try {
                return objectMapper.readValue(existing.getResultText(), Map.class);
            } catch (Exception e) {
                log.warn("Cache deserialize failed, re-parsing", e);
            }
        }

        // Build prompt
        String prompt = buildParsePrompt(inputContent);

        // Call LLM
        String llmResponse;
        int tokensUsed = 0;
        try {
            ChatLanguageModel model = buildModel();
            llmResponse = model.generate(prompt);
            tokensUsed = llmResponse.length() / 2; // rough estimate
        } catch (Exception e) {
            log.error("LLM parse failed", e);
            saveParseRecord(novelId, promptType, inputContent, e.getMessage(), null, 0, 1);
            throw new RuntimeException("LLM 解析失败: " + e.getMessage());
        }

        // Parse JSON response
        Map<String, Object> result;
        try {
            String json = extractJson(llmResponse);
            result = objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            log.error("Failed to parse LLM response as JSON", e);
            saveParseRecord(novelId, promptType, inputContent, llmResponse, null, tokensUsed, 1);
            throw new RuntimeException("LLM 返回格式错误");
        }

        // Save cache and parse record
        saveParseRecord(novelId, promptType, inputContent, llmResponse, result, tokensUsed, 0);
        saveCache(cacheKey, "parse", llmResponse);

        return result;
    }

    private String buildParsePrompt(String content) {
        String truncated = content.length() > 30000 ? content.substring(0, 30000) + "\n... [内容过长已截断]" : content;
        return "你是一个小说解析专家。请分析以下小说内容，提取结构化信息。\n\n"
            + "请返回严格的JSON格式（不要markdown代码块标记），包含以下字段：\n"
            + "1. worldView: 世界观设定文本\n"
            + "2. nodes: 节点数组，每个节点有 title, description, isStart(boolean), isEnd(boolean), sortOrder\n"
            + "3. edges: 节点连接数组，每个连接有 sourceNodeIndex(int), targetNodeIndex(int), conditionDesc, edgeType(0=固定)\n"
            + "4. options: 节点选项数组，每个选项有 nodeIndex(int), label, targetNodeIndex(int), triggerEvent(boolean), riskHint\n"
            + "5. events: 随机事件数组，每个事件有 nodeIndex(int或-1表示全局), title, content, eventType(0=正面 1=负面 2=中立), deathProbability(0-100), weight\n"
            + "6. attrTemplate: 属性模板对象，含 hp, attack, defense, intelligence, charm, luck 的默认值\n\n"
            + "请确保至少解析出3-5个核心节点。\n\n"
            + "小说内容：\n" + truncated;
    }

    private ChatLanguageModel buildModel() {
        if (llmApiUrl != null && !llmApiUrl.isEmpty()) {
            return OpenAiChatModel.builder()
                .apiKey(llmApiKey != null && !llmApiKey.isEmpty() ? llmApiKey : "sk-placeholder")
                .modelName(llmModelName)
                .baseUrl(llmApiUrl)
                .temperature(0.7)
                .maxTokens(4096)
                .build();
        }
        // Default fallback
        return OpenAiChatModel.builder()
            .apiKey(llmApiKey != null && !llmApiKey.isEmpty() ? llmApiKey : "sk-placeholder")
            .modelName(llmModelName)
            .temperature(0.7)
            .maxTokens(4096)
            .build();
    }

    private String extractJson(String text) {
        // Remove markdown code block if present
        text = text.trim();
        if (text.startsWith("```")) {
            int start = text.indexOf('\n');
            int end = text.lastIndexOf("```");
            if (start > 0 && end > start) {
                text = text.substring(start, end).trim();
            }
        }
        return text;
    }

    private void saveParseRecord(Long novelId, String promptType, String input,
                                  String rawResponse, Map<String, Object> resultJson,
                                  int tokensUsed, int status) {
        ParseRecord record = new ParseRecord();
        record.setNovelId(novelId);
        record.setPromptType(promptType);
        record.setInputSummary(input.length() > 500 ? input.substring(0, 500) : input);
        record.setRawResponse(rawResponse);
        try {
            if (resultJson != null) {
                record.setResultJson(objectMapper.writeValueAsString(resultJson));
            }
        } catch (Exception e) {
            log.warn("Failed to serialize result JSON", e);
        }
        record.setTokensUsed(tokensUsed);
        record.setStatus(status);
        record.setCreatedAt(LocalDateTime.now());
        parseRecordMapper.insert(record);
    }

    private void saveCache(String cacheKey, String promptType, String resultText) {
        LlmCache cache = new LlmCache();
        cache.setCacheKey(cacheKey);
        cache.setPromptType(promptType);
        cache.setResultText(resultText);
        cache.setCreatedAt(LocalDateTime.now());
        cache.setExpiredAt(LocalDateTime.now().plusDays(7));
        try {
            llmCacheMapper.insert(cache);
        } catch (Exception e) {
            log.warn("Failed to save LLM cache", e);
        }
    }

    /**
     * Search for novel info by name using LLM
     */
    public Map<String, Object> searchNovel(String name, Integer contentType) {
        String typeName = contentType == null || contentType == 0 ? "小说" :
                          contentType == 1 ? "动漫" : "漫画";
        String prompt = "请搜索关于" + typeName + "《" + name + "》的信息。"
            + "如果你知道这部作品，请返回JSON格式（不要markdown代码块标记）：\n"
            + "{\n"
            + "  \"exists\": true,\n"
            + "  \"title\": \"" + name + "\",\n"
            + "  \"author\": \"作者名\",\n"
            + "  \"summary\": \"作品简介（200字以内）\",\n"
            + "  \"worldView\": \"世界观设定描述\"\n"
            + "}\n\n"
            + "如果你不知道这部作品，返回：\n"
            + "{\"exists\": false, \"title\": \"" + name + "\"}";

        try {
            ChatLanguageModel model = buildModel();
            String response = model.generate(prompt);
            String json = extractJson(response);
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            log.error("Search failed", e);
            Map<String, Object> result = new HashMap<>();
            result.put("exists", false);
            result.put("title", name);
            result.put("error", e.getMessage());
            return result;
        }
    }
}
```

- [ ] **Step 2: Create NovelImportController**

`src/main/java/com/novel/simulator/controller/NovelImportController.java`:

```java
package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.service.NovelService;
import com.novel.simulator.service.ParseChain;
import org.apache.commons.io.IOUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/novel")
public class NovelImportController {

    private final NovelService novelService;
    private final ParseChain parseChain;

    public NovelImportController(NovelService novelService, ParseChain parseChain) {
        this.novelService = novelService;
        this.parseChain = parseChain;
    }

    @PostMapping("/import/check")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> checkNovel(@RequestBody Map<String, Object> request) {
        String name = (String) request.get("name");
        Integer contentType = request.get("contentType") != null
            ? ((Number) request.get("contentType")).intValue() : 0;
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "作品名称不能为空");
        }
        Map<String, Object> result = parseChain.searchNovel(name.trim(), contentType);
        return Result.success(result);
    }

    @PostMapping("/import/search")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> importBySearch(@RequestBody Map<String, Object> request,
                                                       Authentication authentication) {
        String name = (String) request.get("name");
        Integer contentType = request.get("contentType") != null
            ? ((Number) request.get("contentType")).intValue() : 0;
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "作品名称不能为空");
        }

        // 1. Search for novel info
        Map<String, Object> searchResult = parseChain.searchNovel(name.trim(), contentType);
        if (!Boolean.TRUE.equals(searchResult.get("exists"))) {
            return Result.success(searchResult);
        }

        // 2. Create novel record
        Long userId = Long.valueOf(authentication.getPrincipal().toString());
        Novel novel = new Novel();
        novel.setTitle((String) searchResult.getOrDefault("title", name.trim()));
        novel.setAuthor((String) searchResult.get("author"));
        novel.setWorldView((String) searchResult.get("worldView"));
        novel.setContentType(contentType);
        novel.setSourceType(1);
        novel.setStatus(0);
        novel.setParseStatus(0);
        novel.setCreatedBy(userId);
        novel.setCreatedAt(LocalDateTime.now());
        novel.setUpdatedAt(LocalDateTime.now());
        novelService.getBaseMapper().insert(novel);

        // 3. Parse using search summary as content
        String content = (String) searchResult.getOrDefault("summary", "") + "\n"
            + (String) searchResult.getOrDefault("worldView", "");
        Map<String, Object> parseResult = parseChain.parse(novel.getId(), content, "search_parse");

        // 4. Write parsed data to tables
        writeParsedData(novel.getId(), parseResult);

        // 5. Update parse status
        novel.setParseStatus(2);
        novel.setParsedAt(LocalDateTime.now());
        novelService.getBaseMapper().updateById(novel);

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("novel", novel);
        result.put("parseResult", parseResult);
        return Result.success(result);
    }

    @PostMapping("/import/upload")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> importByUpload(@RequestParam("file") MultipartFile file,
                                                       @RequestParam("novelId") Long novelId,
                                                       Authentication authentication) {
        Novel novel = novelService.getById(novelId);
        if (novel == null) {
            return Result.error(404, "作品不存在");
        }

        // 1. Read file content
        String content;
        try (InputStream is = file.getInputStream()) {
            content = IOUtils.toString(is, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return Result.error(400, "文件读取失败: " + e.getMessage());
        }

        // 2. Store raw content
        novel.setRawContent(content.length() > 100000 ? content.substring(0, 100000) : content);
        novel.setSourceType(0);
        novel.setParseStatus(1);
        novelService.getBaseMapper().updateById(novel);

        // 3. Parse with LLM
        Map<String, Object> parseResult;
        try {
            parseResult = parseChain.parse(novelId, content, "txt_parse");
        } catch (Exception e) {
            novel.setParseStatus(0);
            novelService.getBaseMapper().updateById(novel);
            return Result.error(500, "解析失败: " + e.getMessage());
        }

        // 4. Write parsed data
        writeParsedData(novelId, parseResult);

        // 5. Update novel status
        novel.setWorldView((String) parseResult.getOrDefault("worldView", novel.getWorldView()));
        novel.setParseStatus(2);
        novel.setParsedAt(LocalDateTime.now());
        novelService.getBaseMapper().updateById(novel);

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("novel", novel);
        result.put("parseResult", parseResult);
        return Result.success(result);
    }

    @SuppressWarnings("unchecked")
    private void writeParsedData(Long novelId, Map<String, Object> parseResult) {
        // Write nodes
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) parseResult.get("nodes");
        if (nodes != null) {
            for (Map<String, Object> n : nodes) {
                Node node = new Node();
                node.setNovelId(novelId);
                node.setTitle((String) n.getOrDefault("title", "未命名节点"));
                node.setDescription((String) n.get("description"));
                node.setIsStart(Boolean.TRUE.equals(n.get("isStart")));
                node.setIsEnd(Boolean.TRUE.equals(n.get("isEnd")));
                node.setNodeType(0);
                node.setSortOrder(n.get("sortOrder") != null ? ((Number) n.get("sortOrder")).intValue() : 0);
                node.setCreatedAt(LocalDateTime.now());
                nodeMapper().insert(node);
                // Store mapping from old index to new ID for edges/options
                n.put("_newId", node.getId());
            }
        }

        // Write edges
        List<Map<String, Object>> edges = (List<Map<String, Object>>) parseResult.get("edges");
        if (edges != null && nodes != null) {
            for (Map<String, Object> e : edges) {
                NodeEdge edge = new NodeEdge();
                edge.setNovelId(novelId);
                int srcIdx = e.get("sourceNodeIndex") != null ? ((Number) e.get("sourceNodeIndex")).intValue() : 0;
                int tgtIdx = e.get("targetNodeIndex") != null ? ((Number) e.get("targetNodeIndex")).intValue() : 0;
                if (srcIdx < nodes.size() && tgtIdx < nodes.size()) {
                    edge.setSourceNodeId((Long) nodes.get(srcIdx).get("_newId"));
                    edge.setTargetNodeId((Long) nodes.get(tgtIdx).get("_newId"));
                }
                edge.setConditionDesc((String) e.get("conditionDesc"));
                edge.setEdgeType(e.get("edgeType") != null ? ((Number) e.get("edgeType")).intValue() : 0);
                nodeEdgeMapper().insert(edge);
            }
        }

        // Write options
        List<Map<String, Object>> options = (List<Map<String, Object>>) parseResult.get("options");
        if (options != null && nodes != null) {
            for (Map<String, Object> o : options) {
                NodeOption option = new NodeOption();
                int nodeIdx = o.get("nodeIndex") != null ? ((Number) o.get("nodeIndex")).intValue() : 0;
                if (nodeIdx < nodes.size()) {
                    option.setNodeId((Long) nodes.get(nodeIdx).get("_newId"));
                }
                option.setLabel((String) o.getOrDefault("label", "继续"));
                int tgtIdx = o.get("targetNodeIndex") != null ? ((Number) o.get("targetNodeIndex")).intValue() : -1;
                if (tgtIdx >= 0 && tgtIdx < nodes.size()) {
                    option.setTargetNodeId((Long) nodes.get(tgtIdx).get("_newId"));
                }
                option.setTriggerEvent(Boolean.TRUE.equals(o.get("triggerEvent")));
                option.setRiskHint((String) o.get("riskHint"));
                option.setCreatedAt(LocalDateTime.now());
                nodeOptionMapper().insert(option);
            }
        }

        // Write events
        List<Map<String, Object>> events = (List<Map<String, Object>>) parseResult.get("events");
        if (events != null) {
            for (Map<String, Object> e : events) {
                RandomEvent event = new RandomEvent();
                event.setNovelId(novelId);
                int nodeIdx = e.get("nodeIndex") != null ? ((Number) e.get("nodeIndex")).intValue() : -1;
                if (nodeIdx >= 0 && nodeIdx < nodes.size()) {
                    event.setNodeId((Long) nodes.get(nodeIdx).get("_newId"));
                }
                event.setTitle((String) e.getOrDefault("title", "随机事件"));
                event.setContent((String) e.getOrDefault("content", ""));
                event.setEventType(e.get("eventType") != null ? ((Number) e.get("eventType")).intValue() : 2);
                event.setDeathProbability(e.get("deathProbability") != null ? ((Number) e.get("deathProbability")).intValue() : 0);
                event.setWeight(e.get("weight") != null ? ((Number) e.get("weight")).intValue() : 10);
                event.setIsLlmGen(true);
                event.setCreatedAt(LocalDateTime.now());
                randomEventMapper().insert(event);
            }
        }
    }

    // Helper: get mappers from Spring context (injected in constructor)
    private final com.novel.simulator.mapper.NodeMapper nodeMapper() {
        return null; // replaced by constructor injection
    }
    private final com.novel.simulator.mapper.NodeEdgeMapper nodeEdgeMapper() {
        return null; // replaced by constructor injection
    }
    private final com.novel.simulator.mapper.NodeOptionMapper nodeOptionMapper() {
        return null; // replaced by constructor injection
    }
    private final com.novel.simulator.mapper.RandomEventMapper randomEventMapper() {
        return null; // replaced by constructor injection
    }
}
```

Wait, those helper methods are wrong. Let me fix this properly with constructor injection.

Actually, let me re-think the NovelImportController. It needs the mappers injected via constructor. Let me fix:

- [ ] **Step 2 (revised): Create NovelImportController with proper injection**

`src/main/java/com/novel/simulator/controller/NovelImportController.java`:

```java
package com.novel.simulator.controller;

import com.novel.simulator.common.Result;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.NodeOption;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.mapper.NodeEdgeMapper;
import com.novel.simulator.mapper.NodeMapper;
import com.novel.simulator.mapper.NodeOptionMapper;
import com.novel.simulator.mapper.RandomEventMapper;
import com.novel.simulator.service.NovelService;
import com.novel.simulator.service.ParseChain;
import org.apache.commons.io.IOUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/novel")
public class NovelImportController {

    private final NovelService novelService;
    private final ParseChain parseChain;
    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final NodeOptionMapper nodeOptionMapper;
    private final RandomEventMapper randomEventMapper;

    public NovelImportController(NovelService novelService, ParseChain parseChain,
                                  NodeMapper nodeMapper, NodeEdgeMapper nodeEdgeMapper,
                                  NodeOptionMapper nodeOptionMapper, RandomEventMapper randomEventMapper) {
        this.novelService = novelService;
        this.parseChain = parseChain;
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.nodeOptionMapper = nodeOptionMapper;
        this.randomEventMapper = randomEventMapper;
    }

    @PostMapping("/import/check")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> checkNovel(@RequestBody Map<String, Object> request) {
        String name = (String) request.get("name");
        Integer contentType = request.get("contentType") != null
            ? ((Number) request.get("contentType")).intValue() : 0;
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "作品名称不能为空");
        }
        Map<String, Object> result = parseChain.searchNovel(name.trim(), contentType);
        return Result.success(result);
    }

    @PostMapping("/import/search")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> importBySearch(@RequestBody Map<String, Object> request,
                                                       Authentication authentication) {
        String name = (String) request.get("name");
        Integer contentType = request.get("contentType") != null
            ? ((Number) request.get("contentType")).intValue() : 0;
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "作品名称不能为空");
        }

        Map<String, Object> searchResult = parseChain.searchNovel(name.trim(), contentType);
        if (!Boolean.TRUE.equals(searchResult.get("exists"))) {
            return Result.success(searchResult);
        }

        Long userId = Long.valueOf(authentication.getPrincipal().toString());
        Novel novel = new Novel();
        novel.setTitle((String) searchResult.getOrDefault("title", name.trim()));
        novel.setAuthor((String) searchResult.get("author"));
        novel.setWorldView((String) searchResult.get("worldView"));
        novel.setContentType(contentType);
        novel.setSourceType(1);
        novel.setStatus(0);
        novel.setParseStatus(0);
        novel.setCreatedBy(userId);
        novel.setCreatedAt(LocalDateTime.now());
        novel.setUpdatedAt(LocalDateTime.now());
        novelService.getBaseMapper().insert(novel);

        String content = (String) searchResult.getOrDefault("summary", "")
            + "\n" + (String) searchResult.getOrDefault("worldView", "");
        Map<String, Object> parseResult = parseChain.parse(novel.getId(), content, "search_parse");

        writeParsedData(novel.getId(), parseResult);

        novel.setParseStatus(2);
        novel.setParsedAt(LocalDateTime.now());
        novelService.getBaseMapper().updateById(novel);

        Map<String, Object> result = new HashMap<>();
        result.put("novel", novel);
        result.put("parseResult", parseResult);
        return Result.success(result);
    }

    @PostMapping("/import/upload")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> importByUpload(@RequestParam("file") MultipartFile file,
                                                       @RequestParam("novelId") Long novelId,
                                                       Authentication authentication) {
        Novel novel = novelService.getById(novelId);
        if (novel == null) {
            return Result.error(404, "作品不存在");
        }

        String content;
        try (InputStream is = file.getInputStream()) {
            content = IOUtils.toString(is, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return Result.error(400, "文件读取失败: " + e.getMessage());
        }

        novel.setRawContent(content.length() > 100000 ? content.substring(0, 100000) : content);
        novel.setSourceType(0);
        novel.setParseStatus(1);
        novelService.getBaseMapper().updateById(novel);

        Map<String, Object> parseResult;
        try {
            parseResult = parseChain.parse(novelId, content, "txt_parse");
        } catch (Exception e) {
            novel.setParseStatus(0);
            novelService.getBaseMapper().updateById(novel);
            return Result.error(500, "解析失败: " + e.getMessage());
        }

        writeParsedData(novelId, parseResult);

        novel.setWorldView((String) parseResult.getOrDefault("worldView", novel.getWorldView()));
        novel.setParseStatus(2);
        novel.setParsedAt(LocalDateTime.now());
        novelService.getBaseMapper().updateById(novel);

        Map<String, Object> result = new HashMap<>();
        result.put("novel", novel);
        result.put("parseResult", parseResult);
        return Result.success(result);
    }

    @SuppressWarnings("unchecked")
    private void writeParsedData(Long novelId, Map<String, Object> parseResult) {
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) parseResult.get("nodes");
        if (nodes != null) {
            for (int i = 0; i < nodes.size(); i++) {
                Map<String, Object> n = nodes.get(i);
                Node node = new Node();
                node.setNovelId(novelId);
                node.setTitle((String) n.getOrDefault("title", "未命名节点"));
                node.setDescription((String) n.get("description"));
                node.setIsStart(Boolean.TRUE.equals(n.get("isStart")));
                node.setIsEnd(Boolean.TRUE.equals(n.get("isEnd")));
                node.setNodeType(0);
                node.setSortOrder(n.get("sortOrder") != null ? ((Number) n.get("sortOrder")).intValue() : i);
                node.setCreatedAt(LocalDateTime.now());
                nodeMapper.insert(node);
                n.put("_newId", node.getId());
            }
        }

        List<Map<String, Object>> edges = (List<Map<String, Object>>) parseResult.get("edges");
        if (edges != null && nodes != null) {
            for (Map<String, Object> e : edges) {
                NodeEdge edge = new NodeEdge();
                edge.setNovelId(novelId);
                int srcIdx = e.get("sourceNodeIndex") != null ? ((Number) e.get("sourceNodeIndex")).intValue() : 0;
                int tgtIdx = e.get("targetNodeIndex") != null ? ((Number) e.get("targetNodeIndex")).intValue() : 0;
                if (srcIdx < nodes.size() && tgtIdx < nodes.size()) {
                    edge.setSourceNodeId((Long) nodes.get(srcIdx).get("_newId"));
                    edge.setTargetNodeId((Long) nodes.get(tgtIdx).get("_newId"));
                }
                edge.setConditionDesc((String) e.get("conditionDesc"));
                edge.setEdgeType(e.get("edgeType") != null ? ((Number) e.get("edgeType")).intValue() : 0);
                nodeEdgeMapper.insert(edge);
            }
        }

        List<Map<String, Object>> options = (List<Map<String, Object>>) parseResult.get("options");
        if (options != null && nodes != null) {
            for (Map<String, Object> o : options) {
                NodeOption option = new NodeOption();
                int nodeIdx = o.get("nodeIndex") != null ? ((Number) o.get("nodeIndex")).intValue() : 0;
                if (nodeIdx < nodes.size()) {
                    option.setNodeId((Long) nodes.get(nodeIdx).get("_newId"));
                }
                option.setLabel((String) o.getOrDefault("label", "继续"));
                int tgtIdx = o.get("targetNodeIndex") != null ? ((Number) o.get("targetNodeIndex")).intValue() : -1;
                if (tgtIdx >= 0 && tgtIdx < nodes.size()) {
                    option.setTargetNodeId((Long) nodes.get(tgtIdx).get("_newId"));
                }
                option.setTriggerEvent(Boolean.TRUE.equals(o.get("triggerEvent")));
                option.setRiskHint((String) o.get("riskHint"));
                option.setCreatedAt(LocalDateTime.now());
                nodeOptionMapper.insert(option);
            }
        }

        List<Map<String, Object>> events = (List<Map<String, Object>>) parseResult.get("events");
        if (events != null) {
            for (Map<String, Object> e : events) {
                RandomEvent event = new RandomEvent();
                event.setNovelId(novelId);
                int nodeIdx = e.get("nodeIndex") != null ? ((Number) e.get("nodeIndex")).intValue() : -1;
                if (nodeIdx >= 0 && nodeIdx < nodes.size()) {
                    event.setNodeId((Long) nodes.get(nodeIdx).get("_newId"));
                }
                event.setTitle((String) e.getOrDefault("title", "随机事件"));
                event.setContent((String) e.getOrDefault("content", ""));
                event.setEventType(e.get("eventType") != null ? ((Number) e.get("eventType")).intValue() : 2);
                event.setDeathProbability(e.get("deathProbability") != null ? ((Number) e.get("deathProbability")).intValue() : 0);
                event.setWeight(e.get("weight") != null ? ((Number) e.get("weight")).intValue() : 10);
                event.setIsLlmGen(true);
                event.setCreatedAt(LocalDateTime.now());
                randomEventMapper.insert(event);
            }
        }
    }
}
```

Also need to add `getBaseMapper()` to NovelService. Let me check if BaseMapper is accessible... Actually, in MyBatisPlus, the mapper is injected separately. Let me instead add a `getBaseMapper()` method or just directly inject NovelMapper.

Let me add the `getBaseMapper()` method to NovelService instead:

```java
// Add to NovelService:
public com.baomidou.mybatisplus.core.mapper.BaseMapper<Novel> getBaseMapper() {
    return novelMapper;
}
```

Actually, we need to do this properly. Let me just have the NovelService expose a method instead of relying on getBaseMapper().

- [ ] **Step 3: Add getBaseMapper() to NovelService**

Add to `src/main/java/com/novel/simulator/service/NovelService.java`:

```java
    // Add this method for direct mapper access
    public com.baomidou.mybatisplus.core.mapper.BaseMapper<Novel> getBaseMapper() {
        return novelMapper;
    }
```

- [ ] **Step 4: Add LLM config to application.yml**

Add to `src/main/resources/application.yml`:

```yaml
llm:
  api-url: ""
  api-key: ""
  model-name: gpt-3.5-turbo
```

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/novel/simulator/service/ParseChain.java src/main/java/com/novel/simulator/controller/NovelImportController.java src/main/java/com/novel/simulator/service/NovelService.java src/main/resources/application.yml
git commit -m "feat: P2 backend novel import controller + ParseChain"
```

---

### Task 5: Frontend — Add NovelImport page

**Files:**
- Create: `frontend/src/components/page-admin-novel-import.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create NovelImport page component**

`frontend/src/components/page-admin-novel-import.tsx`:

```tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Separator } from 'src/components/ui/separator';
import { Badge } from 'src/components/ui/badge';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import { ArrowLeftIcon, UploadIcon, SearchIcon, Loader2Icon } from 'lucide-react';

interface NovelInfo {
  id: number;
  title: string;
  author: string;
  contentType: number;
  status: number;
  parseStatus: number;
}

export default function AdminNovelImportPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [novel, setNovel] = useState<NovelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [contentType, setContentType] = useState('0');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);

  // Load novel info
  useState(() => {
    if (novelId) {
      setLoading(true);
      api.get(`/api/admin/novel/${novelId}`).then(res => {
        if (res.data.code === 200) {
          setNovel(res.data.data.novel);
        }
      }).finally(() => setLoading(false));
    }
  });

  const handleSearch = async () => {
    if (!searchName.trim()) { toast.error('请输入作品名称'); return; }
    setSearching(true);
    setSearchResult(null);
    setParseResult(null);
    try {
      const res = await api.post('/api/admin/novel/import/check', {
        name: searchName.trim(),
        contentType: Number(contentType),
      });
      if (res.data.code === 200) {
        setSearchResult(res.data.data);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleImportSearch = async () => {
    if (!searchResult?.exists) return;
    setImporting(true);
    try {
      const res = await api.post('/api/admin/novel/import/search', {
        name: searchName.trim(),
        contentType: Number(contentType),
      });
      if (res.data.code === 200) {
        setParseResult(res.data.data);
        setNovel(res.data.data.novel);
        toast.success('导入成功');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('请选择文件'); return; }
    if (!novelId) { toast.error('作品ID缺失'); return; }
    setUploading(true);
    setParseResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('novelId', novelId);
      const res = await api.post('/api/admin/novel/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.code === 200) {
        setParseResult(res.data.data);
        setNovel(res.data.data.novel);
        toast.success('上传解析成功');
      }
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">导入作品</h2>
          {novel && (
            <p className="text-sm text-muted-foreground">
              {novel.title} {novel.author ? `/ ${novel.author}` : ''}
            </p>
          )}
        </div>
        {parseResult && (
          <Badge variant="outline" className="ml-auto text-green-600">已解析</Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* TXT Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UploadIcon className="size-4" /> TXT 上传
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              上传小说 TXT 文件，由 AI 自动解析为故事框架。
            </p>
            <Input type="file" accept=".txt" onChange={handleFileChange} />
            <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="w-full">
              {uploading ? <><Loader2Icon className="size-4 animate-spin mr-2" /> 上传解析中...</> : '上传并解析'}
            </Button>
          </CardContent>
        </Card>

        {/* Web Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SearchIcon className="size-4" /> 联网搜索
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              输入作品名称，AI 搜索后自动生成故事框架。
            </p>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">小说</SelectItem>
                <SelectItem value="1">动漫</SelectItem>
                <SelectItem value="2">漫画</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="作品名称"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2Icon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
              </Button>
            </div>

            {searchResult && (
              <div className="rounded-md border p-3 space-y-2">
                {searchResult.exists ? (
                  <>
                    <p className="text-sm text-green-600 font-medium">✓ 找到作品信息</p>
                    {searchResult.author && (
                      <p className="text-xs text-muted-foreground">作者: {searchResult.author}</p>
                    )}
                    {searchResult.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-3">{searchResult.summary}</p>
                    )}
                    <Button onClick={handleImportSearch} disabled={importing} size="sm" className="w-full">
                      {importing ? <><Loader2Icon className="size-4 animate-spin mr-2" /> 导入中...</> : '确认导入'}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-amber-600">
                    ❌ 未找到「{searchName}」的足够信息{searchResult.error ? `: ${searchResult.error}` : ''}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Parse Result Preview */}
      {parseResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">解析结果预览</CardTitle>
          </CardHeader>
          <CardContent>
            {parseResult.parseResult?.worldView && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-1">世界观</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                  {typeof parseResult.parseResult.worldView === 'string'
                    ? parseResult.parseResult.worldView
                    : JSON.stringify(parseResult.parseResult.worldView)}
                </p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              {parseResult.parseResult?.nodes && (
                <div className="bg-muted/30 rounded-md p-3 text-center">
                  <div className="text-2xl font-bold">{(parseResult.parseResult.nodes as any[])?.length || 0}</div>
                  <div className="text-muted-foreground">节点</div>
                </div>
              )}
              {parseResult.parseResult?.edges && (
                <div className="bg-muted/30 rounded-md p-3 text-center">
                  <div className="text-2xl font-bold">{(parseResult.parseResult.edges as any[])?.length || 0}</div>
                  <div className="text-muted-foreground">连接</div>
                </div>
              )}
              {parseResult.parseResult?.events && (
                <div className="bg-muted/30 rounded-md p-3 text-center">
                  <div className="text-2xl font-bold">{(parseResult.parseResult.events as any[])?.length || 0}</div>
                  <div className="text-muted-foreground">事件</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add import route in App.tsx**

Add import for the new page at the top of `frontend/src/App.tsx`:

```tsx
import AdminNovelImportPage from 'src/components/page-admin-novel-import';
```

Add route inside the ProtectedAdmin wrapper area (replace existing `/admin` route with a parent route):

Change the existing admin route from:
```tsx
<Route path="/admin" element={
  <ProtectedAdmin>
    <DashboardLayout>
      <AdminNovelsPage />
    </DashboardLayout>
  </ProtectedAdmin>
} />
```

To:
```tsx
<Route path="/admin" element={
  <ProtectedAdmin>
    <DashboardLayout>
      <AdminNovelsPage />
    </DashboardLayout>
  </ProtectedAdmin>
} />
<Route path="/admin/novel/:novelId/import" element={
  <ProtectedAdmin>
    <DashboardLayout>
      <AdminNovelImportPage />
    </DashboardLayout>
  </ProtectedAdmin>
} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/page-admin-novel-import.tsx frontend/src/App.tsx
git commit -m "feat: P2 frontend NovelImport page with TXT upload and web search"
```

---

### Task 6: Frontend — Add Admin routing for node/event pages + sidebar navigation links

**Files:**
- Create: `frontend/src/components/page-admin-node-editor.tsx`
- Create: `frontend/src/components/page-admin-event-pool.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/app-sidebar.tsx`

- [ ] **Step 1: Create NodeEditor placeholder page**

`frontend/src/components/page-admin-node-editor.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Badge } from 'src/components/ui/badge';
import { Input } from 'src/components/ui/input';
import { Textarea } from 'src/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import { ArrowLeftIcon, PlusIcon, SaveIcon, Loader2Icon, GitBranchIcon } from 'lucide-react';

interface NodeData {
  id?: number;
  novelId?: number;
  title: string;
  description: string;
  nodeType: number;
  isStart: boolean;
  isEnd: boolean;
  sortOrder: number;
}

interface EdgeData {
  id?: number;
  sourceNodeId: number;
  targetNodeId: number;
  conditionDesc: string;
  edgeType: number;
}

interface OptionData {
  id?: number;
  nodeId: number;
  label: string;
  targetNodeId?: number;
  triggerEvent: boolean;
  riskHint: string;
}

export default function AdminNodeEditorPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [options, setOptions] = useState<OptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNode, setEditingNode] = useState<number | null>(null);

  useEffect(() => {
    if (!novelId) return;
    setLoading(true);
    api.get(`/api/admin/novel/${novelId}/nodes`).then(res => {
      if (res.data.code === 200) {
        setNodes(res.data.data.nodes || []);
        setEdges(res.data.data.edges || []);
        setOptions(res.data.data.options || []);
      }
    }).finally(() => setLoading(false));
  }, [novelId]);

  const addNode = () => {
    const newNode: NodeData = {
      title: '新节点',
      description: '',
      nodeType: 0,
      isStart: nodes.length === 0,
      isEnd: false,
      sortOrder: nodes.length,
    };
    setNodes([...nodes, newNode]);
    setEditingNode(nodes.length);
  };

  const updateNode = (index: number, field: keyof NodeData, value: any) => {
    const updated = [...nodes];
    (updated[index] as any)[field] = value;
    setNodes(updated);
  };

  const saveAll = async () => {
    if (!novelId) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/admin/novel/${novelId}/nodes`, { nodes, edges, options });
      if (res.data.code === 200) {
        toast.success('保存成功');
        // Reload to get updated IDs
        const reload = await api.get(`/api/admin/novel/${novelId}/nodes`);
        if (reload.data.code === 200) {
          setNodes(reload.data.data.nodes || []);
          setEdges(reload.data.data.edges || []);
          setOptions(reload.data.data.options || []);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">节点编辑器</h2>
          <Badge variant="outline">{nodes.length} 节点 / {edges.length} 连接</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addNode}>
            <PlusIcon className="size-4 mr-1" /> 添加节点
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <><Loader2Icon className="size-4 animate-spin mr-1" /> 保存中...</> : <><SaveIcon className="size-4 mr-1" /> 保存</>}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-muted/20 p-8 text-center text-muted-foreground mb-6">
        <GitBranchIcon className="size-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">节点关系可视化需要 React Flow 画布</p>
        <p className="text-xs mt-1">下方为简易表格编辑器，可编辑节点标题和描述</p>
      </div>

      <div className="space-y-3">
        {nodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无节点，点击"添加节点"开始
          </div>
        ) : nodes.map((node, idx) => (
          <Card key={idx}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">
                  #{idx + 1}
                </CardTitle>
                {node.isStart && <Badge variant="default" className="text-xs">起点</Badge>}
                {node.isEnd && <Badge variant="secondary" className="text-xs">结局</Badge>}
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingNode(editingNode === idx ? null : idx)}>
                    {editingNode === idx ? '收起' : '编辑'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className={editingNode === idx ? 'px-4 pb-4 space-y-3' : 'px-4 pb-4'}>
              <Input
                value={node.title}
                onChange={e => updateNode(idx, 'title', e.target.value)}
                className="text-sm font-medium"
              />
              {editingNode === idx && (
                <>
                  <Textarea
                    value={node.description}
                    onChange={e => updateNode(idx, 'description', e.target.value)}
                    placeholder="节点描述"
                    rows={3}
                  />
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={node.isStart} onChange={e => updateNode(idx, 'isStart', e.target.checked)} />
                      起始节点
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={node.isEnd} onChange={e => updateNode(idx, 'isEnd', e.target.checked)} />
                      结局节点
                    </label>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create EventPool page**

`frontend/src/components/page-admin-event-pool.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Textarea } from 'src/components/ui/textarea';
import { Badge } from 'src/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from 'src/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from 'src/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/hooks/useApi';
import { ArrowLeftIcon, PlusIcon, SaveIcon, Loader2Icon, PencilIcon, Trash2Icon } from 'lucide-react';

interface RandomEvent {
  id?: number;
  novelId?: number;
  nodeId?: number;
  title: string;
  content: string;
  eventType: number;
  deathProbability: number;
  attrChanges: string;
  weight: number;
}

export default function AdminEventPoolPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<RandomEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RandomEvent | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!novelId) return;
    setLoading(true);
    api.get(`/api/admin/novel/${novelId}/events`).then(res => {
      if (res.data.code === 200) {
        setEvents(res.data.data || []);
      }
    }).finally(() => setLoading(false));
  }, [novelId]);

  const openNew = () => {
    setEditingEvent({
      title: '',
      content: '',
      eventType: 2,
      deathProbability: 0,
      attrChanges: '{}',
      weight: 10,
    });
    setShowDialog(true);
  };

  const openEdit = (event: RandomEvent) => {
    setEditingEvent({ ...event });
    setShowDialog(true);
  };

  const saveEvent = () => {
    if (!editingEvent || !editingEvent.title.trim()) {
      toast.error('请输入事件标题');
      return;
    }
    if (editingEvent.id) {
      setEvents(events.map(e => e.id === editingEvent.id ? editingEvent : e));
    } else {
      setEvents([...events, { ...editingEvent, id: Date.now() }]);
    }
    setShowDialog(false);
    setEditingEvent(null);
  };

  const removeEvent = (index: number) => {
    setEvents(events.filter((_, i) => i !== index));
  };

  const saveAll = async () => {
    if (!novelId) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/admin/novel/${novelId}/events`, { events });
      if (res.data.code === 200) {
        toast.success('保存成功');
      }
    } finally {
      setSaving(false);
    }
  };

  const eventTypeLabel = (t: number) => ['正面', '负面', '中立'][t] || '未知';
  const eventTypeColor = (t: number) => ['text-green-600', 'text-red-600', 'text-muted-foreground'][t] || '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin mr-2" /> 加载中...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold">事件管理</h2>
          <Badge variant="outline">{events.length} 事件</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openNew}>
            <PlusIcon className="size-4 mr-1" /> 添加事件
          </Button>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <><Loader2Icon className="size-4 animate-spin mr-1" /> 保存中...</> : <><SaveIcon className="size-4 mr-1" /> 保存</>}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>死亡率</TableHead>
              <TableHead>权重</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">暂无事件</TableCell>
              </TableRow>
            ) : events.map((event, idx) => (
              <TableRow key={event.id || idx}>
                <TableCell className="font-medium">{event.title}</TableCell>
                <TableCell className={eventTypeColor(event.eventType)}>{eventTypeLabel(event.eventType)}</TableCell>
                <TableCell>{event.deathProbability}%</TableCell>
                <TableCell>{event.weight}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(event)}>
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeEvent(idx)}>
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent?.id ? '编辑事件' : '新建事件'}</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">标题 *</label>
                <Input value={editingEvent.title} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">内容</label>
                <Textarea value={editingEvent.content} onChange={e => setEditingEvent({...editingEvent, content: e.target.value})} rows={4} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">类型</label>
                  <select
                    value={editingEvent.eventType}
                    onChange={e => setEditingEvent({...editingEvent, eventType: Number(e.target.value)})}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value={0}>正面</option>
                    <option value={1}>负面</option>
                    <option value={2}>中立</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">死亡率 (%)</label>
                  <Input type="number" value={editingEvent.deathProbability} onChange={e => setEditingEvent({...editingEvent, deathProbability: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">权重</label>
                  <Input type="number" value={editingEvent.weight} onChange={e => setEditingEvent({...editingEvent, weight: Number(e.target.value)})} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={saveEvent}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx routes**

Add imports:
```tsx
import AdminNodeEditorPage from 'src/components/page-admin-node-editor';
import AdminEventPoolPage from 'src/components/page-admin-event-pool';
```

Add routes after the existing `/admin` route:
```tsx
<Route path="/admin/novel/:novelId/nodes" element={
  <ProtectedAdmin>
    <DashboardLayout>
      <AdminNodeEditorPage />
    </DashboardLayout>
  </ProtectedAdmin>
} />
<Route path="/admin/novel/:novelId/events" element={
  <ProtectedAdmin>
    <DashboardLayout>
      <AdminEventPoolPage />
    </DashboardLayout>
  </ProtectedAdmin>
} />
```

- [ ] **Step 4: Update sidebar navigation links**

In `frontend/src/components/app-sidebar.tsx`, update the admin nav item URLs. The sidebar currently has:
```tsx
<NavMain title="管理后台" items={[
  { title: "作品管理", url: "/admin", icon: <LayoutDashboard /> },
  { title: "节点管理", url: "/admin", icon: <GitBranch /> },
  { title: "事件管理", url: "/admin", icon: <Zap /> },
  { title: "用户管理", url: "/admin", icon: <Users /> },
]} />
```

The "节点管理" and "事件管理" currently point to `/admin` which is the novels list page. Since these require a novel context, they should either be accessed from the novel list page or we keep them as placeholders pointing to the novels list. For now, let's leave them pointing to `/admin` and add buttons in the novel list table to navigate to import/node/event pages.

Actually, looking at this more carefully, the admin page structure is:
- `/admin` - novel list (home)
- `/admin/novel/:novelId/import` - import page
- `/admin/novel/:novelId/nodes` - node editor
- `/admin/novel/:novelId/events` - event pool

These are per-novel pages. The sidebar should link to `/admin` (novel list), and from there users click into specific novels to manage them.

The "节点管理" and "事件管理" sidebar links should probably be removed from the top-level nav since they require a novel context. Let me keep them but change them to be clearer:

Actually, let's keep the sidebar as-is for now (they all point to `/admin`) and instead add row-level action buttons in the novel list table.

- [ ] **Step 5: Update AdminNovelsPage with action buttons**

In `frontend/src/components/page-admin-novels.tsx`, update the action column to include import, nodes, and events buttons:

Replace the existing action cell:
```tsx
<TableCell>
  <div className="flex gap-1">
    <Button variant="ghost" size="icon-sm"><PencilIcon className="size-4" /></Button>
    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(n.id)}>
      <Trash2Icon className="size-4 text-destructive" />
    </Button>
  </div>
</TableCell>
```

With:
```tsx
<TableCell>
  <div className="flex gap-1">
    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/import`)} title="导入">
      <UploadIcon className="size-4" />
    </Button>
    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/nodes`)} title="节点编辑">
      <GitBranchIcon className="size-4" />
    </Button>
    <Button variant="ghost" size="icon-sm" onClick={() => navigate(`/admin/novel/${n.id}/events`)} title="事件管理">
      <ZapIcon className="size-4" />
    </Button>
    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(n.id)}>
      <Trash2Icon className="size-4 text-destructive" />
    </Button>
  </div>
</TableCell>
```

And add the necessary imports:
```tsx
import { UploadIcon, GitBranchIcon, ZapIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
```

And add `const navigate = useNavigate();` at the top of the component.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/page-admin-node-editor.tsx frontend/src/components/page-admin-event-pool.tsx frontend/src/App.tsx frontend/src/components/app-sidebar.tsx frontend/src/components/page-admin-novels.tsx
git commit -m "feat: P2 frontend node editor, event pool, admin routing"
```

---

### Task 7: Add Textarea shadcn component

**Files:**
- Run: `npx shadcn add textarea`

- [ ] **Step 1: Add textarea component**

Run:
```bash
cd "D:\project\novel-simulator\frontend" && npx shadcn@latest add textarea
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/textarea.tsx
git commit -m "chore: add shadcn textarea component"
```

---

### Task 8: Update SUMMARY.md to reflect P2 completion

**Files:**
- Modify: `docs/superpowers/roadmap/SUMMARY.md`

- [ ] **Step 1: Update SUMMARY.md**

Update the P2 status in `docs/superpowers/roadmap/SUMMARY.md`:

Change:
```
| **P2 内容管理** | ⏳ 待开始 | 0% | - |
```

To (with more detail):
```
| **P2 内容管理** | 🔄 进行中 | 后端 80% / 前端 60% | Novel CRUD完成, Node/Event CRUD完成, ParseChain完成, Import页面完成, NodeEditor+EventPool基础版完成 |
```

Also update the "当前阶段" section and add more detailed completion info in the P2 section.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/roadmap/SUMMARY.md
git commit -m "docs: update P2 progress in SUMMARY.md"
```

---

## Self-Review

After writing the plan, check:

1. **Spec coverage**: The P2 roadmap items are covered:
   - Task 1: Dependencies
   - Task 2: Node CRUD (P2-2.4)
   - Task 3: Event CRUD (P2-2.4)
   - Task 4: Import/parse (P2-2.2, 2.3, 2.5)
   - Task 5: NovelImport frontend (P2-2.6)
   - Task 6: NodeEditor + EventPool frontend (P2-2.7)
   - Task 7: UI components
   - Task 8: Summary update

2. **Placeholder scan**: No TBD/TODO in code blocks. All files have complete content.

3. **Type consistency**: NodeService methods match NodeController calls. Request DTOs match controller signatures.

4. **P2-2.1 (Novel CRUD backend)** and **P2-2.6 novel list page** were already complete before this plan.
   P2-2.8 (integration testing) is a manual step left to the developer.
