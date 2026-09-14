// 云函数 getPhotos —— 服务端查询照片日历数据
// 优势：不受客户端 Collection.limit(20) 限制（服务端 limit 100），
//       且服务端调用云数据库比客户端直连更快更稳，彻底规避冷启动超时。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 输入白名单校验：where() 接受命令对象，直接透传 event 字段会让恶意客户端
// 构造查询条件（如 {month: {$gt: 0}}），因此一律先做整数范围校验再入查询。
function intIn(v, lo, hi) {
  return Number.isInteger(v) && v >= lo && v <= hi
}

exports.main = async (event) => {
  const { action } = event
  try {
    if (action === 'month') {
      if (!intIn(event.month, 1, 12)) return { ok: false, error: 'invalid month' }
      const res = await db.collection('calendar_photos').where({ month: event.month }).limit(100).get()
      return { ok: true, data: res.data }
    }
    if (action === 'day') {
      if (!intIn(event.month, 1, 12) || !intIn(event.day, 1, 31)) return { ok: false, error: 'invalid month/day' }
      const res = await db.collection('calendar_photos').where({ month: event.month, day: event.day }).limit(1).get()
      return { ok: true, data: res.data }
    }
    if (action === 'all') {
      const result = []
      let offset = 0
      while (true) {
        const res = await db.collection('calendar_photos').skip(offset).limit(100).get()
        result.push(...res.data)
        if (res.data.length < 100) break
        offset += 100
      }
      return { ok: true, data: result }
    }
    // 未知 action 明确报错，而不是伪装成空数据成功
    return { ok: false, error: 'unknown action: ' + String(action) }
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) }
  }
}
