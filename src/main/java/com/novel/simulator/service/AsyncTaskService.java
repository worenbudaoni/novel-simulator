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
    private static final long TASK_TTL_HOURS = 12;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public AsyncTaskService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public String createTask() {
        String taskId = UUID.randomUUID().toString().replace("-", "");
        String key = TASK_KEY_PREFIX + taskId;
        redisTemplate.opsForValue().set(key, "{\"status\":\"pending\"}", TASK_TTL_HOURS, TimeUnit.HOURS);
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
        redisTemplate.opsForValue().set(key, value.toString(), TASK_TTL_HOURS, TimeUnit.HOURS);
    }

    public void failTask(String taskId, String error) {
        String key = TASK_KEY_PREFIX + taskId;
        String value = "{\"status\":\"error\",\"error\":\"" + error.replace("\"", "\\\"") + "\"}";
        redisTemplate.opsForValue().set(key, value, TASK_TTL_HOURS, TimeUnit.HOURS);
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

            // LLM doesn't know this work
            if (result.containsKey("exists") && Boolean.FALSE.equals(result.get("exists"))) {
                String msg = "未找到「" + name + "」的信息，请检查作品名称拼写或换一个作品";
                log.warn("Async task {}: work '{}' not found", taskId, name);
                failTask(taskId, msg);
                return;
            }

            // LLM returned an error
            if (result.containsKey("error")) {
                String msg = (String) result.get("error");
                log.warn("Async task {}: LLM error: {}", taskId, msg);
                failTask(taskId, msg);
                return;
            }

            String json = objectMapper.writeValueAsString(result);
            updateTask(taskId, "done", json);
            log.info("Async task {}: completed for '{}'", taskId, name);
        } catch (Exception e) {
            log.error("Async task {} failed: {}", taskId, e.getMessage());
            failTask(taskId, e.getMessage());
        }
    }
}
