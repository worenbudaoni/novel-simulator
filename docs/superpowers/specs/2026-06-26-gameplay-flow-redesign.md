# 玩法流程重构 — 因果链系统设计

> 版本: v1.0
> 日期: 2026-06-26
> 状态: 已定稿

---

## 1. 问题分析

### 1.1 当前玩法流程

```
到达节点 → 生成选项 → 选择 → 导航目标节点
                                    ↓
                             [概率触发转盘?]  ← 随机，跟选择无关
                                ↓
                             转盘抽奖      ← 独立 mini-game
                                ↓
                           SSE 故事生成    ← 故事不知道转盘结果
```

### 1.2 四个断裂点

| 断裂点 | 表现 | 根因 |
|--------|------|------|
| **选择-转盘无因果** | 转盘概率随机触发，和玩家刚才做的选择无关 | `pendingWheelRef` 仅基于 settings.randomRate 概率 roll |
| **属性只有"软作用"** | 属性传入 LLM prompt 作为"提示"，代码层面无机械约束 | 无 d20 检定公式，无属性门槛校验 |
| **故事-机制脱节** | StoryChain 只收到文字描述，不知道实际属性变化值 | `generateStory()` 参数只有 `actionDescription: String` |
| **轮盘是打断** | 转盘在故事结束后弹窗，需要玩家再点一次，打断沉浸 | 转盘是独立弹窗 + 额外 API 调用，和选择不在同一次交互 |

---

## 2. 设计目标

1. **因果链清晰**：选择 → 检定 → 机械结果 → 叙事，每个环节是上一个的自然延续
2. **属性有硬作用**：属性直接参与 d20 检定公式，不再仅作为 LLM prompt 提示
3. **轮盘变检定**：转盘从独立 mini-game 变为"冒险检定的视觉呈现"，自动播放
4. **故事反映机械**：StoryChain 收到完整检定数据，生成的故事准确叙述发生了什么
5. **一次交互完成**：resolve API 合并旧 choose + spin，一次请求返回全部结果

---

## 3. 改造后流程

### 3.1 总体数据流

```
节点到达
  ↓
① OptionChain(LLM) → 带风险标签的选项
  ↓
② 前端 ChoicePanel 展示选项 + 风险标签 + 属性提示
  ↓
③ 玩家选择 → POST /action/resolve
  ↓
④ ActionEngine.resolveChoice()
  ├─ safe     → 稳定微增属性
  ├─ risky    → d20 属性检定 ±事件
  └─ daring   → 强制触发事件(EventChain)
  ↓
⑤ 前端 ResolutionDisplay 展示检定结果(2-3s)
  ├─ 骰子动画 / 轮盘动画
  ├─ 检定结果表 (risky)
  ├─ 事件卡片 (daring / risky失败)
  └─ 属性变化浮动数字
  ↓
⑥ SSE: StoryChain 收到 ResolutionResult 后生成叙事
  ↓
⑦ StoryViewer 流式显示故事
  ↓
⑧ CharacterPanel 属性动画更新
  ↓
到达下一节点 → 回到①
```

### 3.2 三种风险等级的完整路径

#### safe — 安全推进

```
选择 "沿大路稳步前行" (safe)
  → 无需检定
  → 稳定效果: HP+5~10, 微增对应属性+1
  → 前端: 绿色标签 + 数字浮动
  → Story: "你沿着大路稳步前行，途中发现了一些有用的物资..."
```

#### risky — 冒险检定

```
选择 "探索古道密道" (risky)
  → 自动识别关联属性: 探索→智力(intelligence)
  → d20 + 属性修正 vs DC
    - 修正 = (属性值-50)/10, 如智力70→修正+2
    - DC: 一般12 / 困难15 / 极高18
  → 成功: 正面事件 + 大额收益 (如 HP+10, 智力+3)
  → 失败: 负面事件 + 属性损失 (如 HP-20, 运气-2)
  → 前端: 骰子动画 + 结果表 + (事件卡片)
  → Story: "你小心翼翼地踏入密道... (检定结果叙事)"
```

#### daring — 高风险

```
选择 "直闯虎穴" (daring)
  → 强制触发 EventChain(LLM)
  → 属性偏向: 高运气→正面概率高, 高智力→可预判
  → 事件结果受角色属性影响
  → 前端: 轮盘动画快速闪过 + 事件卡片
  → Story: "你深吸一口气，推开了大门... (事件融入叙事)"
```

