# P3-D 移动端适配实施计划

**Goal:** 故事页响应式适配，小屏沉浸式阅读

---

### Task 1: Story page mobile layout

**File:** `frontend/src/pages/page-player-story.tsx`

Changes:
1. **CharacterPanel** — 包一层条件渲染：`<div className="hidden lg:block"><CharacterPanel ... /></div>`
2. **Add mobile FAB** — 右下角浮动按钮打开角色面板（sheet 形式）

```typescript
// 添加 state
const [showMobileChar, setShowMobileChar] = useState(false);

// 在 JSX 中，lg 以下隐藏 character panel 处改为：
<div className="hidden lg:block space-y-3">
  <CharacterPanel character={character} loading={loading} />
</div>

// 在 return 内、Wheel 之前添加移动端浮动按钮：
{/* 移动端角色面板触发按钮 */}
<button
  type="button"
  onClick={() => setShowMobileChar(true)}
  className="fixed bottom-4 right-4 z-40 size-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center lg:hidden"
>
  <span className="text-lg">📊</span>
</button>

{/* 移动端角色面板 Drawer */}
{showMobileChar && (
  <div className="fixed inset-0 z-50 flex items-end lg:hidden" onClick={() => setShowMobileChar(false)}>
    <div className="absolute inset-0 bg-black/40" />
    <div className="relative w-full bg-background rounded-t-xl p-4 animate-in slide-in-from-bottom duration-200" onClick={e => e.stopPropagation()}>
      <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
      <CharacterPanel character={character} loading={loading} />
      <button
        type="button"
        onClick={() => setShowMobileChar(false)}
        className="w-full mt-3 text-sm text-muted-foreground py-2"
      >
        关闭
      </button>
    </div>
  </div>
)}
```

3. **Top bar** — 小屏更紧凑：
```typescript
// 外面的 container 改为：
<div className="max-w-3xl mx-auto px-2 sm:px-4">

// Top bar 按钮 text 在小屏用 sr-only：
<Button variant="ghost" size="sm" onClick={() => navigate('/player')}>
  <ArrowLeftIcon className="size-4" />
  <span className="hidden sm:inline ml-1">返回</span>
</Button>
```

4. **Story container** — 移除多余 padding：
```typescript
// grid container 改为：
<div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_220px]">
```

Type check and commit.

---

### Task 2: Verify build

```bash
cd D:/project/novel-simulator/frontend
npx tsc --noEmit
npm run build 2>&1 | tail -5
```
