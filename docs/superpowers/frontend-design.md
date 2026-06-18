# Novel Simulator — 前端设计规范

> 基于 shadcn/ui + Tailwind CSS v4，参考 Impeccable、Taste Skill、GSAP 设计原则
> 最后更新: 2026-06-18

---

## 1. 设计基调

| 维度 | 值 | 说明 |
|------|-----|------|
| Register | Product | 管理后台 + 玩家界面，设计服务于功能 |
| DESIGN_VARIANCE | 5 | 规整对称，适当的视觉节奏 |
| MOTION_INTENSITY | 3 | 克制动效，仅用于状态反馈 |
| VISUAL_DENSITY | 4 | 标准应用密度，呼吸感适中 |

---

## 2. 色彩体系

基于 OKLCH 色域，Restrained 策略：一个品牌色 + 一个强调色，其余为中性色。

### 2.1 色板

```css
/* 品牌主色：深紫罗兰（沉浸、创意、叙事感） */
--color-primary: oklch(0.45 0.18 290);
--color-primary-foreground: oklch(0.97 0.01 290);

/* 强调色：暖琥珀（高亮、CTA、重要标记） */
--color-accent: oklch(0.75 0.12 75);
--color-accent-foreground: oklch(0.15 0.02 75);

/* 表面层级 */
--color-background: oklch(0.98 0.005 290);     /* 暖白底 */
--color-foreground: oklch(0.15 0.02 290);      /* 深色文字 */
--color-card: oklch(1 0 0);                     /* 卡片纯白 */
--color-card-foreground: oklch(0.2 0.02 290);
--color-popover: oklch(1 0 0);
--color-popover-foreground: oklch(0.15 0.02 290);

/* 中性层 */
--color-muted: oklch(0.94 0.008 290);
--color-muted-foreground: oklch(0.55 0.02 290);
--color-secondary: oklch(0.94 0.008 290);
--color-secondary-foreground: oklch(0.25 0.02 290);

/* 边框与输入 */
--color-border: oklch(0.88 0.01 290);
--color-input: oklch(0.88 0.01 290);
--color-ring: oklch(0.45 0.18 290);            /* focus ring = primary */

/* 语义色 */
--color-destructive: oklch(0.58 0.18 25);
--color-destructive-foreground: oklch(0.97 0.01 25);
--color-success: oklch(0.65 0.15 145);
--color-warning: oklch(0.75 0.12 75);
--color-info: oklch(0.6 0.1 230);
```

### 2.2 暗色模式

```css
@media (prefers-color-scheme: dark) {
  --color-background: oklch(0.15 0.015 290);
  --color-foreground: oklch(0.92 0.01 290);
  --color-card: oklch(0.18 0.015 290);
  --color-popover: oklch(0.18 0.015 290);
  --color-muted: oklch(0.22 0.015 290);
  --color-muted-foreground: oklch(0.65 0.02 290);
  --color-secondary: oklch(0.22 0.015 290);
  --color-border: oklch(0.28 0.015 290);
  --color-input: oklch(0.28 0.015 290);
}
```

### 2.3 使用规范

| 用途 | Token | 说明 |
|------|-------|------|
| 页面背景 | `bg-background` | 所有页面的基础背景 |
| 卡片/面板 | `bg-card` | 有明确边界的容器 |
| 主按钮 | `bg-primary text-primary-foreground` | 核心 CTA |
| 次要按钮 | `bg-secondary` | 非主要操作 |
| 强调/高亮 | `bg-accent text-accent-foreground` | 徽标、状态标签 |
| 危险操作 | `bg-destructive` | 删除/退出等 |
| 成功 | `text-success` | 正向反馈 |
| 输入框 | `border-input` | 表单控件 |

---

## 3. 字体排版

### 3.1 字体栈

```css
/* 标题与正文（单字重家族，产品 UI 不需要展示/正文配对） */
--font-sans: 'Inter', 'SF Pro Text', system-ui, sans-serif;

/* 等宽 */
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
```

### 3.2 字号层级

| Token | 大小 | 行高 | 用途 |
|-------|------|------|------|
| `text-xs` | 0.75rem | 1rem | 辅助文字、徽标 |
| `text-sm` | 0.875rem | 1.25rem | 正文、标签 |
| `text-base` | 1rem | 1.5rem | 默认正文 |
| `text-lg` | 1.125rem | 1.5rem | 强调正文 |
| `text-xl` | 1.25rem | 1.5rem | 次级标题 |
| `text-2xl` | 1.5rem | 1.75rem | 页面标题 |
| `text-3xl` | 1.875rem | 2rem | 大标题 |

### 3.3 规范

