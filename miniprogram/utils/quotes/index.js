// utils/quotes/index.js —— 按月加载的知识卡片入口
// 365 天数据已拆分为 m01.js ~ m12.js，按需加载减少主包代码量
//
// 用法：
//   const { getMonthCards, getDayCard, CARDS, QUOTES } = require('./quotes');
//   getMonthCards(7)      → 返回 7 月所有卡片
//   getDayCard(month, day) → 返回指定日期的卡片
//   CARDS                  → 全部 365 张（兼容旧代码，按需加载 12 个月合并）
//   QUOTES                 → 全部 legacy 金句（兼容旧代码）

const m01 = require('./m01');
const m02 = require('./m02');
const m03 = require('./m03');
const m04 = require('./m04');
const m05 = require('./m05');
const m06 = require('./m06');
const m07 = require('./m07');
const m08 = require('./m08');
const m09 = require('./m09');
const m10 = require('./m10');
const m11 = require('./m11');
const m12 = require('./m12');

// 按月分组的映射
const MONTH_MAP = {
  1: m01, 2: m02, 3: m03, 4: m04, 5: m05, 6: m06,
  7: m07, 8: m08, 9: m09, 10: m10, 11: m11, 12: m12,
};

// 合并全部（兼容旧接口）
const CARDS = [
  ...m01, ...m02, ...m03, ...m04, ...m05, ...m06,
  ...m07, ...m08, ...m09, ...m10, ...m11, ...m12,
];

const QUOTES = CARDS.map(c => c.legacy);

// 按月获取卡片（高效，只加载单月）
function getMonthCards(month) {
  return MONTH_MAP[month] || [];
}

// 按日期获取单张卡片
function getDayCard(month, day) {
  const cards = MONTH_MAP[month] || [];
  return cards.find(c => {
    const m = c.date.match(/(\d+)月(\d+)日/);
    return m && parseInt(m[2]) === day;
  }) || null;
}

module.exports = { CARDS, QUOTES, getMonthCards, getDayCard };
