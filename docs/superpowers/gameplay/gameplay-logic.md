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
玩家选择选项
  ↓
ActionEngine.choose()
  ├─ 导航到目标节点
  ├─ 微增属性（每次选择+随机1点）
  └─ （无故事生成，等前端触发SSE）
  ↓
前端触发 SSE: GET /player/story/stream/{sessionId}
  ↓
StoryChain.generateStory() ← LLM/STUB
  ├─ 输入：节点信息 + 角色属性 + 历史路径
  ├─ 生成故事段落
  └─ 保存到 session.story_text
  ↓
概率触发转盘（randomRate）
  ↓
玩家点击抽奖
  ↓
ActionEngine.spin()
  ├─ EventChain.generateEvent() ← LLM/STUB
  │   ├─ 随机扇区 → 事件标题+描述
  │   └─ 属性变化（6种属性）
  ├─ 更新角色属性
  └─ 返回事件结果
  ↓
前端触发 SSE: GET /player/story/stream/{sessionId}
  ↓
StoryChain.generateStory() ← LLM/STUB
  ├─ 输入：当前节点 + 角色属性 + 事件结果
  ├─ 生成故事段落（融合事件）
  └─ 保存到 session.story_text
  ↓
到达结局节点（isEnd=true）
  ↓
StoryChain.generateEnding() ← LLM/STUB
  ├─ 输入：完整 story_text + 最终角色属性
  ├─ 生成结局总结
  └─ 保存评分属性
  ↓
弹出结局弹窗
  ├─ 显示完整故事
  └─ 显示最终属性
```

## 三、StoryChain 生成策略

```
普通选择后：
  "你做出选择，{根据当前节点描述和角色属性生成故事段落}"

转盘事件后：
  "{事件标题}！{事件描述}
   属性变化：HP {hpChange}, 攻击 {atkChange}...
   你感到{根据属性变化描述状态}"

结局总结：
  "你的冒险到此结束。
   {回顾 story_text 的核心段落}
   最终，你{根据属性和历史总结结局}"
```
