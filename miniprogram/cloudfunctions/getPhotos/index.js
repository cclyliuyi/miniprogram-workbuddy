// 云函数 getPhotos —— 服务端查询照片日历数据
// 优势：不受客户端 Collection.limit(20) 限制（服务端 limit 100），
//       且服务端调用云数据库比客户端直连更快更稳，彻底规避冷启动超时。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { action } = event
  try {
    if (action === 'month') {
      const month = event.month
      const res = await db.collection('calendar_photos').where({ month }).limit(100).get()
      return { ok: true, data: res.data }
    }
    if (action === 'day') {
      const { month, day } = event
      const res = await db.collection('calendar_photos').where({ month, day }).limit(1).get()
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
    return { ok: true, data: [] }
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) }
  }
}