---

## 4. 后端设计

### 4.1 OptionVO — 扩展字段

```java
public class OptionVO {
    private Long id;
    private String label;
    private Long targetNodeId;
    
    // NEW:
    private String riskLevel;        // "safe" | "risky" | "daring"
    private String attrHint;         // "需要一定洞察力"
    private String expectedOutcome;  // "可能发现宝藏，但也有危险"
}
```

### 4.2 OptionChain — Prompt 扩展

在现有 prompt 末尾追加要求：

```
5. 每个选项标注风险等级：
   - "safe"：安全推进，稳定小收益
   - "risky"：冒险一试，属性检定，成败影响大
   - "daring"：高风险高回报，必定触发事件
6. 用 attrHint 简要说明属性要求
7. 用 expectedOutcome 描述预期结果
```

约束校验：riskLevel 值合法性校验，非法值默认 "safe"。

### 4.3 ResolutionResult — 统一响应

替代旧 `ActionResult`，合并 choose + spin 的返回。

```java
public class ResolutionResult {
    private String actionType;           // "resolve"
    private Long targetNodeId;           // 导航到的目标节点 ID
    
    // 检定信息
    private String riskLevel;            // safe / risky / daring
    private String checkAttr;            // 关联属性 (risky/daring)
    private int attrValue;               // 属性值
    private int diceRoll;                // d20 结果 (risky)
    private int dc;                      // 难度值 (risky)
    private int modifier;                // 属性修正 (risky)
    private int total;                   // roll + modifier
    private boolean success;             // 是否通过 (risky)
    
    // 结果数据
    private Map<String, Integer> attrChanges;  // {"hp": -8, "attack": 3}
    private boolean isDead;
    
    // 事件数据（触发时才有）
    private String eventTitle;           // 事件标题
    private String eventContent;         // 事件内容
}
```

### 4.4 ActionEngine — 检定公式

```java
public ResolutionResult resolve(String sessionId, Long targetNodeId,
                                 String choiceLabel, String riskLevel) {
    // 1. 加载 session / node / character
    // 2. 导航到目标节点 (更新 session.currentNodeId)
    // 3. 根据 riskLevel 走不同分支
    
    switch (riskLevel) {
        case "safe":
            return resolveSafe(character);
        case "risky":
            return resolveRisky(character, choiceLabel);
        case "daring":
            return resolveDaring(character, session, currentNode);
        default:
            return resolveSafe(character);
    }
}

// safe: 稳定微增
private ResolutionResult resolveSafe(UserCharacter c) {
    Map<String, Integer> changes = new HashMap<>();
    changes.put("hp", 5 + ThreadLocalRandom.current().nextInt(6));  // +5~10
    // 随机微增一个属性 +1
    applyChanges(c, changes);
    return buildResult("safe", changes, false, null, null);
}

// risky: d20 检定
private ResolutionResult resolveRisky(UserCharacter c, String label) {
    String attr = detectAttr(label);  // 从 label 关键词推断关联属性
    int attrValue = getAttrValue(c, attr);
    int modifier = (attrValue - 50) / 10;  // 50→0, 70→+2, 30→-2
    int roll = ThreadLocalRandom.current().nextInt(1, 21);
    int dc = pickDC(attrValue);  // 属性高→DC稍高但修正也高
    int total = roll + modifier;
    boolean success = total >= dc;
    
    // 根据成败决定结果
    Map<String, Integer> changes = success
        ? positiveChanges(attr)   // 正面事件 + 大额收益
        : negativeChanges(attr);  // 负面事件 + 属性损失
    applyChanges(c, changes);
    
    // 失败时可能触发负面事件
    String eventTitle = null, eventContent = null;
    if (!success && roll + modifier < dc - 3) {
        // 严重失败 → 触发事件
        ...
    }
    
    return buildResult("risky", changes, c.getHp() <= 0,
        new CheckResult(attr, attrValue, roll, modifier, dc, total, success),
        eventTitle, eventContent);
}

// daring: 强制事件
private ResolutionResult resolveDaring(UserCharacter c, ...) {
    // 调用 EventChain.generateEvent(..., riskLevel="daring", luck=c.getLuck())
    // 属性影响事件偏向
    Map<String, Object> event = eventChain.generateEvent(...);
    applyEventChanges(c, event);
    return buildResult(...);
}
```

