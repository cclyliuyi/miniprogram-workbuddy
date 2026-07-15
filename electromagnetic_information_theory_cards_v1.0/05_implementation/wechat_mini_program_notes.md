# 微信小程序接入建议

## 1. 资源使用优先级

1. `04_data/cards.json`：卡片文字与结构化数据的唯一事实源。
2. `02_images/final_candidates/`：当前可用于UI联调的独立图片。
3. `02_images/reference_crops_01-12/`：合图裁切参考，用于核对原始构图。
4. `03_prompts/dalle3_prompts_01-12.md`：后续重绘和风格统一。

## 2. 推荐呈现方式

不要把全部知识文字永久烘焙进图片。建议：
- 图片层：主科学视觉、少量稳定英文符号、几何结构；
- 前端层：中文标题、副标题、结论、公式、标签；
- 展开层：课程桥梁、前沿概念、误区、参考文献和互动实验。

这样可以避免AI生成中文乱码，也方便修订、无障碍阅读和多端适配。

## 3. 建议的数据字段

```ts
interface EITCard {
  id: string;
  title: string;
  subtitle: string;
  core_question: string;
  known_concept: string;
  frontier_concept: string;
  key_formula: string;
  one_sentence: string;
  misconception: string;
  tags: string[];
  status: "final_candidate" | "needs_redraw";
  image: string;
}
```

## 4. 图片适配

- 卡片展示容器建议使用 `aspect-ratio: 9 / 16`。
- 当前独立图存在 9:16 与近似竖版两种尺寸，使用 `object-fit: contain`，不要强制拉伸。
- 若需要全屏统一，建议在设计工具中增加同色背景边距，而不是裁掉公式和底部信息。
- 缩略图使用WebP，原始PNG保留作为高清查看和再编辑资产。

## 5. 上线前必须处理

- 第07、09、10张目前是合图裁切占位稿，需要单独高清重绘。
- 所有图片中文字、公式、坐标、设备图标进行逐项校对。
- 第08张的 `Δx ≤ λ/2` 必须标注适用假设，避免被理解为所有场景的普适定理。
- 第11张避免写“无限容量”或“突破物理极限”，应表述为“逼近给定物理约束下的极限”。
- 公式在前端使用KaTeX或图片化SVG统一渲染，不直接依赖生成图中的公式。
