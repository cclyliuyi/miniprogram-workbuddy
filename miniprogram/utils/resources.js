// 稳定资源 ID：统一搜索、专题和非日历收藏共用。
const { CARDS } = require('./quotes')
const { SECTIONS } = require('./tool-registry')
let cached
function getResources() {
  if (cached) return cached
  const days = CARDS.map(c => {
    const [, m, d] = c.date.match(/(\d+)月(\d+)日/)
    return { id: `day:${m}-${d}`, type: '知识卡', title: c.topic, desc: c.hook,
      text: [c.body,c.tag,c.trivia,c.monthTheme].join(' '), month: +m, day: +d,
      url: `/pages/day-detail/day-detail?month=${m}&day=${d}` }
  })
  const groups = [['eit','前沿',require('../pages/eit/eit-data').CARDS], ['method','方法论',require('../pages/method/method-data').CARDS]]
  const cards = groups.flatMap(([key,type,list]) => list.map((c,i) => ({
    id: `${key}:${c.id}`, type, title:c.title, desc:c.subtitle, text:JSON.stringify(c),
    url:`/pages/${key}-detail/detail?index=${i}`
  })))
  const tools = SECTIONS.flatMap(s => s.items.map(t => ({ id:`tool:${t.key}`, type:s.name,
    title:t.name, desc:t.desc, text:t.key, url:t.url })))
  cached = days.concat(cards,tools)
  return cached
}
function searchResources(keyword) {
  const normalize = s => String(s || '').toLowerCase().replace(/驻波比|vswr/g,'swr').replace(/史密斯/g,'smith')
  const terms = normalize(keyword).trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return getResources().filter(r => terms.every(t => normalize(r.title+' '+r.desc+' '+r.text+' '+r.type).includes(t)))
}
function findResource(id) { return getResources().find(r => r.id === id) }
module.exports = { getResources, searchResources, findResource }