**关联属性检测**：

```java
private String detectAttr(String label) {
    String l = label != null ? label : "";
    if (l.contains("察") || l.contains("读") || l.contains("研") || l.contains("搜")) return "intelligence";
    if (l.contains("说") || l.contains("交") || l.contains("骗") || l.contains("服")) return "charm";
    if (l.contains("战") || l.contains("打") || l.contains("冲") || l.contains("攻")) return "attack";
    if (l.contains("躲") || l.contains("防") || l.contains("守")) return "defense";
    if (l.contains("探") || l.contains("寻") || l.contains("找")) return "intelligence";
    return "luck";
}
```

**DC 选取**：

```java
private int pickDC(int attrValue) {
    if (attrValue >= 80) return 15;  // 高手→高难度高成功率
    if (attrValue >= 60) return 13;
    if (attrValue >= 40) return 12;
    return 10;  // 低属性→低难度但修正也低
}
```

### 4.5 EventChain — 属性偏向

改造 `generateEvent()` 接收 `riskLevel` 和 `attrValue`：

- `riskLevel=risky` + 失败 → 负面事件概率 70%，伤害根据失败程度
- `riskLevel=risky` + 成功 → 正面事件概率 70%，收益根据成功程度
- `riskLevel=daring` → 结果由 luck 值决定偏向

### 4.6 StoryChain — 数据增强

```java
// 方法签名变更
public String generateStory(UserSession session, Node currentNode,
                             UserCharacter character, ResolutionResult resolution)
```

Prompt 中插入：

```
## 实际结果
- 选择了: {choiceLabel}（{riskLevel}）
- {检定信息: 属性, 骰子, 修正, 结果}
- 属性变化: {attrChanges}
- {事件信息: 标题 + 内容}
```

### 4.7 端点变更

| 操作 | 旧端点 | 新端点 |
|------|--------|--------|
| 选择 | `POST /player/action/choose` | `POST /player/action/resolve` |
| 转盘 | `POST /player/action/spin` | 删除 |
| 故事 | `GET /player/story/stream/{sessionId}` | 保留，参数不变 |

---

## 5. 前端设计

### 5.1 ChoicePanel — 风险标签渲染

```typescript
interface ChoiceOption {
  id: number;
  label: string;
  targetNodeId: number;
  riskLevel: 'safe' | 'risky' | 'daring';
  attrHint?: string;
  expectedOutcome?: string;
}
```

**视觉**：

| riskLevel | 标签 | 边框色 | 背景 |
|-----------|------|--------|------|
| safe | `bg-green-100 text-green-700` | `border-green-300` | 正常 |
| risky | `bg-amber-100 text-amber-700` | `border-amber-300` | 轻微高亮 |
| daring | `bg-red-100 text-red-700` | `border-red-300` | 明显高亮 |

预期结果以灰色小字显示在 label 下方。

### 5.2 ResolutionDisplay — 新增组件

**三种模式**：

| riskLevel | 展示内容 | 自动时长 |
|-----------|----------|---------|
| safe | 绿色属性变化数字 + 简要文本 | 1.5s |
| risky | 骰子动画 → 结果表 → 属性变化 → (事件卡片) | 2.5s |
| daring | 轮盘动画 → 事件卡片 → 属性变化 | 3s |

**数值动画**：属性变化数字从旧值滚动到新值，正值绿色(+5)，负值红色(-3)。

**继续按钮**：显示"继续"按钮在底部，同时自动倒计时推进。

### 5.3 WheelOfFortune — 改造

从交互式改为被动动画组件：

```typescript
interface WheelOfFortuneProps {
  riskLevel: 'risky' | 'daring';
  rollResult?: number;     // d20 结果 (risky)
  success?: boolean;
  autoPlay: boolean;       // 自动播放，无需点击
  onComplete?: () => void;
}
```

- risky 模式：指针快速旋转后停在 d20 数值位置，绿色/红色光效表示成败
- daring 模式：6 扇区快速闪过，停在结果扇区
- 不再需要独立弹窗，嵌入 ResolutionDisplay 内部

### 5.4 CharacterPanel — 属性动画

- 属性值变化时显示浮动数字（+5 / -3），1.5s 渐隐
- 属性数字从旧值滚动到新值（使用 requestAnimationFrame 或 css transition）
- 新获得称号时弹出提示（集成到 ResolutionDisplay 或独立 toast）

