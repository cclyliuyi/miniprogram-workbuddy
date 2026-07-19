# 天线与电磁波知识日历 — Apple Design 风格前端优化计划

> 对照 Apple WWDC《Designing Fluid Interfaces》八大原则 + 动画/材质/排版系统，对现有小程序的差距审计与改进路线。
>
> 审计基准：`app.wxss` 设计系统 + calendar / day-detail / tools/index 等核心页面。

---

## 一、现状诊断：你已经做得不错的地方

先肯定基础，避免推倒重来：

| 维度 | 现状 | Apple 评分 |
|------|------|-----------|
| 设计 token 系统 | CSS 变量完整（颜色/字体/阴影/圆角），明暗双模 | ⭐⭐⭐⭐ |
| 颜色风格 | 暖色纸感（赤陶/暖金/鼠尾草绿），有辨识度 | ⭐⭐⭐⭐ |
| 触觉反馈 | `utils/haptic.js` 已在 35+ 页面铺开 | ⭐⭐⭐⭐⭐ |
| 半透明材质 | 日历浮顶栏 `backdrop-filter: blur(20px) saturate(180%)` — 这就是 Apple 材料 | ⭐⭐⭐⭐ |
| 按压反馈 | `.btn.grad:active { transform: scale(.96) }` 全局都有 | ⭐⭐⭐⭐ |
| 骨架屏 | `shimmer` 动画 + 日历占位网格 | ⭐⭐⭐⭐ |
| 进场动画 | `rise` / `pop` 弹性曲线 | ⭐⭐⭐ |

**结论：你的底子是 70 分，不是 30 分。不要重做，要精修。**

---

## 二、差距清单：按 Apple 八原则对照

### 原则 1：目的性 — 8/10
✓ 每个页面职责清晰。
✗ 工具页 32 个入口可能过载，缺乏"今日推荐/常用置顶"。

### 原则 2：主导权 — 6/10
✓ 日历翻卡可前进后退。
✗ 缺少"撤销"反馈（删除收藏、清除打卡没有撤销）。
✗ 月份选择器底部 sheet 点击外部关闭 OK，但切换时没有"我刚才选了什么"的过渡。

### 原则 3：责任 — 7/10
✓ 云存储权限提示清晰。
✗ 没有"清除学习记录"的二次确认（破坏性操作）。

### 原则 4：熟悉感 — 8/10
✓ 日历隐喻、翻卡隐喻都很到位。
✓ tab bar 命名基于内容（日历/前沿/方法论/工具/收藏）。
✗ 3D 模块的"单指旋转/双指缩放"手势提示太弱，首次进入容易迷茫。

### 原则 5：灵活性 — 5/10 ⚠️ 最大扣分项
✗ **没有 `prefers-reduced-motion` 降级**。37 个 WXSS 文件里 0 个有这个 media query。
  - 前庭敏感用户会被 `today-pulse` 无限脉冲、`shimmer` 骨架屏循环恶心到。
✗ **没有 `prefers-reduced-transparency` 降级**。
  - `backdrop-filter` 在低端安卓上会卡，但你的磨砂浮顶栏没有降级到实色背景。
✗ 字号不支持系统辅助放大。

### 原则 6：简洁 — 7/10
✓ 暖色纸感风格统一克制。
✗ `letter-spacing` 部分硬编码（如 `.kicker { letter-spacing: 6rpx }`），大字号下过松。
✗ `.display` 标题 `letter-spacing: 2rpx` 是固定值，违反 Apple"大字号收紧、小字号放松"原则。

### 原则 7：工艺 — 7/10
✓ 圆角/阴影/间距基本一致。
✗ 动画曲线不统一：`cubic-bezier(0.2, 0.8, 0.2, 1)` / `ease-out` / `ease` 混用。
✗ 翻卡动画 `transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)` — 0.7s 偏慢，Apple 标准是 0.3-0.4s。
✗ transition 用 `ease`（线性插值）的地方太多，应该用 spring 或 cubic-bezier。

### 原则 8：愉悦 — 7/10
✓ 进场 `rise` 动画有质感。
✗ 翻卡后的"反面"切换没有弹簧过冲，太"线性"。
✗ 收藏❤️点击没有"心跳放大→回弹"的拟物反馈。

---

## 三、优化路线：五个阶段，由易到难

### 阶段 1：动画系统统一（半天）🎯 最高 ROI

**目标**：把杂乱的缓动曲线统一为 Apple 标准弹簧。

#### 1.1 在 `app.wxss` 新增动画 token

