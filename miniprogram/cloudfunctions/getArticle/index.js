// 公开阅读内容网关：洞见文章及方法论已发布配图，服务端读取私有存储。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 与本项目的 AppID / 云存储环境一致；downloadFile 需要完整云文件 ID。
const PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights/'
const MEDIA_SECONDS = 3600
// 方法论当前已发布的 16 张插图；不接受客户端传入任意文件路径。
const METHOD_IMAGES = Array.from({ length: 16 }, (_, index) =>
  PREFIX.replace(/insights\/$/, '') + 'content-v2-20260914/method/m' + String(index + 1).padStart(2, '0') + '.webp')

function safeId(id) {
  return typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id) ? id : null
}

async function readJSON(relative) {
  const res = await cloud.downloadFile({ fileID: PREFIX + relative })
  return JSON.parse(res.fileContent.toString('utf8'))
}

function allowedImage(fileID, id) {
  if (typeof fileID !== 'string') return false
  const base = PREFIX + 'images/' + id + '/'
  return fileID.startsWith(base) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileID.slice(base.length))
}

async function signImages(fileIDs) {
  const ids = [...new Set(fileIDs)]
  const urls = Object.create(null)
  for (let i = 0; i < ids.length; i += 50) {
    const result = await cloud.getTempFileURL({ fileList: ids.slice(i, i + 50).map(fileID => ({ fileID, maxAge: MEDIA_SECONDS })) })
    for (const file of result.fileList || []) {
      if (!file.status && /^https:\/\//.test(file.tempFileURL || '')) urls[file.fileID] = file.tempFileURL
    }
  }
  return urls
}

async function manifestData() {
  const manifest = await readJSON('manifest.json')
  if (!manifest || !Array.isArray(manifest.articles)) throw Error('invalid manifest')
  return manifest
}

exports.main = async (event) => {
  const request = event && typeof event === 'object' ? event : {}
  try {
    if (request.action === 'method-images') {
      const images = await signImages(METHOD_IMAGES)
      return { ok: true, data: { images, mediaExpiresAt: Date.now() + MEDIA_SECONDS * 1000 } }
    }
    if (request.action !== 'manifest' && request.action !== 'article') return { ok: false, error: 'unknown action' }
    if (request.action === 'article' && !safeId(request.id)) return { ok: false, error: 'invalid id' }
    const manifest = await manifestData()
    const entries = manifest.articles.filter(a => a && safeId(a.id))
    if (request.action === 'manifest') {
      const urls = await signImages(entries.filter(a => allowedImage(a.coverFileID, a.id)).map(a => a.coverFileID))
      return { ok: true, data: Object.assign({}, manifest, {
        articles: entries.map(a => Object.assign({}, a, { coverFileID: urls[a.coverFileID] || (/^https:\/\//.test(a.coverFileID || '') ? a.coverFileID : '') })),
        mediaExpiresAt: Date.now() + MEDIA_SECONDS * 1000,
      }) }
    }
    const id = request.id
    if (!entries.some(a => a.id === id)) return { ok: false, error: 'article not published' }
    const article = await readJSON('articles/' + id + '.json')
    if (!article || article.id !== id || !Array.isArray(article.blocks)) throw Error('invalid article')
    const imageIDs = article.blocks.filter(b => b.t === 'image' && allowedImage(b.fileID, id)).map(b => b.fileID)
    if (article.hero && allowedImage(article.hero.cover, id)) imageIDs.push(article.hero.cover)
    const urls = await signImages(imageIDs)
    const blocks = article.blocks.map(b => {
      if (b.t !== 'image') return b
      const copy = Object.assign({}, b)
      delete copy.src
      if (urls[b.fileID]) copy.src = urls[b.fileID]
      else if (/^https:\/\//.test(b.fileID || '')) copy.src = b.fileID
      return copy
    })
    const hero = Object.assign({}, article.hero || {})
    delete hero.coverUrl
    if (urls[hero.cover]) hero.coverUrl = urls[hero.cover]
    else if (/^https:\/\//.test(hero.cover || '')) hero.coverUrl = hero.cover
    return { ok: true, data: Object.assign({}, article, { hero, blocks, mediaExpiresAt: Date.now() + MEDIA_SECONDS * 1000 }) }
  } catch (e) {
    console.error('[getArticle]', e && e.message)
    return { ok: false, error: '文章服务暂时不可用，请稍后重试' }
  }
}
