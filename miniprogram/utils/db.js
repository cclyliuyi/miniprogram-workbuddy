// 数据层：24h 持久化缓存、相同请求去重、云请求 8s 后回退直查。
// 网络全部失败时返回可用旧缓存；空结果不缓存。直查每次 10s，不多轮重试。
let _db = null
function db() {
  if (!_db) _db = wx.cloud.database()
  return _db
}

// 提取错误信息（兼容 Error 对象、wx 错误对象、字符串）
function errMsg(e) {
  if (typeof e === 'string') return e
  return (e && (e.errMsg || e.message)) || String(e || '')
}

// 云函数始终优先；单次云失败仅对该次查询回退客户端直查（不永久降级，
// 避免某次冷启动失败后就一直卡在慢速直查上反复 timeout）
const _monthCache = {}
const _dayCache = {}

// ═══════ 持久化缓存（落盘，跨进程/重新预览存活）═══════
const STORE_PREFIX = 'calcache_'
const TTL = 24 * 3600 * 1000 // 24h
function pcGet(k) {
  try {
    const v = wx.getStorageSync(STORE_PREFIX + k)
    return v || null
  } catch (e) {
    return null
  }
}
function pcSet(k, v) {
  try {
    wx.setStorageSync(STORE_PREFIX + k, v)
  } catch (e) { /* 存储满等，忽略 */ }
}
function isFresh(en) {
  return en && en.list && en.list.length && (Date.now() - (en.t || 0)) < TTL
}

// ═══════ 云函数调用 ═══════
function callFn(action, payload) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    let settled = false
    wx.cloud.callFunction({
      name: 'getPhotos',
      data: Object.assign({ action }, payload || {}),
      success: (res) => {
        if (settled) return // withTimeout 已超时，忽略迟到结果
        settled = true
        const dt = Date.now() - t0
        const r = res.result || {}
        if (r.ok) {
          const n = Array.isArray(r.data) ? r.data.length : 0
          console.log(`[db] 云函数 ${action} OK (${dt}ms, ${n}条)`)
          resolve(r.data)
        } else {
          console.error(`[db] 云函数 ${action} 返回业务错误 (${dt}ms):`, r.error)
          reject(new Error(r.error || 'cloud-fn-error'))
        }
      },
      fail: (err) => {
        if (settled) return // withTimeout 已超时，吞掉迟到的 SDK error 避免污染 console
        settled = true
        const dt = Date.now() - t0
        console.error(`[db] 云函数 ${action} 调用失败 (${dt}ms):`, err.errMsg || err)
        reject(err)
      },
    })
  })
}

function callFnWithRetry(action, payload, opts) {
  return withTimeout(callFn(action, payload), (opts && opts.timeout) || 8000)
}