```css
page {
  /* Apple 风格弹簧曲线 token */
  --ease-spring: cubic-bezier(0.2, 0.8, 0.2, 1);       /* 默认 UI：临界阻尼 */
  --ease-spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* 过冲（收藏/翻卡）*/
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);           /* 快速入场 */
  --dur-fast: 180ms;   /* 按压反馈 */
  --dur-base: 300ms;   /* 标准 UI 过渡 */
  --dur-slow: 450ms;   /* 大元素位移 */
}
```

#### 1.2 全局替换规则

| 现状 | 替换为 | 影响范围 |
|------|--------|---------|
| `transition: transform .18s` | `transition: transform var(--dur-fast) var(--ease-spring)` | tools/index, calendar |
| `transition: transform .2s ease` | `transition: transform var(--dur-base) var(--ease-spring)` | calendar cell-card |
| `transition: transform 0.7s cubic-bezier(0.2,0.8,0.2,1)` | `transition: transform var(--dur-base) var(--ease-spring-bounce)` | day-detail 翻卡 |
| `animation: rise 0.55s cubic-bezier(0.2,0.8,0.2,1)` | `animation: rise var(--dur-slow) var(--ease-spring)` | app.wxss 全局 |

**关键收益**：翻卡从 0.7s 缩到 0.3s，感知速度提升一倍。

---

### 阶段 2：无障碍降级（半天）🔒 合规底线

**目标**：补齐 `prefers-reduced-motion` 和 `prefers-reduced-transparency`。

#### 2.1 在 `app.wxss` 底部新增全局降级

```css
/* 减弱动画：前庭敏感用户 */
@media (prefers-reduced-motion: reduce) {
  .rise, .pop { animation: none !important; opacity: 1 !important; }
  .today-dot { animation: none !important; }
  .skeleton { animation: none !important; background: var(--paper-2); }
  .flip-inner { transition: opacity var(--dur-fast) ease !important; transform: none !important; }
  .flip-back { transform: none !important; opacity: 0; }
  .flip-inner.flipped .flip-front { opacity: 0; }
  .flip-inner.flipped .flip-back { opacity: 1; }
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}

/* 减弱透明度：低端机/偏好实色 */
@media (prefers-reduced-transparency: reduce) {
  .float-top { background: var(--paper) !important; backdrop-filter: none !important; }
  .frosted-overlay { backdrop-filter: none !important; }
  .flip-tag, .zoom-btn { backdrop-filter: none !important; background: rgba(32,32,28,.85) !important; }
}
```

**关键收益**：通过微信审核时"无障碍"评分提升，覆盖老年/敏感用户。

---

### 阶段 3：材质与深度精修（1 天）✨ 视觉升级

Apple 的核心招式是"半透明材质传递层次"。你已经在浮顶栏用了，但可以更系统化。

#### 3.1 tabBar 改为毛玻璃（需要 custom tabBar）

当前 tabBar 是实色 `#fbf9f4`，改为半透明 + 内容穿透：

```json
// app.json
"tabBar": { "custom": true, ... }
```

```css
/* custom-tab-bar/index.wxss */
.tab-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: rgba(251, 249, 244, 0.78);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid rgba(32,32,28,0.08);
  padding-bottom: env(safe-area-inset-bottom);
}
```

#### 3.2 工具卡片加"材质层次"

3 层深度系统：
- **底层**：页面 `--paper`（最远）
- **中层**：卡片 `--card` + 微阴影（工作区）
- **顶层**：浮顶栏/tabBar 毛玻璃（chrome）

#### 3.3 日历今日格子：从"脉冲圆点"改为"材质高亮"

当前 `today-pulse` 是 box-shadow 扩散，Apple 风格改为内嵌发光 + 静态强调环：

```css
.cell-card.is-today {
  box-shadow:
    0 0 0 2px var(--sage),
    inset 0 0 0 1px rgba(255,255,255,0.4),
    0 4rpx 16rpx rgba(122,145,129,0.25);
}
/* 移除 today-pulse 无限动画，改为进场一次性 */
.today-dot { animation: today-pulse 0.6s var(--ease-spring) 1; }
```

---

### 阶段 4：交互动效精修（1-2 天）🎬 质感飞跃

#### 4.1 收藏 ❤️ 心跳动画

当前点击收藏只是颜色切换。Apple 风格：

```css
.fav-heart-sm {
  transition: transform var(--dur-fast) var(--ease-spring-bounce);
}
.bar-fav.just-checked .fav-heart-sm {
  animation: heart-beat 0.5s var(--ease-spring-bounce);
}
@keyframes heart-beat {
  0% { transform: scale(1); }
  35% { transform: scale(1.3); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}
```

