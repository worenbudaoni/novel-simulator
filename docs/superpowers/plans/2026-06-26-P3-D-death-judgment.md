# P3-D 死亡判定 + DeathModal 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** HP ≤ 0 时触发死亡结局弹窗，复用 EndingModal

**Architecture:** Backend 在 ActionEngine 中标记死亡，前端在 SSE 完成后检查标记并展示死亡版 EndingModal

---

### Task 1: Backend — ActionResult 加 isDead 字段

**Files:**
- Modify: `src/main/java/com/novel/simulator/dto/ActionResult.java`
- Modify: `src/main/java/com/novel/simulator/service/ActionEngine.java`

**Step 1: ActionResult 添加 isDead**

```java
// 在类中新增字段
private boolean isDead;

// 新增 getter/setter
public boolean isDead() { return isDead; }
public void setIsDead(boolean isDead) { this.isDead = isDead; }
```

**Step 2: ActionEngine.choose() 中标记死亡**

在应用属性变化后、返回 result 前，添加：
```java
result.setIsDead(character.getHp() != null && character.getHp() <= 0);
```

放在 `result.setCharacter(character);` 之后。

**Step 3: ActionEngine.spin() 中标记死亡**

同样在设置 result 时添加：
```java
result.setIsDead(character.getHp() != null && character.getHp() <= 0);
```

**Step 4: 编译并提交**

```bash
cd D:/project/novel-simulator && mvn compile -q
git add src/main/java/com/novel/simulator/dto/ActionResult.java \
       src/main/java/com/novel/simulator/service/ActionEngine.java
git commit -m "feat: add isDead flag to ActionResult for death judgment"
```

---

### Task 2: Frontend — EndingModal 支持死亡模式

**Files:**
- Modify: `frontend/src/components/EndingModal.tsx`

**Step 1: 添加 isDeath prop**

```typescript
interface EndingModalProps {
  // ... 现有字段
  isDeath?: boolean;
}
```

**Step 2: 根据 isDeath 切换显示**

```typescript
// 找到这行：
<SparklesIcon className="size-8 text-primary" />
// 改为：
{isDeath ? (
  <div className="text-destructive">💀</div>
) : (
  <SparklesIcon className="size-8 text-primary" />
)}

// 找到这行：
<h2 className="text-xl font-bold">🎉 故事结局</h2>
// 改为：
<h2 className="text-xl font-bold">{isDeath ? '💀 陨落' : '🎉 故事结局'}</h2>
```

**Step 3: 保存并提交**

```bash
cd D:/project/novel-simulator/frontend
git add src/components/EndingModal.tsx
git commit -m "feat: EndingModal supports death mode with different icon and title"
```

---

### Task 3: Frontend — page-player-story 死亡检查

**Files:**
- Modify: `frontend/src/pages/page-player-story.tsx`

**Step 1: 添加死亡状态和 ref**

```typescript
const [isDead, setIsDead] = useState(false);
const pendingDeathRef = useRef(false);
```

**Step 2: handleChoose 中标记死亡**

在 `chooseAction` 返回后：
```typescript
const result = await chooseAction(targetNodeId, optionLabel);
if (!sessionId) return;

// 检查死亡
if (result?.isDead) {
    pendingDeathRef.current = true;
}

// ... 其余不变
```

**Step 3: handleSpin 中标记死亡**

在 `spinPromise` resolve 后：
```typescript
const result = await spinPromise;
// 检查死亡
if (result?.isDead) {
    pendingDeathRef.current = true;
}
// ... 其余不变
```

**Step 4: SSE onDone 中处理死亡**

```typescript
onDone: () => {
    setPendingSessionId(null);
    setPendingSpin(false);
    setShowWheel(false);
    if (pendingDeathRef.current) {
        pendingDeathRef.current = false;
        setIsDead(true);
        setShowEnding(true);
        setActionDisabled(true);
        return;
    }
    // 以下为原有逻辑
    if (pendingWheelRef.current) {
        pendingWheelRef.current = false;
        setShowWheel(true);
    } else {
        setActionDisabled(false);
    }
},
```

**Step 5: EndingModal 传递 isDeath 参数**

```typescript
{showEnding && (
    <EndingModal
        isDeath={isDead}
        nodeTitle={isDead ? '你的冒险在这里结束了' : (currentNode?.title || '结局')}
        // ... 其余不变
    />
)}
```

**Step 6: 类型检查并提交**

```bash
cd D:/project/novel-simulator/frontend
npx tsc --noEmit
git add frontend/src/pages/page-player-story.tsx
git commit -m "feat: death judgment - show death modal when HP <= 0"
```

---

### Task 4: 编译验证

```bash
cd D:/project/novel-simulator && mvn compile -q
cd frontend && npx tsc --noEmit && npm run build 2>&1 | tail -5
```
