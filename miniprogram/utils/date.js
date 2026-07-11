// utils/date.js —— 文件名解析、月历网格构建、农历换算

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/* ═══════════ 农历（阴阳历）换算 ═══════════
 * 基于 1900–2100 年压缩年表，返回形如 "腊月初八" 的中文农历日期。
 * 仅用于 UI 展示，精度满足日历场景。
 */

// 每年用 16 进制数表示：前 12 bit = 12 个农历月的大小月(1=大30天,0=小29天)，
// 后 4 bit = 闰月月份(0=无闰月,1-12=该月后闰)
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0,
  0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2,
  0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60,
  0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60,
  0x186e3, 0x092e0, 0x1c8d7, 0x0c950, 0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4,
  0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0,
  0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60,
  0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5,
  0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, 0x095b0,
  0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5,
  0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0,
  0x092d0, 0x0cab5, 0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0,
  0x15176, 0x052b0, 0x0a930, 0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6,
  0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0,
  0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0,
  0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63
];

const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAYS  = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
                     '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
                     '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

/* ═══════════ 24 节气（2027 年精确日期表） ═══════════
 * key: "月-日"，value: 节气名
 * 节气每年日期有 ±1 天漂移，这里用 2027 年的天文数据
 */
const SOLAR_TERMS_2027 = {
  '1-5': '小寒',  '1-20': '大寒',
  '2-4': '立春',  '2-19': '雨水',
  '3-5': '惊蛰',  '3-20': '春分',
  '4-5': '清明',  '4-20': '谷雨',
  '5-5': '立夏',  '5-21': '小满',
  '6-5': '芒种',  '6-21': '夏至',
  '7-7': '小暑',  '7-22': '大暑',
  '8-7': '立秋',  '8-23': '处暑',
  '9-7': '白露',  '9-23': '秋分',
  '10-8': '寒露', '10-23': '霜降',
  '11-7': '立冬', '11-22': '小雪',
  '12-7': '大雪', '12-22': '冬至',
};

/* ═══════════ 传统节日（农历日期） ═══════════
 * key: "农历月-农历日"，value: 节日名
 */
const LUNAR_FESTIVALS = {
  '1-1': '春节',    '1-15': '元宵',
  '5-5': '端午',    '7-7': '七夕',
  '8-15': '中秋',   '9-9': '重阳',
  '12-8': '腊八',
};

function getLunarYearDays(year) {
  let sum = 348; // 基准：12个农历月各29天
  let info = LUNAR_INFO[year - 1900];
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (info & i) ? 1 : 0;
  return sum + getLeapMonthDays(year);
}

function getLeapMonth(year) {
  return LUNAR_INFO[year - 1900] & 0xf;
}

function getLeapMonthDays(year) {
  if (getLeapMonth(year)) {
    return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function getLunarMonthDays(year, month) {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

/**
 * 公历 → 农历
 * @param {number} y 年, m 月(1-12), d 日
 * @returns {{lMonth:number,lDay:number,str:string,shortStr:string,term:string,festival:string}}
 *   str      完整农历 "正月初一"
 *   shortStr 精简显示：初一只显示月名(正月)，其余显示日(初二/十五)
 *   term     节气名（当天有节气时，否则空串）
 *   festival 农历节日名（春节/中秋等，否则空串）
 */
function getLunarDate(y, m, d) {
  // 基准点：1900/01/31 = 农历正月初一
  const BASE_DATE = new Date(1900, 0, 31);
  const target = new Date(y, m - 1, d);
  let offset = Math.floor((target - BASE_DATE) / 86400000);

  let year = 1900, temp = 0;
  for (; year < 2101 && offset > 0; year++) {
    temp = getLunarYearDays(year);
    offset -= temp;
  }
  if (offset < 0) { offset += temp; year--; }

  let leap = getLeapMonth(year), isLeap = false, month = 1;
  for (; month < 13 && offset > 0; month++) {
    if (leap > 0 && month === (leap + 1) && !isLeap) { --month; isLeap = true; temp = getLeapMonthDays(year); }
    else { temp = getLunarMonthDays(year, month); }
    if (isLeap && month === (leap + 1)) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && month === leap + 1) { if (isLeap) isLeap = false; else { isLeap = true; --month; } }
  if (offset < 0) { offset += temp; --month; }

  const day = offset + 1;
  const lMonthStr = LUNAR_MONTHS[month - 1] + '月';
  const lDayStr   = LUNAR_DAYS[day - 1];
  const fullStr   = lMonthStr + lDayStr;

  // 精简显示规则：
  //   初一 → 显示月份名（正月、二月…），让用户知道进入了新农历月
  //   其他 → 只显示日（初二、十五…），不重复月份
  const shortStr = day === 1 ? lMonthStr : lDayStr;

  // 节气
  const termKey = m + '-' + d;
  const term = SOLAR_TERMS_2027[termKey] || '';

  // 农历节日
  const festKey = month + '-' + day;
  const festival = LUNAR_FESTIVALS[festKey] || '';

  return { lMonth: month, lDay: day, str: fullStr, shortStr, term, festival };
}

// 解析 "7月6日正面.png" => { month:7, day:6, side:'front' }
function parseFileName(filename) {
  const m = filename.match(/(\d{1,2})月(\d{1,2})日(正面|反面)/);
  if (!m) return null;
  return {
    month: parseInt(m[1], 10),
    day: parseInt(m[2], 10),
    side: m[3] === '正面' ? 'front' : 'back',
  };
}

// 该月天数（以目标年为准）
function daysInMonth(month) {
  const year = 2027;
  return new Date(year, month, 0).getDate();
}

// 构建某月的日历网格
// photosMap: { [day]: { frontThumb, backThumb, ... } }
// year: 用于农历换算（默认 2027）
function buildMonthGrid(month, photosMap, year) {
  year = year || 2027;
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay(); // 0 = 周日
  const dim = daysInMonth(month);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ empty: true });

  for (let d = 1; d <= dim; d++) {
    const photo = photosMap ? photosMap[d] : null;
    const lunar = getLunarDate(year, month, d);

    // 农历显示优先级：节日 > 节气 > 精简农历
    let lunarDay = lunar.shortStr;
    if (lunar.festival) lunarDay = lunar.festival;
    else if (lunar.term) lunarDay = lunar.term;

    cells.push({
      empty: false,
      day: d,
      hasPhoto: !!photo,
      thumb: photo ? photo.frontThumb : '',
      hasBack: photo ? !!photo.backThumb : false,
      lunarDay: lunarDay,
      isTerm: !!lunar.term,       // 节气标记（前端可高亮）
      isFestival: !!lunar.festival, // 节日标记
    });
  }
  while (cells.length % 7 !== 0) cells.push({ empty: true });

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { weeks, daysInMonth: dim };
}

module.exports = { WEEKDAYS, parseFileName, daysInMonth, buildMonthGrid, getLunarDate };