配合 `haptic.medium()` 触觉，因果同一帧。

#### 4.2 翻卡动画：加入速度传递

当前翻卡是纯 CSS transition，无法接收手势速度。改为：

```javascript
// day-detail.js
onStageTap(e) {
  // 记录触摸到释放的时间，计算速度
  // 传给 CSS variable 让动画带初速度
  this.setData({ flipped: !this.data.flipped });
  haptic.light();
}
```

#### 4.3 月份选择器：橡皮筋边界

当前 12 宫格是静态的。Apple 风格：拖到边界时橡皮筋阻尼。

#### 4.4 日历格子按压：1:1 跟踪 + 释放回弹

当前是 `:active { transform: scale(.96) }`，按下即缩。Apple 标准是：

```css
.cell-card {
  transition: transform 0.01s; /* 按下时几乎瞬时响应 */
}
.cell:active .cell-card {
  transform: scale(0.96);
  transition: transform var(--dur-fast) var(--ease-spring);
}
/* 释放后回弹用 bounce 曲线 */
```

---

### 阶段 5：排版精修（半天）📐 高级感来源

#### 5.1 字距动态化

Apple 原则：**大字号收紧，小字号放松。固定 letter-spacing 是错的。**

```css
.display {
  font-size: 44rpx;
  letter-spacing: -0.5rpx;  /* 大标题收紧 */
}
.kicker {
  font-size: 22rpx;
  letter-spacing: 4rpx;     /* 小标签放松（原 6rpx 过松）*/
}
body { letter-spacing: 0; }  /* 正文归零 */
```

#### 5.2 数字用 tabular-nums（你已经有 `.num` 类，扩展到所有数据展示）

#### 5.3 行高反比规则

```css
.display { line-height: 1.1; }   /* 大标题紧凑 */
.kn-body { line-height: 1.7; }   /* 正文宽松 */
```

---

## 四、实施优先级与工作量

| 阶段 | 内容 | 工作量 | ROI | 依赖 |
|------|------|--------|-----|------|
| **P0** | 阶段 2 无障碍降级 | 半天 | ⭐⭐⭐⭐⭐ 合规+全用户 | 无 |
| **P1** | 阶段 1 动画系统统一 | 半天 | ⭐⭐⭐⭐⭐ 立竿见影 | 无 |
| **P2** | 阶段 5 排版精修 | 半天 | ⭐⭐⭐⭐ 高级感 | 无 |
| **P3** | 阶段 3.3 日历今日格子 | 2 小时 | ⭐⭐⭐ | P1 |
| **P4** | 阶段 4.1 收藏心跳 | 2 小时 | ⭐⭐⭐ | P1 |
| **P5** | 阶段 3.1 custom tabBar 毛玻璃 | 1 天 | ⭐⭐⭐⭐ 视觉飞跃 | 需改 app.json |
| **P6** | 阶段 4.2-4.4 交互动效 | 1-2 天 | ⭐⭐⭐ | P1 |

**总工作量：约 4-5 天可以做到 90 分。**

---

## 五、不建议做的事

1. **不要换配色**。你的暖色纸感（赤陶/暖金/鼠尾草绿）已经很有辨识度，Apple Design 不等于"改成冷色蓝白"。Apple 原则是"材质和动效"，不是"颜色"。

2. **不要全面铺 spring 动画**。Apple 明确说：默认用临界阻尼（无过冲），只在手势携带动量时才加弹跳。如果所有按钮都弹，反而廉价。

3. **不要做 3D Touch / Force Touch**。微信小程序不支持，且 Android 普遍没有压感。

4. **不要加 Haptic Sound**。微信小程序音频延迟大，做不到"视觉+触觉+声音同一帧"，强行加会破坏幻觉。

---

## 六、验收标准

完成后的检查清单：

- [ ] 打开"减弱动效"系统设置，翻卡改为交叉淡入，无脉冲动画
- [ ] 翻卡速度从 0.7s 降到 0.3s，且带轻微过冲
- [ ] 所有按钮按压有 180ms 内的 scale 反馈
- [ ] 收藏点击有心跳放大 + 触觉
- [ ] tabBar 毛玻璃穿透页面内容
- [ ] 大标题字距收紧，小标签字距放松
- [ ] 所有缓动曲线统一为 3 条 token（spring / spring-bounce / out）
- [ ] 日历今日格子无无限脉冲动画
- [ ] 低端安卓上磨砂层降级为实色

---

**下一步**：确认计划后，我从 P0（无障碍降级）+ P1（动画系统统一）开始动手，半天内交付第一批改动。
