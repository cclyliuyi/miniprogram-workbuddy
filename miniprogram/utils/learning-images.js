// 方法论的私有图片由服务端签发；目录与详情共享有效链接和进行中的请求。
let cache = null;
let pending = null;

async function fetchMethodImages(force = false) {
  if (!force && cache && cache.mediaExpiresAt > Date.now() + 60000) return cache.images;
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'getArticle',
      data: { action: 'method-images' },
      success: response => {
        const result = response && response.result;
        const data = result && result.data;
        if (!result || !result.ok || !data || !data.images || typeof data.images !== 'object' ||
            !Number.isFinite(data.mediaExpiresAt) || data.mediaExpiresAt <= Date.now() + 60000) {
          reject(new Error('图片链接暂不可用'));
          return;
        }
        const images = {};
        Object.keys(data.images).forEach(fileID => {
          if (typeof data.images[fileID] === 'string' && /^https:\/\//.test(data.images[fileID])) images[fileID] = data.images[fileID];
        });
        cache = { images, mediaExpiresAt: data.mediaExpiresAt };
        resolve(images);
      },
      fail: reject,
    });
  });
  try { return await pending; }
  finally { pending = null; }
}

module.exports = { fetchMethodImages };
