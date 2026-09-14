const { CARDS } = require('./method-data');
const { createList } = require('../../utils/learning-pages');
Page(createList({ cards: CARDS, key: 'method', ...{
  "title": "把专业方法带到 AI 时代",
  "intro": "建模、信号、测量、控制与优化，都是你已有的能力。从熟悉的专业方法出发，逐步建立可验证的 AI 工作习惯。",
  "stages": [
    {
      "title": "重新认识专业能力",
      "description": "把经验转成清晰的任务、条件与证据。"
    },
    {
      "title": "测量与反馈",
      "description": "用核验和闭环，让协作结果可以检查、可以修正。"
    },
    {
      "title": "约束与实验",
      "description": "明确边界，比较方案，把失败沉淀为方法。"
    },
    {
      "title": "在真实工作中迁移",
      "description": "从一个小任务开始，让专业判断与 AI 协作落地。"
    }
  ]
} }));
