const { CARDS } = require('./eit-data');
const { createList } = require('../../utils/learning-pages');
Page(createList({ cards: CARDS, key: 'eit', ...{
  "title": "从天线到电磁信息论",
  "intro": "从熟悉的天线与传播出发，逐步理解：场怎样被观测，模式怎样形成，信息又受什么限制。",
  "stages": [
    {
      "title": "口径与观测",
      "description": "先理解天线怎样把空间中的场变成信号。"
    },
    {
      "title": "传播与散射",
      "description": "再看环境怎样改变场的结构与可观测性。"
    },
    {
      "title": "模式与自由度",
      "description": "把复杂场拆成模式，分清数量、强弱与独立性。"
    },
    {
      "title": "从场到信息",
      "description": "加入噪声和资源约束，走向容量与联合设计。"
    }
  ]
} }));
