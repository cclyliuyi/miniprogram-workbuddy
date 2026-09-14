const KEY = 'em_resource_favs_v1'
function getIds() { try { const ids = wx.getStorageSync(KEY); return Array.isArray(ids) ? ids : [] } catch(e) { return [] } }
function toggle(id) {
  const ids = getIds(), index = ids.indexOf(id)
  if(index >= 0) ids.splice(index,1); else ids.unshift(id)
  wx.setStorageSync(KEY,ids)
  return index < 0
}
module.exports = { getIds, toggle }