- 行宽限制：正文 `max-w-[65ch]`
- 标题使用 `font-semibold` 或 `font-bold`，避免 `font-black`
- 按钮文字使用 `text-sm font-medium`
- 表格 / 数据使用 `text-sm`
- 不使用展示/艺术字体（Product register）

---

## 4. 间距与布局

### 4.1 间距层级

| Token | 值 | 用途 |
|-------|-----|------|
| `gap-1` | 0.25rem | 内联元素间距 |
| `gap-2` | 0.5rem | 表单字段分组 |
| `gap-3` | 0.75rem | 卡片内间距 |
| `gap-4` | 1rem | 卡片间距 |
| `gap-6` | 1.5rem | 区块间距 |
| `p-4` | 1rem | 卡片内边距 |
| `p-6` | 1.5rem | 区块内边距 |
| `py-8` | 2rem | 页面纵向间距 |
| `py-12` | 3rem | 大区块间距 |

### 4.2 布局规则

- Flexbox 用于一维布局，Grid 用于二维布局
- 卡片容器 `rounded-xl`（12px）
- 按钮 `rounded-lg`（8px）
- 输入框 `rounded-lg`（8px）
- 页面最大宽度：`max-w-7xl mx-auto`
- 移动端：单列 `w-full px-4`

### 4.3 z-index 层级

```
dropdown → 50
sticky   → 100
nav      → 50
backdrop → 40
modal    → 50
toast    → 60
tooltip  → 70
```

---

## 5. 组件规范

### 5.1 shadcn/ui 组件

以 shadcn/ui 为基础组件库，按需添加。所有组件遵循以下自定义：

| 组件 | 自定义 |
|------|--------|
| Button | `rounded-lg`，hover 有轻微上移 `-translate-y-[1px]` |
| Input | `rounded-lg`，focus ring 使用 primary |
| Card | `rounded-xl`，默认无阴影，仅在 elevation 需要时加 |
| Badge | `rounded-full`，使用 secondary 变体 |
| Avatar | `rounded-full`，fallback 使用 muted 背景 |

### 5.2 交互规范

- Hover：`opacity-80` 或 `-translate-y-[1px]`（按钮）
- Active：`scale-[0.98]` 物理按压感
- Focus：`ring-2 ring-ring ring-offset-2`
- Disabled：`opacity-50 cursor-not-allowed`
- Loading：Skeleton shimmer 优先，避免居中 spinner

### 5.3 动效规范（GSAP）

动效仅用于状态反馈和微交互，不用于装饰：

| 场景 | 动效 | 时长 |
|------|------|------|
| 页面切换 | `opacity 0.15s ease-out` | 150ms |
| 弹窗出现 | `scale 0.2s ease-out` | 200ms |
| 表单错误 | `shake` 动画 | 300ms |
| Toast 出现 | `slide-in-right` | 250ms |
| Hover 提示 | `opacity 0.15s` | 150ms |

```typescript
// GSAP 使用规范
import { gsap } from "gsap";

// 入口动画：只在登录/注册页使用，其他页面不需要
gsap.fromTo(".auth-card",
  { opacity: 0, y: 20 },
  { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
);
```

---

## 6. 响应式

### 6.1 断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| `sm` | 640px | 手机横屏 |
| `md` | 768px | 平板 |
| `lg` | 1024px | 桌面 |
| `xl` | 1280px | 宽屏 |

### 6.2 规则

- 移动端：单列，`px-4`
- 平板：2 列网格
- 桌面：3-4 列网格 / 双面板
- 管理后台：PC 优先，移动端提供基础可用性
- 玩家界面：Mobile-First 沉浸式布局

---

## 7. 黑暗模式

- 使用 `prefers-color-scheme` 自动切换
- 所有界面在两种模式下都需测试
- 不使用纯黑 `#000` 和纯白 `#fff`
- 暗色模式保持品牌色识别性

---

## 8. 反模式（禁止）

来自 Impeccable 和 Taste Skill 的硬性禁止：

| 反模式 | 替代方案 |
|--------|---------|
| 紫色/蓝色渐变默认 | 单一品牌色 |
| `border-left` 侧边条纹 | 使用全边框或背景色 |
| 渐变文字 | 单色文字，用粗细强调 |
| 玻璃拟态作为默认 | 仅在有明确层次需要时使用 |
| 三段等宽功能卡片 | 不对称网格或滚动布局 |
| 过度圆角（> 16px） | 卡片 12px，按钮 8px |
| 黑白纯色 | 使用 off-black / off-white |
| 装饰动效 | 仅保留状态反馈动效 |
| 展示字体用于 UI 标签 | 同族无衬线字体 |
