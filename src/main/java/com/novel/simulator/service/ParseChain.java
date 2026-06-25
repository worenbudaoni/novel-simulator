package com.novel.simulator.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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

    private final DemoNodeGenerator demoNodeGenerator;

    public ParseChain(ParseRecordMapper parseRecordMapper, LlmCacheMapper llmCacheMapper,
                      ObjectMapper objectMapper, DemoNodeGenerator demoNodeGenerator) {
        this.parseRecordMapper = parseRecordMapper;
        this.llmCacheMapper = llmCacheMapper;
        this.objectMapper = objectMapper;
        this.demoNodeGenerator = demoNodeGenerator;
    }

    /**
     * Parse novel TXT content into structured JSON using LLM.
     */
    public Map<String, Object> parse(Long novelId, String inputContent, String promptType) {
        String cacheKey = "parse:" + promptType + ":" + Integer.toHexString(inputContent.hashCode());
        LlmCache existing = llmCacheMapper.selectOne(
            new LambdaQueryWrapper<LlmCache>().eq(LlmCache::getCacheKey, cacheKey));
        if (existing != null) {
            try {
                return objectMapper.readValue(existing.getResultText(), Map.class);
            } catch (Exception e) {
                log.warn("Cache deserialize failed, re-parsing", e);
            }
        }

        String prompt = buildParsePrompt(inputContent);
        LlmResult llmResult = callLlm(prompt);

        if (llmResult.error != null) {
            saveParseRecord(novelId, promptType, inputContent, llmResult.error, (String) null, 0, 1);
            throw new RuntimeException("LLM 解析失败: " + llmResult.error);
        }

        Map<String, Object> result;
        try {
            result = objectMapper.readValue(llmResult.json, Map.class);
        } catch (Exception e) {
            saveParseRecord(novelId, promptType, inputContent, llmResult.rawResponse, (String) null, llmResult.tokensUsed, 1);
            throw new RuntimeException("LLM 返回格式错误");
        }

        saveParseRecord(novelId, promptType, inputContent, llmResult.rawResponse, result, llmResult.tokensUsed, 0);
        saveCache(cacheKey, "parse", llmResult.rawResponse);
        return result;
    }

    /**
     * Preview generate from name.
     * For 小说: always generates framework.
     * For 动漫/漫画: checks if LLM knows the work, returns {exists: false} if not.
     */
    public Map<String, Object> previewGenerate(String name, Integer contentType, int nodeCount, int eventCount) {
        String typeName = contentType == null || contentType == 0 ? "小说" :
                          contentType == 1 ? "动漫" : "漫画";
        String prompt = "你熟悉各种" + typeName + "作品。请判断你是否了解《" + name + "》这部作品。\n\n"
            + "如果你确定知道这部作品，请返回完整的互动故事框架JSON（不要markdown代码块标记），包含以下字段：\n"
            + "1. worldView: 世界观设定文本（200-500字）\n"
            + "2. nodes: 节点数组，每个节点有 title, description, isStart(boolean), isEnd(boolean), sortOrder\n"
            + "3. edges: 节点连接数组，每个连接有 sourceNodeIndex(int), targetNodeIndex(int), conditionDesc, edgeType(0=固定)\n"
            + "4. options: 节点选项数组，每个选项有 nodeIndex(int), label, targetNodeIndex(int), triggerEvent(boolean), riskHint\n"
            + "5. events: 随机事件数组，每个事件有 nodeIndex(int或-1表示全局), title, content, eventType(0=正面 1=负面 2=中立), deathProbability(0-100), weight\n"
            + "6. attrTemplate: 属性模板对象，含 hp, attack, defense, intelligence, charm, luck 的默认值\n"
            + "7. summary: 作品简介（100字以内）\n"
            + "8. author: 原作者\n\n"
            + "请确保生成" + nodeCount + "个核心节点"
            + (eventCount > 0 ? "和" + eventCount + "个随机事件" : "") + "。\n\n"
            + "如果你不确定或不了解这部作品，请严格返回以下JSON（不要多余内容）：\n"
            + "{\"exists\": false}\n\n"
            + "作品名称：《" + name + "》";

        String cacheKey = "preview:" + contentType + ":" + nodeCount + ":" + eventCount + ":" + Integer.toHexString(name.hashCode());
        LlmCache existing = llmCacheMapper.selectOne(
            new LambdaQueryWrapper<LlmCache>().eq(LlmCache::getCacheKey, cacheKey));
        if (existing != null) {
            try {
                return objectMapper.readValue(existing.getResultText(), Map.class);
            } catch (Exception e) {
                log.warn("Cache deserialize failed, re-generating", e);
            }
        }

        LlmResult llmResult = callLlm(prompt);
        if (llmResult.error != null) {
            log.warn("LLM unavailable for preview, using demo data generator");
            return demoNodeGenerator.generate(nodeCount, eventCount, name);
        }

        Map<String, Object> result;
        try {
            result = objectMapper.readValue(llmResult.json, Map.class);
        } catch (Exception e) {
            log.warn("LLM response parse failed, using demo data generator");
            return demoNodeGenerator.generate(nodeCount, eventCount, name);
        }

        // If response is just {exists: false}, use demo
        if (result.containsKey("exists") && Boolean.FALSE.equals(result.get("exists"))) {
            log.warn("LLM returned exists=false, using demo data generator");
            return demoNodeGenerator.generate(nodeCount, eventCount, name);
        }

        saveCache(cacheKey, "preview", llmResult.rawResponse);
        return result;
    }

    /**
     * Generate and create novel from name. Saves parse record if novelId provided.
     */
    public Map<String, Object> generateFromName(String name, Integer contentType, Long novelId, String promptType, int nodeCount, int eventCount) {
        String typeName = contentType == null || contentType == 0 ? "小说" :
                          contentType == 1 ? "动漫" : "漫画";
        String prompt = "你熟悉各种" + typeName + "作品。请根据你对《" + name + "》的了解，"
            + "生成该作品的互动故事框架。\n\n"
            + "请返回严格的JSON格式（不要markdown代码块标记），包含以下字段：\n"
            + "1. worldView: 世界观设定文本（200-500字）\n"
            + "2. nodes: 节点数组，每个节点有 title, description, isStart(boolean), isEnd(boolean), sortOrder\n"
            + "3. edges: 节点连接数组，每个连接有 sourceNodeIndex(int), targetNodeIndex(int), conditionDesc, edgeType(0=固定)\n"
            + "4. options: 节点选项数组，每个选项有 nodeIndex(int), label, targetNodeIndex(int), triggerEvent(boolean), riskHint\n"
            + "5. events: 随机事件数组，每个事件有 nodeIndex(int或-1表示全局), title, content, eventType(0=正面 1=负面 2=中立), deathProbability(0-100), weight\n"
            + "6. attrTemplate: 属性模板对象，含 hp, attack, defense, intelligence, charm, luck 的默认值\n"
            + "7. summary: 作品简介（100字以内）\n"
            + "8. author: 原作者（如知道）\n\n"
            + "请确保生成" + nodeCount + "个核心节点"
            + (eventCount > 0 ? "和" + eventCount + "个随机事件" : "")
            + "，覆盖故事的主要情节阶段（开始、发展、高潮、结局）。";

        String cacheKey = "gen:" + promptType + ":" + nodeCount + ":" + eventCount + ":" + Integer.toHexString(name.hashCode());
        LlmCache existing = llmCacheMapper.selectOne(
            new LambdaQueryWrapper<LlmCache>().eq(LlmCache::getCacheKey, cacheKey));
        if (existing != null) {
            try {
                return objectMapper.readValue(existing.getResultText(), Map.class);
            } catch (Exception e) {
                log.warn("Cache deserialize failed, re-generating", e);
            }
        }

        LlmResult llmResult = callLlm(prompt);
        if (llmResult.error != null) {
            log.warn("LLM unavailable for {}, using demo data generator", name);
            return demoNodeGenerator.generate(nodeCount, eventCount, name);
        }

        Map<String, Object> result;
        try {
            result = objectMapper.readValue(llmResult.json, Map.class);
        } catch (Exception e) {
            log.warn("LLM response parse failed for {}, using demo data generator", name);
            return demoNodeGenerator.generate(nodeCount, eventCount, name);
        }

        if (novelId != null) {
            saveParseRecord(novelId, promptType, name, llmResult.rawResponse, result, llmResult.tokensUsed, 0);
        }
        saveCache(cacheKey, "parse", llmResult.rawResponse);
        return result;
    }

    // --- Private helpers ---

    private static class LlmResult {
        String rawResponse;
        String json;
        String error;
        int tokensUsed;
    }

    private LlmResult callLlm(String prompt) {
        LlmResult r = new LlmResult();
        try {
            ChatLanguageModel model = buildModel();
            r.rawResponse = model.generate(prompt);
            r.tokensUsed = r.rawResponse.length() / 2;
            r.json = extractJson(r.rawResponse);
        } catch (Exception e) {
            log.error("LLM call failed", e);
            r.error = e.getMessage();
        }
        return r;
    }

    private String buildParsePrompt(String content) {
        String truncated = content.length() > 30000
            ? content.substring(0, 30000) + "\n... [内容过长已截断]"
            : content;
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

    /**
     * Call LLM with raw prompt, no DB side effects. Returns raw response text.
     */
    public String generateRaw(String prompt) {
        return callLlm(prompt).rawResponse;
    }

    private ChatLanguageModel buildModel() {
        String key = (llmApiKey != null && !llmApiKey.isEmpty()) ? llmApiKey : "sk-placeholder";
        String url = (llmApiUrl != null && !llmApiUrl.isEmpty()) ? llmApiUrl : "https://api.openai.com";
        log.info("Building LLM model: baseUrl={}, model={}", url, llmModelName);
        return OpenAiChatModel.builder()
            .apiKey(key)
            .modelName(llmModelName)
            .baseUrl(url)
            .temperature(0.7)
            .maxTokens(4096)
            .build();
    }

    private String extractJson(String text) {
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
                                  String rawResponse, String resultJson,
                                  int tokensUsed, int status) {
        ParseRecord record = new ParseRecord();
        record.setNovelId(novelId);
        record.setPromptType(promptType);
        record.setInputSummary(input.length() > 500 ? input.substring(0, 500) : input);
        record.setRawResponse(rawResponse);
        record.setResultJson(resultJson);
        record.setTokensUsed(tokensUsed);
        record.setStatus(status);
        record.setCreatedAt(LocalDateTime.now());
        parseRecordMapper.insert(record);
    }

    private void saveParseRecord(Long novelId, String promptType, String input,
                                  String rawResponse, Map<String, Object> resultJson,
                                  int tokensUsed, int status) {
        try {
            String json = resultJson != null ? objectMapper.writeValueAsString(resultJson) : null;
            saveParseRecord(novelId, promptType, input, rawResponse, json, tokensUsed, status);
        } catch (Exception e) {
            log.warn("Failed to serialize result JSON", e);
            saveParseRecord(novelId, promptType, input, rawResponse, (String) null, tokensUsed, status);
        }
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
}
