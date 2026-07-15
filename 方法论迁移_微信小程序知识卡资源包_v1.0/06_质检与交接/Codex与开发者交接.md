# 给 Codex / 小程序开发者的交接说明

## 首要任务
1. 读取 `cards_full.json`，生成方法论迁移模块的数据层。
2. 将正式图片复制到 `/assets/methodology/`。
3. 先上线 01—05，06—12 可显示“视觉图生成中”，但文案可完整浏览。
4. 使用 `单卡Prompt` 重新生成 06—12 的视觉底图。
5. 不要直接把生成图中的小字作为正式内容；准确中文由 WXML/CSS 或 Canvas 叠加。

## 推荐组件
- `method-card`：列表缩略卡。
- `method-detail`：完整知识卡。
- `transfer-map`：电磁概念与 Agent 概念的映射组件。
- `keyword-chip`：关键词。
- `philosophy-quote`：底部哲思句。
- `image-zoom`：高清图查看。

## 数据与图片分离
图片负责“吸引与理解”，JSON 负责“准确与检索”。  
这样可以后续修改文案而不必重新生成整张图片，也有利于无障碍访问、搜索和知识图谱关联。