// ═══════ 客户端直查（降级路径，带重试）═══════
function ensureCloud(timeout) {
  timeout = timeout || 10000
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function check() {
      try {
        if (wx.cloud && typeof wx.cloud.database === 'function' && wx.cloud.database()) {
          resolve()
          return
        }
      } catch (e) { /* 云能力未就绪，继续轮询 */ }
      if (Date.now() - start > timeout) {
        reject(new Error('云开发初始化超时：请确认 app.js 已调用 wx.cloud.init 且 env 正确'))
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

// 单次请求硬超时：云 .get() 偶发「挂起」不报错，用 Promise.race 兜住；
// 同时吞掉迟到拒绝，避免变成未处理的 promise rejection。
// 注意：reject 用字符串而非 Error 对象，避免框架全局 error 监听器打印到 console。
function withTimeout(promise, ms = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

// 自动重试：匹配 timeout/network/fail 等偶发错误，重试前重建 db 实例
function withRetry(fn, retries, attempt) {
  retries = retries == null ? 0 : retries
  attempt = attempt || 0
  return fn().catch((err) => {
    const msg = errMsg(err)
    if (retries > 0 && /timeout|network|fail|system|errno/i.test(msg)) {
      const delay = Math.min(500 * Math.pow(2, attempt), 4000)
      console.warn('[db] 直查失败，' + delay + 'ms 后重试(剩' + retries + '):', msg)
      _db = null
      return new Promise((r) => setTimeout(r, delay)).then(() => withRetry(fn, retries - 1, attempt + 1))
    }
    throw err
  })
}

async function directMonth(month) {
  await ensureCloud()
  return withRetry(async () => {
    const list = []
    let offset = 0
    while (true) {
      const res = await withTimeout(
        db().collection('calendar_photos').where({ month }).skip(offset).limit(20).get(),
        10000
      )
      const data = res.data || []
      list.push(...data)
      if (data.length < 20) break
      offset += 20
    }
    list.sort((a, b) => a.day - b.day)
    return list
  })
}

async function directDay(month, day) {
  await ensureCloud()
  return withRetry(() => withTimeout(
    db().collection('calendar_photos').where({ month, day }).limit(1).get(),
    10000
  ))
}

async function directAll() {
  await ensureCloud()
  return withRetry(async () => {
    const result = []
    let offset = 0
    while (true) {
      const res = await withTimeout(
        db().collection('calendar_photos').skip(offset).limit(20).get(),
        10000
      )
      const data = res.data || []
      result.push(...data)
      if (data.length < 20) break
      offset += 20
    }
    return result
  })
}

// ═══════ 对外接口 ═══════

// 月查询：优先会话缓存 → 持久化缓存（秒回+静默刷新）→ 云函数/直查
async function getMonthPhotos(month) {
  if (_monthCache[month]) return { data: _monthCache[month] }

  const cached = pcGet('m' + month)
  if (isFresh(cached)) {
    _monthCache[month] = cached.list
    refreshMonthSilently(month) // 后台静默刷新，不阻塞、不出错
    return { data: cached.list }
  }

  let list
  try {
    list = await callFnWithRetry('month', { month })
  } catch (e) {
    console.warn('[db] 云函数 month 失败，降级直查:', errMsg(e))
    try {
      list = await directMonth(month)
    } catch (e2) {
      console.error('[db] month 直查也失败:', errMsg(e2))
      if (cached && cached.list && cached.list.length) return { data: cached.list, stale: true }
      throw e2
    }
  }
  list.sort((a, b) => a.day - b.day)
  // 空结果不写缓存（会话缓存里空数组是 truthy，会让本会话的每次重试都命中空结果）
  if (list.length) {
    _monthCache[month] = list
    pcSet('m' + month, { list, t: Date.now() })
  }
  return { data: list }
}

// 月数据后台静默刷新（仅更新缓存，不影响当前渲染；失败静默）
function refreshMonthSilently(month) {
  const job = callFnWithRetry('month', { month }).catch(() => null)
  job.then((list) => {
    if (list && list.length) {
      list.sort((a, b) => a.day - b.day)
      _monthCache[month] = list
      pcSet('m' + month, { list, t: Date.now() })
    }
  }).catch(() => {})
}

// 日查询：优先会话缓存 → 持久化日缓存 → 持久化月缓存（秒回）→ 云函数/直查
async function getDayPhoto(month, day) {
  const key = month + '-' + day
  if (_dayCache[key]) return { data: _dayCache[key] }

  const cached = pcGet('d' + key)
  if (isFresh(cached)) {
    _dayCache[key] = cached.list
    return { data: cached.list }
  }

  // 命中持久化月缓存则直接取当天，免一次云查询
  const mc = pcGet('m' + month)
  const monthList = _monthCache[month] || (isFresh(mc) ? mc.list : null)
  if (monthList) {
    const hit = monthList.filter((x) => x.day === day)
    if (hit.length) {
      _dayCache[key] = hit
      pcSet('d' + key, { list: hit, t: Date.now() })
      return { data: hit }
    }
  }

  let data
  try {
    data = await callFnWithRetry('day', { month, day })
  } catch (e) {
    console.warn('[db] 云函数 day 失败，降级直查:', errMsg(e))
    try {
      data = (await directDay(month, day)).data || []
    } catch (e2) {
      console.error('[db] day 直查也失败:', errMsg(e2))
      const fallback = cached && cached.list || mc && mc.list && mc.list.filter(x => x.day === day)
      if (fallback && fallback.length) return { data: fallback, stale: true }
      throw e2
    }
  }
  // 空结果不写缓存，与 getMonthPhotos 同理
  if (data && data.length) {
    _dayCache[key] = data
    pcSet('d' + key, { list: data, t: Date.now() })
  }
  return { data: data || [] }
}

// 全量：优先从 12 个持久化月缓存聚合（秒回）；缺失才打云/直查并回填月缓存
async function getAllPhotos() {
  const months = []
  for (let m = 1; m <= 12; m++) {
    const c = pcGet('m' + m)
    if (isFresh(c)) months.push(c.list)
    else { months.length = 0; break }
  }
  if (months.length === 12) {
    return [].concat.apply([], months)
  }

  let data
  try {
    data = await callFnWithRetry('all')
  } catch (e) {
    console.warn('[db] 云函数 all 失败，降级直查:', errMsg(e))
    try {
      data = await directAll()
    } catch (e2) {
      console.error('[db] all 直查也失败:', errMsg(e2))
      throw e2
    }
  }
  // 回填月缓存（持久化）
  const byMonth = {}
  data.forEach((p) => { (byMonth[p.month] = byMonth[p.month] || []).push(p) })
  Object.keys(byMonth).forEach((m) => {
    byMonth[m].sort((a, b) => a.day - b.day)
    _monthCache[m] = byMonth[m]
    pcSet('m' + m, { list: byMonth[m], t: Date.now() })
  })
  return data
}

// 预热：拉全量按月份填充缓存（缓存命中时为同步、零网络）
let _warming = false
async function warmAll() {
  if (_warming) return
  _warming = true
  try {
    await getAllPhotos()
    console.log('[db] warmAll 完成，月份数:', Object.keys(_monthCache).length)
  } catch (e) {
    console.warn('[db] warmAll 失败（不影响单月查询）:', errMsg(e))
  } finally {
    _warming = false
  }
}

const pending = new Map()
function dedupe(key, work) {
  if (pending.has(key)) return pending.get(key)
  const job = Promise.resolve().then(work).finally(() => pending.delete(key))
  pending.set(key, job)
  return job
}
module.exports = {
  getMonthPhotos: month => dedupe('m'+month, () => getMonthPhotos(month)),
  getDayPhoto: (month, day) => dedupe('d'+month+'-'+day, () => getDayPhoto(month, day)),
  getAllPhotos: () => dedupe('all', getAllPhotos), warmAll,
}