### 5.5 page-player-story.tsx — 流程调整

**状态变更**：

```typescript
// 移除
const [showWheel, setShowWheel] = useState(false);
const [pendingSpin, setPendingSpin] = useState(false);
const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
const pendingWheelRef = useRef(false);

// 新增
const [resolution, setResolution] = useState<ResolutionResult | null>(null);
const [showResolution, setShowResolution] = useState(false);
```

**事件处理**：

```typescript
const handleResolve = async (option: ChoiceOption) => {
    setActionDisabled(true);
    try {
        const res = await api.post('/player/action/resolve', {
            sessionId,
            targetNodeId: option.targetNodeId,
            choiceLabel: option.label,
            riskLevel: option.riskLevel,
        });
        if (res.data.code === 200) {
            setResolution(res.data.data);
            setShowResolution(true);
            // 自动推进
            const delay = option.riskLevel === 'safe' ? 1500 
                        : option.riskLevel === 'risky' ? 2500 : 3000;
            setTimeout(() => {
                setShowResolution(false);
                if (sessionId) triggerStory(sessionId, res.data.data);
            }, delay);
        }
    } catch { setActionDisabled(false); }
};
```

---

## 6. 文件改动清单

### 后端（8 文件）

| 文件 | 操作 | 说明 |
|------|------|------|
| `dto/OptionVO.java` | 修改 | 新增 riskLevel, attrHint, expectedOutcome |
| `dto/ResolutionResult.java` | **新增** | 统一响应，替代 ActionResult |
| `dto/ChooseActionRequest.java` | **删除** | — |
| `dto/SpinActionRequest.java` | **删除** | — |
| `dto/ActionResult.java` | **删除** | — |
| `service/OptionChain.java` | 修改 | Prompt 扩展 + 校验 |
| `service/ActionEngine.java` | **重写** | resolve() + 检定公式 |
| `service/StoryChain.java` | 修改 | 接收 ResolutionResult |
| `service/EventChain.java` | 修改 | 接收 riskLevel + attrValue |
| `controller/PlayerController.java` | 修改 | 新增 resolve，删除 choose/spin |

### 前端（7 文件）

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/ChoicePanel.tsx` | **重写** | 风险标签 + attrHint |
| `components/ResolutionDisplay.tsx` | **新增** | 检定结果展示 |
| `components/WheelOfFortune.tsx` | **重写** | 自动播放动画组件 |
| `components/CharacterPanel.tsx` | 修改 | 属性变化浮动动画 |
| `hooks/useStory.ts` | 修改 | resolveAction() 替代旧方法 |
| `pages/page-player-story.tsx` | **重写** | 新流程 |
| `types/index.ts` | 修改 | 新增类型 |

### 不涉及改动的

- 数据库表结构
- `EventEngine.java`
- `BranchChain.java`
- `ParseChain.java`
- `SaveLoadModal` / `EndingModal`
- 路由 / App.tsx / app-sidebar
- 登录/注册/Admin 页面

---

## 7. 状态覆盖

| 状态 | 组件 | 表现 |
|------|------|------|
| loading | ChoicePanel | 按钮 disabled + spinner |
| loading | ResolutionDisplay | 骨架屏，骰子灰态 |
| empty | ChoicePanel | "暂无可用选项" 提示 |
| error | ChoicePanel | "选项生成失败，请重试" + 重试按钮 |
| error | ResolutionDisplay | "检定失败" 红色提示 + 返回按钮 |
| success | 全部 | 正常展示 |
| disabled | ChoicePanel | 按钮置灰，确认中... |
| dead | ResolutionDisplay → EndingModal | 死亡弹窗，跳过故事 |

---

## 8. 验收标准

1. safe 选项：无需检定，稳定属性变化，前端显示绿色变化
2. risky 选项：d20 检定，结果受属性影响，前端显示骰子动画+结果表
3. daring 选项：强制触发事件，轮盘动画，事件内容受 luck 影响
4. 属性高 → 检定成功率明显高于属性低
5. 故事文本准确反映检定结果和属性变化
6. `POST /action/resolve` 一次请求返回全部结果，无需额外 spin 调用
7. 旧 choose/spin 端点删除后不影响前端功能
8. 所有组件覆盖 loading / empty / error / success 状态
