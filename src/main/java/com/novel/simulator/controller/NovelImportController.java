package com.novel.simulator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novel.simulator.common.Result;
import com.novel.simulator.entity.Node;
import com.novel.simulator.entity.NodeEdge;
import com.novel.simulator.entity.Novel;
import com.novel.simulator.entity.RandomEvent;
import com.novel.simulator.mapper.NodeEdgeMapper;
import com.novel.simulator.mapper.NodeMapper;
import com.novel.simulator.mapper.RandomEventMapper;
import com.novel.simulator.service.AsyncTaskService;
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
    private final AsyncTaskService asyncTaskService;
    private final NodeMapper nodeMapper;
    private final NodeEdgeMapper nodeEdgeMapper;
    private final RandomEventMapper randomEventMapper;
    private final ObjectMapper objectMapper;

    public NovelImportController(NovelService novelService, ParseChain parseChain,
                                  AsyncTaskService asyncTaskService,
                                  NodeMapper nodeMapper, NodeEdgeMapper nodeEdgeMapper,
                                  RandomEventMapper randomEventMapper,
                                  ObjectMapper objectMapper) {
        this.novelService = novelService;
        this.parseChain = parseChain;
        this.asyncTaskService = asyncTaskService;
        this.nodeMapper = nodeMapper;
        this.nodeEdgeMapper = nodeEdgeMapper;
        this.randomEventMapper = randomEventMapper;
        this.objectMapper = objectMapper;
    }

    /**
     * Preview import — check if LLM knows this work. For 动漫/漫画 returns exists=false if unknown.
     */
    @PostMapping("/import/preview")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> previewImport(@RequestBody Map<String, Object> request) {
        String name = (String) request.get("name");
        String author = (String) request.get("author");
        Integer contentType = request.get("contentType") != null
            ? ((Number) request.get("contentType")).intValue() : 0;
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "作品名称不能为空");
        }

        int nodeCount = request.get("nodeCount") != null
            ? ((Number) request.get("nodeCount")).intValue() : 12;
        if (nodeCount < 10) nodeCount = 10;
        if (nodeCount > 30) nodeCount = 30;
        int eventCount = request.get("eventCount") != null
            ? ((Number) request.get("eventCount")).intValue() : 8;
        if (eventCount < 5) eventCount = 5;
        if (eventCount > 15) eventCount = 15;

        // Check duplicate name
        com.novel.simulator.entity.Novel existing = novelService.findByTitle(name.trim());
        if (existing != null) {
            return Result.error(400, "作品「" + name.trim() + "」已存在");
        }

        Map<String, Object> genResult = parseChain.previewGenerate(name.trim(), author, contentType, nodeCount, eventCount);

        if (genResult.containsKey("exists") && Boolean.FALSE.equals(genResult.get("exists"))) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("found", false);
            resp.put("message", "未找到「" + name.trim() + "」的足够信息，无法生成故事框架。请检查作品名称拼写。");
            return Result.success(resp);
        }

        if (genResult.containsKey("error")) {
            return Result.error(500, (String) genResult.get("error"));
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("found", true);
        resp.put("result", genResult);
        return Result.success(resp);
    }

    /**
     * Preview import (async) — creates a task and returns taskId immediately.
     * The frontend polls /import/status/{taskId} for completion.
     */
    @PostMapping("/import/preview-async")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> previewImportAsync(@RequestBody Map<String, Object> request) {
        String name = (String) request.get("name");
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "作品名称不能为空");
        }
        String author = (String) request.get("author");
        int contentType = request.get("contentType") != null ? ((Number) request.get("contentType")).intValue() : 0;
        int nodeCount = Math.min(Math.max(request.get("nodeCount") != null ? ((Number) request.get("nodeCount")).intValue() : 12, 10), 30);
        int eventCount = Math.min(Math.max(request.get("eventCount") != null ? ((Number) request.get("eventCount")).intValue() : 8, 5), 15);

        String taskId = asyncTaskService.createTask();
        asyncTaskService.executeImportTask(taskId, name.trim(), author, contentType, nodeCount, eventCount, parseChain);

        Map<String, Object> resp = new HashMap<>();
        resp.put("taskId", taskId);
        return Result.success(resp);
    }

    /**
     * Get async import task status. Returns the task JSON stored in Redis.
     */
    @GetMapping("/import/status/{taskId}")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> getImportStatus(@PathVariable String taskId) {
        String json = asyncTaskService.getTaskStatus(taskId);
        if (json == null) {
            return Result.error(404, "任务不存在或已过期");
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(json, Map.class);
            return Result.success(data);
        } catch (Exception e) {
            return Result.error(500, "解析任务状态失败");
        }
    }

    /**
     * Import novel by name — LLM generates framework directly.
     * Import novel by name — LLM generates framework directly.
     */
    @PostMapping("/import/name")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> importByName(@RequestBody Map<String, Object> request,
                                                     Authentication authentication) {
        String name = (String) request.get("name");
        String author = (String) request.get("author");
        Integer contentType = request.get("contentType") != null
            ? ((Number) request.get("contentType")).intValue() : 0;
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "作品名称不能为空");
        }

        // Check duplicate name
        com.novel.simulator.entity.Novel existing = novelService.findByTitle(name.trim());
        if (existing != null) {
            return Result.error(400, "作品「" + name.trim() + "」已存在");
        }

        // 1. LLM generates framework
        int nodeCount = request.get("nodeCount") != null
            ? ((Number) request.get("nodeCount")).intValue() : 12;
        if (nodeCount < 10) nodeCount = 10;
        if (nodeCount > 30) nodeCount = 30;
        int eventCount = request.get("eventCount") != null
            ? ((Number) request.get("eventCount")).intValue() : 8;
        if (eventCount < 5) eventCount = 5;
        if (eventCount > 15) eventCount = 15;

        Map<String, Object> genResult = parseChain.generateFromName(name.trim(), author, contentType, null, "name_gen", nodeCount, eventCount);
        if (genResult.containsKey("error")) {
            return Result.error(500, (String) genResult.get("error"));
        }

        // 2. Create novel record
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) authentication.getPrincipal();
        Long userId = Long.valueOf(user.get("userId").toString());
        Novel novel = new Novel();
        novel.setTitle((String) genResult.getOrDefault("title", name.trim()));
        novel.setAuthor((String) genResult.get("author"));
        novel.setWorldView((String) genResult.get("worldView"));
        novel.setContentType(contentType);
        novel.setSourceType(1);
        novel.setStatus(0);
        novel.setParseStatus(0);
        novel.setCreatedBy(userId);
        novel.setCreatedAt(LocalDateTime.now());
        novel.setUpdatedAt(LocalDateTime.now());
        novelService.getBaseMapper().insert(novel);

        // 3. Write parsed data to tables
        writeParsedData(novel.getId(), genResult);

        // 4. Update parse status
        novel.setParseStatus(2);
        novel.setParsedAt(LocalDateTime.now());
        novelService.getBaseMapper().updateById(novel);

        Map<String, Object> result = new HashMap<>();
        result.put("novel", novel);
        result.put("parseResult", genResult);
        return Result.success(result);
    }

    /**
     * Preview TXT upload — parse without saving to database.
     */
    @PostMapping("/import/preview-upload")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> previewTxtUpload(@RequestParam("file") MultipartFile file,
                                                         @RequestParam(value = "nodeCount", defaultValue = "12") int nodeCount,
                                                         @RequestParam(value = "eventCount", defaultValue = "8") int eventCount) {
        String content;
        try (InputStream is = file.getInputStream()) {
            content = IOUtils.toString(is, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return Result.error(400, "文件读取失败: " + e.getMessage());
        }

        if (nodeCount < 10) nodeCount = 10;
        if (nodeCount > 30) nodeCount = 30;
        if (eventCount < 5) eventCount = 5;
        if (eventCount > 15) eventCount = 15;

        // LLM parse without saving — build prompt and call directly
        String prompt = "你是一个小说解析专家。请分析以下小说内容，提取结构化信息。\n\n"
            + "请返回严格的JSON格式（不要markdown代码块标记），包含以下字段：\n"
            + "1. worldView: 世界观设定文本\n"
            + "2. nodes: 节点数组，每个节点有 title, description, isStart(boolean), isEnd(boolean), sortOrder\n"
            + "3. edges: 节点连接数组，每个连接有 sourceNodeIndex(int), targetNodeIndex(int), conditionDesc, edgeType(0=固定)\n"
            + "4. events: 随机事件数组，每个事件有 nodeIndex(int或-1表示全局), title, content, eventType(0=正面 1=负面 2=中立), deathProbability(0-100), weight\n"
            + "5. attrTemplate: 属性模板对象，含 hp, attack, defense, intelligence, charm, luck 的默认值\n"
            + "6. author: 原作者（如从内容可识别）\n\n"
            + "请确保生成" + nodeCount + "个核心节点"
            + (eventCount > 0 ? "和" + eventCount + "个随机事件" : "") + "。\n\n"
            + "小说内容：\n" + (content.length() > 30000 ? content.substring(0, 30000) + "\n... [截断]" : content);

        try {
            String llmResponse = parseChain.generateRaw(prompt);
            String json = extractJson(llmResponse);
            Map<String, Object> parseResult = objectMapper.readValue(json, Map.class);
            Map<String, Object> result = new HashMap<>();
            result.put("parseResult", parseResult);
            return Result.success(result);
        } catch (Exception e) {
            return Result.error(500, "解析失败: " + e.getMessage());
        }
    }

    private String extractJson(String text) {
        text = text.trim();
        if (text.startsWith("```")) {
            int start = text.indexOf('\n');
            int end = text.lastIndexOf("```");
            if (start > 0 && end > start) text = text.substring(start, end).trim();
        }
        return text;
    }

    /**
     * Import novel by TXT upload — LLM parses file content.
     */
    @PostMapping("/import/upload")
    @PreAuthorize("hasAuthority('novel:create')")
    public Result<Map<String, Object>> importByUpload(@RequestParam("file") MultipartFile file,
                                                       @RequestParam("novelId") Long novelId,
                                                       @RequestParam(value = "nodeCount", defaultValue = "12") int nodeCount,
                                                       @RequestParam(value = "eventCount", defaultValue = "8") int eventCount) {
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
        // Update author if LLM returned one
        if (parseResult.containsKey("author") && parseResult.get("author") != null
            && !((String) parseResult.get("author")).isEmpty()) {
            novel.setAuthor((String) parseResult.get("author"));
        }
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
                int srcIdx = e.get("sourceNodeIndex") != null ? ((Number) e.get("sourceNodeIndex")).intValue() : 0;
                int tgtIdx = e.get("targetNodeIndex") != null ? ((Number) e.get("targetNodeIndex")).intValue() : 0;
                if (srcIdx >= nodes.size() || tgtIdx >= nodes.size()) continue; // skip invalid edge
                NodeEdge edge = new NodeEdge();
                edge.setNovelId(novelId);
                edge.setSourceNodeId((Long) nodes.get(srcIdx).get("_newId"));
                edge.setTargetNodeId((Long) nodes.get(tgtIdx).get("_newId"));
                edge.setConditionDesc((String) e.get("conditionDesc"));
                edge.setEdgeType(e.get("edgeType") != null ? ((Number) e.get("edgeType")).intValue() : 0);
                nodeEdgeMapper.insert(edge);
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
