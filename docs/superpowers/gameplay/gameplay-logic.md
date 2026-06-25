# 核心玩法逻辑梳理

## 一、转盘扇区与属性变化

| 扇区 | 属性变化 | 说明 |
|------|---------|------|
| ✨ 奇遇 | 智力+1~3，运气+1~3 | 发现秘籍/感悟 |
| 💎 宝箱 | 攻击+1~3，防御+1~3 | 获得装备/资源 |
| ⚔️ 战斗 | HP-10~20，攻击+1~2 | 战斗受伤但成长 |
| 💀 诅咒 | HP-5~15，智力-1~3，运气-1~3 | 负面效果 |
| 🌀 命运 | 运气+2~5，智力+1 | 命运转折 |
| 💕 邂逅 | 魅力+1~3，HP+5~15 | 遇到贵人/治愈 |

## 二、完整流程

```
到达节点
  ↓
OptionChain.generateOptions() ← LLM
  ├─ 输入：当前节点 + 连接列表 + 对话历史 + 角色属性
  ├─ 输出：3-4 个选项，各指向不同连接节点
  └─ 返回前端渲染
  ↓
玩家选择选项
  ↓
ActionEngine.choose()
  ├─ 导航到目标节点
  ├─ 微增属性（每次选择+随机1点）
  └─ （无故事生成，等前端触发SSE）
  ↓
前端触发 SSE: GET /player/story/stream/{sessionId}
  ↓
StoryChain.generateStory() ← LLM
  ├─ 输入：全量对话历史（system + user + assistant）
  ├─ 续写故事段落
  └─ 追加到 Redis 对话历史
  ↓
概率触发转盘（randomRate）
  ↓
转盘弹窗 → 点击抽奖
  ↓
ActionEngine.spin()
  ├─ EventChain.generateEvent() ← LLM
  │   ├─ 随机扇区 → 事件标题+描述
  │   └─ 属性变化（6种属性）
  ├─ 事件内容缓存到 Redis
  └─ 返回事件结果
  ↓
前端触发 SSE: GET /player/story/stream/{sessionId}
  │（后端从 Redis 读取事件内容）
  ↓
StoryChain.generateStory() ← LLM
  ├─ 全量对话历史 + 事件内容
  ├─ 续写故事（融合事件）
  └─ 追加到 Redis 对话历史
  ↓
到达结局节点（isEnd=true）
  ↓
StoryChain.generateEnding() ← LLM
  ├─ 全量对话历史 + 最终角色属性
  ├─ 生成结局总结
  └─ 保存评分属性
  ↓
弹出结局弹窗
  ├─ 显示完整故事
  └─ 显示最终属性
```

## 三、关键数据流

### 对话历史（Redis）

```
cache:session:{id}:chat_history = [
  {"role": "system", "content": "作品：《三体》\n世界观：...\n当前场景：红岸基地\n角色状态：..."},
  {"role": "user", "content": "选择「探索密道」"},
  {"role": "assistant", "content": "你沿着密道前行..."},
  {"role": "user", "content": "无声的守望！你在红岸基地遇到了..."},
  {"role": "assistant", "content": "你跟着老人走进值班室..."}
]
```

每次生成时，将完整历史发给 LLM，LLM 基于全部上下文续写。

### 选项生成约束

```
OptionChain 输入：
  - 当前节点 ID + 标题 + 描述
  - 可用连接列表：[{targetId, targetTitle, targetDesc}]
  - 对话历史（最近 N 条）
  - 角色属性
  - 世界观

OptionChain 输出：
  - [{label: "选项文案", targetNodeId: 目标节点ID}, ...]

约束：
  - 每个 targetNodeId 必须在可用连接列表中
  - 不同选项应指向不同节点
  - 数量 3-4 个
```
