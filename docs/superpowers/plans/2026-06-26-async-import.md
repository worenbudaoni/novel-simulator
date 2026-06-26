# 异步导入方案实施计划

**Goal:** 智能生成 LLM 调用改为异步，超时 10 分钟，前端轮询展示结果弹窗

---

### Task 1: 后端 — AsyncTaskService + 异步端点

**Files:**
- Create: `src/main/java/com/novel/simulator/service/AsyncTaskService.java`
- Modify: `src/main/java/com/novel/simulator/controller/NovelImportController.java`
- Modify: `src/main/java/com/novel/simulator/service/ParseChain.java`

**Step 1: 创建 AsyncTaskService**

```java
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
        String value = "{\"status\":\"" + status + "\"";
        if (resultJson != null) {
            value += ",\"result\":" + resultJson;
        }
        value += "}";
        redisTemplate.opsForValue().set(key, value, 10, TimeUnit.MINUTES);
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

    @Async
    public void executeImportTask(String taskId, String name, String author, int contentType,
                                   int nodeCount, int eventCount, ParseChain parseChain) {
        try {
            updateTask(taskId, "processing", null);
            log.info("Async task {}: starting LLM generation for '{}'", taskId, name);

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
```

**Step 2: 在 NovelImportController 中添加异步端点**

```java
@PostMapping("/import/preview-async")
@PreAuthorize("hasAuthority('novel:create')")
public Result<Map<String, Object>> previewImportAsync(@RequestBody Map<String, Object> request) {
    String name = (String) request.get("name");
    if (name == null || name.trim().isEmpty()) {
        return Result.error(400, "作品名称不能为空");
    }
    String taskId = asyncTaskService.createTask();
    int contentType = request.get("contentType") != null ? ((Number) request.get("contentType")).intValue() : 0;
    int nodeCount = Math.min(Math.max(request.get("nodeCount") != null ? ((Number) request.get("nodeCount")).intValue() : 12, 10), 30);
    int eventCount = Math.min(Math.max(request.get("eventCount") != null ? ((Number) request.get("eventCount")).intValue() : 8, 5), 15);
    String author = (String) request.get("author");

    asyncTaskService.executeImportTask(taskId, name.trim(), author, contentType, nodeCount, eventCount, parseChain);

    Map<String, Object> resp = new HashMap<>();
    resp.put("taskId", taskId);
    return Result.success(resp);
}

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
```

Also inject `AsyncTaskService` and `ObjectMapper` into `NovelImportController`.

**Step 3: 增加 ParseChain LLM 超时到 600s**

In `ParseChain.java`, find the timeout Duration and change:
```java
.timeout(java.time.Duration.ofSeconds(600))
```

**Step 4: 启用 Spring @Async**

In `NovelSimulatorApplication.java`, add `@EnableAsync`:
```java
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class NovelSimulatorApplication {
```

**Step 5: 编译**

```bash
cd D:/project/novel-simulator && mvn compile -q
```

---

### Task 2: 前端 — 异步轮询 + 预览弹窗

**Files:**
- Modify: `frontend/src/pages/page-admin-novel-import.tsx`

**Changes:**

1. 添加状态：
```typescript
const [asyncTaskId, setAsyncTaskId] = useState<string | null>(null);
const [asyncGenerating, setAsyncGenerating] = useState(false);
const [asyncResult, setAsyncResult] = useState<any>(null);
```

2. 修改 `handleGenerate` 为异步调用：
```typescript
const handleGenerate = async () => {
    if (!name.trim()) { toast.error('请输入作品名称'); return; }
    setAsyncGenerating(true);
    setAsyncResult(null);
    setGenerateResult(null);
    try {
      const res = await api.post('/admin/novel/import/preview-async', {
        name: name.trim(),
        author: author.trim() || undefined,
        contentType: Number(contentType),
      });
      if (res.data.code === 200) {
        const tid = res.data.data.taskId;
        setAsyncTaskId(tid);
        // Start polling
        pollTaskStatus(tid);
      }
    } catch { setAsyncGenerating(false); }
};
```

3. 轮询函数：
```typescript
const pollTaskStatus = useCallback(async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/admin/novel/import/status/${taskId}`);
        if (res.data.code === 200) {
          const status = res.data.data.status;
          if (status === 'done') {
            clearInterval(interval);
            setAsyncGenerating(false);
            setAsyncTaskId(null);
            setGenerateResult(res.data.data.result);
            setAsyncResult(res.data.data.result);
          } else if (status === 'error') {
            clearInterval(interval);
            setAsyncGenerating(false);
            setAsyncTaskId(null);
            toast.error('生成失败: ' + (res.data.data.error || '未知错误'));
          }
          // 'processing' → 继续轮询
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
    // 停止轮询的清理逻辑
    return () => clearInterval(interval);
  }, []);
```

4. 在生成中时替换按钮为 loading + 提示：
```typescript
// 替换原来的生成按钮区域，添加生成中状态
{asyncGenerating && (
  <Card className="mb-6 border-primary/20 bg-primary/5">
    <CardContent className="py-8 text-center space-y-3">
      <Loader2Icon className="size-10 animate-spin mx-auto text-primary" />
      <p className="text-base font-medium">正在生成故事框架...</p>
      <p className="text-sm text-muted-foreground">
        AI 正在根据作品信息创作世界观、节点和事件，预计需要 1-5 分钟
      </p>
    </CardContent>
  </Card>
)}
```

5. 预览结果保留已有 `renderParsePreview`，但改成弹窗模式（Modal）：
   - 当 `asyncResult` 有值时，弹出一个 Modal 展示预览
   - 保留现有预览渲染逻辑

---

### Task 3: 编译验证

```bash
cd D:/project/novel-simulator && mvn compile -q
cd frontend && npx tsc --noEmit
```
