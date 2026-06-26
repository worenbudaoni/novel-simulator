package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class AsyncTaskService {

    private static final Logger log = LoggerFactory.getLogger(AsyncTaskService.class);
    private static final String TASK_KEY_PREFIX = "task:import:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public AsyncTaskService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public String createTask() {
        String taskId = UUID.randomUUID().toString().replace("-", "");
        String key = TASK_KEY_PREFIX + taskId;
        redisTemplate.opsForValue().set(key, "{\"status\":\"pending\"}", 10, TimeUnit.MINUTES);
        return taskId;
    }

    public void updateTask(String taskId, String status, String resultJson) {
        String key = TASK_KEY_PREFIX + taskId;
        StringBuilder value = new StringBuilder();
        value.append("{\"status\":\"").append(status).append("\"");
        if (resultJson != null) {
            value.append(",\"result\":").append(resultJson);
        }
        value.append("}");
        redisTemplate.opsForValue().set(key, value.toString(), 10, TimeUnit.MINUTES);
    }

    public void failTask(String taskId, String error) {
        String key = TASK_KEY_PREFIX + taskId;
        String value = "{\"status\":\"error\",\"error\":\"" + error.replace("\"", "\\\"") + "\"}";
        redisTemplate.opsForValue().set(key, value, 10, TimeUnit.MINUTES);
    }

    public String getTaskStatus(String taskId) {
        String key = TASK_KEY_PREFIX + taskId;
        return redisTemplate.opsForValue().get(key);
    }

    @Async("asyncTaskExecutor")
    public void executeImportTask(String taskId, String name, String author, int contentType,
                                   int nodeCount, int eventCount, ParseChain parseChain) {
        try {
            updateTask(taskId, "processing", null);
            log.info("Async task {}: starting LLM generation for '{}' on thread '{}'",
                taskId, name, Thread.currentThread().getName());

            java.util.Map<String, Object> result = parseChain.previewGenerate(name, author, contentType, nodeCount, eventCount);

            String json = objectMapper.writeValueAsString(result);
            updateTask(taskId, "done", json);
            log.info("Async task {}: completed for '{}'", taskId, name);
        } catch (Exception e) {
            log.error("Async task {} failed: {}", taskId, e.getMessage());
            failTask(taskId, e.getMessage());
        }
    }
}
