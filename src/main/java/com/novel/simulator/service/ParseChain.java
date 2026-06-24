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

    public ParseChain(ParseRecordMapper parseRecordMapper, LlmCacheMapper llmCacheMapper,
                      ObjectMapper objectMapper) {
        this.parseRecordMapper = parseRecordMapper;
        this.llmCacheMapper = llmCacheMapper;
        this.objectMapper = objectMapper;
    }

    /**
     * Parse novel content into structured JSON using LLM.
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

        String llmResponse;
        int tokensUsed = 0;
        try {
            ChatLanguageModel model = buildModel();
            llmResponse = model.generate(prompt);
            tokensUsed = llmResponse.length() / 2;
        } catch (Exception e) {
            log.error("LLM parse failed", e);
            saveParseRecord(novelId, promptType, inputContent, e.getMessage(), null, 0, 1);
            throw new RuntimeException("LLM 解析失败: " + e.getMessage());
        }

        Map<String, Object> result;
        try {
            String json = extractJson(llmResponse);
            result = objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            log.error("Failed to parse LLM response as JSON", e);
            saveParseRecord(novelId, promptType, inputContent, llmResponse, null, tokensUsed, 1);
            throw new RuntimeException("LLM 返回格式错误");
        }

        saveParseRecord(novelId, promptType, inputContent, llmResponse, result, tokensUsed, 0);
        saveCache(cacheKey, "parse", llmResponse);

        return result;
    }

    /**
     * Generate novel framework directly from name using LLM (no search).
     */
    public Map<String, Object> generateFromName(String name, Integer contentType, Long novelId, String promptType) {
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
            + "请确保至少解析出3-5个核心节点，覆盖故事的主要情节阶段（开始、发展、高潮、结局）。";

        String cacheKey = "gen:" + promptType + ":" + Integer.toHexString(name.hashCode());
        LlmCache existing = llmCacheMapper.selectOne(
            new LambdaQueryWrapper<LlmCache>().eq(LlmCache::getCacheKey, cacheKey));
        if (existing != null) {
            try {
                return objectMapper.readValue(existing.getResultText(), Map.class);
            } catch (Exception e) {
                log.warn("Cache deserialize failed, re-generating", e);
            }
        }

        String llmResponse;
        int tokensUsed = 0;
        try {
            ChatLanguageModel model = buildModel();
            llmResponse = model.generate(prompt);
            tokensUsed = llmResponse.length() / 2;
        } catch (Exception e) {
            log.error("LLM generate failed", e);
            Map<String, Object> err = new HashMap<>();
            err.put("error", "LLM 生成失败: " + e.getMessage());
            return err;
        }

        Map<String, Object> result;
        try {
            String json = extractJson(llmResponse);
            result = objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            log.error("Failed to parse LLM response as JSON", e);
            Map<String, Object> err = new HashMap<>();
            err.put("error", "LLM 返回格式错误");
            err.put("rawResponse", llmResponse);
            return err;
        }

        if (novelId != null) {
            saveParseRecord(novelId, promptType, name, llmResponse, result, tokensUsed, 0);
        }
        saveCache(cacheKey, "parse", llmResponse);

        return result;
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

    private ChatLanguageModel buildModel() {
        String apiKey = (llmApiKey != null && !llmApiKey.isEmpty()) ? llmApiKey : "sk-placeholder";
        String baseUrl = (llmApiUrl != null && !llmApiUrl.isEmpty()) ? llmApiUrl : "https://api.openai.com/v1";
        return OpenAiChatModel.builder()
            .apiKey(apiKey)
            .modelName(llmModelName)
            .baseUrl(baseUrl)
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
}
