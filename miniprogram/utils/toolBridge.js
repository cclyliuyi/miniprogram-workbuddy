// utils/toolBridge.js —— 工具间数据桥
// 跨计算模块传递结果，实现"一键填充到另一个工具"
// 设计：暂存区 + 事件通知（轻量发布订阅）
//
// 典型联动流：
//   1. link 噪声灵敏度 → 算出 sens → 存入 bridge.set('linkSensitivity', -103)
//   2. 用户切到链路预算 Tab → bridge.peek('linkSensitivity') → 自动填入 sensitivity 输入框
//   3. 填入后 bridge.consume('linkSensitivity') 消费掉（一次性）

const _store = {}
const _listeners = {}

const bridge = {
  /**
   * 存入数据（覆盖式）
   * @param {string} key
   * @param {*} value
   * @param {string} [source] 来源页面名，用于调试
   */
  set(key, value, source) {
    _store[key] = { value, ts: Date.now(), source: source || '?' }
    // 通知监听者
    if (_listeners[key]) {
      _listeners[key].forEach(fn => {
        try { fn(value) } catch (e) { console.warn('[toolBridge] listener error', e) }
      })
    }
  },

  /**
   * 查看但不消费
   * @returns {*} value 或 undefined
   */
  peek(key) {
    const item = _store[key]
    if (!item) return undefined
    // 30 秒后过期（防止陈旧数据误填）
    if (Date.now() - item.ts > 30000) {
      delete _store[key]
      return undefined
    }
    return item.value
  },

  /**
   * 查看并消费（取出后删除）
   */
  consume(key) {
    const v = this.peek(key)
    delete _store[key]
    return v
  },

  /**
   * 检查是否有暂存数据
   */
  has(key) {
    return this.peek(key) !== undefined
  },

  /**
   * 订阅某个 key 的变化
   */
  on(key, fn) {
    if (!_listeners[key]) _listeners[key] = []
    _listeners[key].push(fn)
  },

  /**
   * 清空所有暂存
   */
  clear() {
    Object.keys(_store).forEach(k => delete _store[k])
  },

  /**
   * 获取所有暂存键（调试用）
   */
  keys() {
    return Object.keys(_store)
  },
}

// ══════ 标准联动 key ══════
// 统一命名，避免各页面各写各的
const KEYS = {
  // link 噪声灵敏度 → link 链路预算 Pmin
  LINK_SENSITIVITY: 'linkSensitivity',
  // calc 频率 → array 偶极子尺寸
  CALC_FREQ: 'calcFreq',
  // array 方向性 D → link Gt
  ARRAY_GAIN: 'arrayGain',
  // calc VSWR → link 系统损耗
  CALC_VSWR_LOSS: 'calcVswrLoss',
}

module.exports = { bridge, KEYS }
