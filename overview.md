# 改进实施总览

## 完成状态：全部 15 项已实施

### P0 — 立即可做（3/3 完成）

| # | 改进项 | 状态 | 涉及文件 |
|---|--------|------|----------|
| 1 | 触觉反馈 | 完成 | utils/haptic.js (新建), day-detail.js, calendar.js, card.js, story.js |
| 2 | 今天高亮+回到今天 | 完成 | calendar.wxml/wxss/js |
| 3 | 搜索/跳转任意天 | 完成 | pages/search/ (新建4文件), calendar.wxml/wxss/js, app.json |

### P1 — 值得做（5/5 完成）

| # | 改进项 | 状态 | 涉及文件 |
|---|--------|------|----------|
| 4 | 打卡里程碑 | 完成 | utils/progress.js, day-detail.wxml/wxss/js |
| 5 | 重要程度标记 | 完成 | day-detail.wxml/wxss |
| 6 | 日签卡增强 | 完成 | card.js |
| 7 | 故事流进度条 | 完成 | story.wxml/wxss (+ 技术债修复 btn.accent→btn.grad) |
| 8 | 年视图长按预览 | 完成 | year.wxml/wxss/js |

### P2 — 技术债清理（完成）

| 改进项 | 状态 | 涉及文件 |
|--------|------|----------|
| 收藏页骨架屏 | 完成 | favs.wxml/wxss |
| 分享标题优化 | 完成 | day-detail.js, story.js, card.js |

### 语法检查
全部 8 个 JS 文件 + 2 个 JSON 文件通过 Node.js 语法验证。

### 后续建议（未实施，待定）
- tabBar 图标缺失（需准备 iconPath/selectedIconPath 图片）
- 术语表页（365 条知识索引）
- 农历节气/节日完整显示
- 暗色模式全页面硬编码颜色审查
- 无障碍/大字模式适配
- 首次使用引导页
