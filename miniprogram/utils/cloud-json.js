// utils/cloud-json.js
// 云存储 JSON 读取（洞见模块）——双通道 + 本地文件缓存
//
// 通道策略（2026-10-25 起）：
//   首选云函数 getArticle（服务端身份读云存储，不受客户端存储安全规则约束，
//   读者无需直接读取私有文件）；失败自动降级 wx.cloud.downloadFile（走云私有通道，
//   不受域名白名单约束，适用于管理端/规则为"所有用户可读"的环境）。
//
// 为什么不用 getTempFileURL + wx.request：
//   线上正式版对 wx.request 严格校验「request 合法域名」，tcb.qcloud.la 不在
//   白名单会被静默拦截（2026-10-22 踩坑）。
//
// 性能：云函数/downloadFile 每次调用均有秒级开销，配合页面层「缓存优先渲染 +
// 后台静默刷新 + 列表预取」实现秒开（缓存命中率决定体感）。
const fsm = wx.getFileSystemManager();
const CACHE_DIR = wx.env.USER_DATA_PATH + '/insights-cache';

// 洞见文章 JSON 的云存储前缀（降级通道与列表页预取共用）
const INSIGHTS_ARTICLE_PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights/articles/';
const INSIGHTS_MANIFEST_FILEID = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights/manifest.json';

function downloadCloudJSON(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID,
      success: res => {
        try {
          const text = fsm.readFileSync(res.tempFilePath, 'utf8');
          try { fsm.unlinkSync(res.tempFilePath); } catch (e) { /* 忽略 */ }
          resolve(JSON.parse(text));
        } catch (e) {
          reject(new Error('JSON 解析失败: ' + e.message));
        }
      },
      fail: err => reject(new Error((err && err.errMsg) || 'downloadFile fail')),
    });
  });
}

function callGetArticle(action, payload) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'getArticle',
      data: Object.assign({ action }, payload || {}),
      success: r => {
        const res = r && r.result;
        if (res && res.ok) resolve(res.data);
        else reject(new Error((res && res.error) || '云函数返回异常'));
      },
      fail: err => reject(new Error((err && err.errMsg) || '云函数调用失败')),
    });
  });
}

// 文章 ID 白名单校验（与云函数端一致的双保险）
function safeId(id) {
  return typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id) ? id : null;
}

// 统一入口：读文章 JSON（云函数优先，downloadFile 兜底）
async function fetchArticleJSON(id) {
  const sid = safeId(id);
  if (!sid) throw new Error('非法文章 ID');
  try {
    return await callGetArticle('article', { id: sid });
  } catch (e) {
    return downloadCloudJSON(INSIGHTS_ARTICLE_PREFIX + sid + '.json');
  }
}

// 统一入口：读清单（云函数优先，downloadFile 兜底）
async function fetchManifestJSON() {
  try {
    return await callGetArticle('manifest');
  } catch (e) {
    return downloadCloudJSON(INSIGHTS_MANIFEST_FILEID);
  }
}

// ---- 文章本地缓存（文件级；数据带 builtAt 指纹用于静默更新）----
function writeArticleCache(id, data) {
  try {
    try { fsm.accessSync(CACHE_DIR); } catch (e) { fsm.mkdirSync(CACHE_DIR, true); }
    fsm.writeFileSync(`${CACHE_DIR}/${id}.json`, JSON.stringify({
      builtAt: data.builtAt || '',
      at: Date.now(),
      data,
    }));
  } catch (e) { /* 缓存尽力而为，失败不影响主流程 */ }
}

function readArticleCache(id) {
  try {
    const parsed = JSON.parse(fsm.readFileSync(`${CACHE_DIR}/${id}.json`, 'utf8'));
    const data = parsed && parsed.data;
    // 正文可长期保存，服务端签发的图片链接有有效期；临近失效时重新获取。
    if (data && data.mediaExpiresAt != null && (!Number.isFinite(data.mediaExpiresAt) || data.mediaExpiresAt <= Date.now() + 60000)) return null;
    return data || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  fetchArticleJSON,
  fetchManifestJSON,
  fetchCloudJSON: downloadCloudJSON,
  readArticleCache,
  writeArticleCache,
  INSIGHTS_ARTICLE_PREFIX,
  INSIGHTS_MANIFEST_FILEID,
};
