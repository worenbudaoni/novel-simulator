package com.novel.simulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

    public String createTask(Long userId, String name) {
        String taskId = UUID.randomUUID().toString().replace("-", "");
        String key = TASK_KEY_PREFIX + taskId;
        String safeName = name != null ? name.replace("\"", "\\\"") : "";
        String value = "{\"status\":\"pending\",\"name\":\"" + safeName + "\",\"userId\":" + userId + "}";
        redisTemplate.opsForValue().set(key, value, TASK_TTL_HOURS, TimeUnit.HOURS);
        redisTemplate.opsForList().leftPush("user:tasks:" + userId, taskId);
        redisTemplate.expire("user:tasks:" + userId, TASK_TTL_HOURS, TimeUnit.HOURS);
        return taskId;
    }

    public void updateTask(String taskId, String status, String name, String resultJson) {
        String key = TASK_KEY_PREFIX + taskId;
        String safeName = name != null ? name.replace("\"", "\\\"") : "";
        StringBuilder value = new StringBuilder();
        value.append("{\"status\":\"").append(status).append("\"");
        value.append(",\"name\":\"").append(safeName).append("\"");
        if (resultJson != null) {
            value.append(",\"result\":").append(resultJson);
        }
        value.append("}");
        redisTemplate.opsForValue().set(key, value.toString(), TASK_TTL_HOURS, TimeUnit.HOURS);
    }

    public void failTask(String taskId, String name, String error) {
        String key = TASK_KEY_PREFIX + taskId;
        String safeName = name != null ? name.replace("\"", "\\\"") : "";
        String value = "{\"status\":\"error\",\"name\":\"" + safeName + "\",\"error\":\""
            + error.replace("\"", "\\\"") + "\"}";
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
            updateTask(taskId, "processing", name, null);
            log.info("Async task {}: starting LLM generation for '{}' on thread '{}'",
                taskId, name, Thread.currentThread().getName());

            java.util.Map<String, Object> result = parseChain.previewGenerate(name, author, contentType, nodeCount, eventCount);

            if (result.containsKey("exists") && Boolean.FALSE.equals(result.get("exists"))) {
                String msg = "未找到「" + name + "」的信息，请检查作品名称拼写或换一个作品";
                log.warn("Async task {}: work '{}' not found", taskId, name);
                failTask(taskId, name, msg);
                return;
            }
            if (result.containsKey("error")) {
                String msg = (String) result.get("error");
                log.warn("Async task {}: LLM error: {}", taskId, msg);
                failTask(taskId, name, msg);
                return;
            }

            String json = objectMapper.writeValueAsString(result);
            updateTask(taskId, "done", name, json);
            log.info("Async task {}: completed for '{}'", taskId, name);
        } catch (Exception e) {
            log.error("Async task {} failed: {}", taskId, e.getMessage());
            failTask(taskId, name, e.getMessage());
        }
    }

    public List<Map<String, Object>> listTasks(Long userId) {
        List<Map<String, Object>> tasks = new ArrayList<>();
        List<String> taskIds = redisTemplate.opsForList().range("user:tasks:" + userId, 0, -1);
        if (taskIds == null) return tasks;
        List<String> toRemove = new ArrayList<>();
        for (String tid : taskIds) {
            String json = getTaskStatus(tid);
            if (json == null) { toRemove.add(tid); continue; }
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = objectMapper.readValue(json, Map.class);
                map.put("taskId", tid);
                tasks.add(map);
            } catch (Exception e) {
                log.warn("Failed to parse task {}: {}", tid, e.getMessage());
            }
        }
        if (!toRemove.isEmpty()) {
            for (String tid : toRemove)
                redisTemplate.opsForList().remove("user:tasks:" + userId, 1, tid);
        }
        return tasks;
    }

    public void removeTask(String taskId, Long userId) {
        redisTemplate.delete(TASK_KEY_PREFIX + taskId);
        redisTemplate.opsForList().remove("user:tasks:" + userId, 1, taskId);
    }
}
