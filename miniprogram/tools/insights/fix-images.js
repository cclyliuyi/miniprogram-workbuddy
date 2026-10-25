#!/usr/bin/env node
/**
 * 洞见 · 图片补传工具
 * 对比 manifest 内全部文章引用的图片 fileID 与云存储实际存在性，
 * 缺失的从 dist/images/ 补传。用法：node tools/insights/fix-images.js
 */
const automator = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/miniprogram-automator');
const fs = require('fs');
const path = require('path');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'dist', 'manifest.json'), 'utf8'));
  const jobs = [];
  for (const a of manifest.articles) {
    const artPath = path.join(__dirname, 'dist', 'articles', a.id + '.json');
    if (!fs.existsSync(artPath)) { console.log('⚠ 本地缺', artPath, '跳过'); continue; }
    const art = JSON.parse(fs.readFileSync(artPath, 'utf8'));
    art.blocks.filter(b => b.t === 'image').forEach(b => {
      const name = b.fileID.split('/').pop();
      const local = path.join(__dirname, 'dist', 'images', a.id, name);
      jobs.push({ aid: a.id, name, fileID: b.fileID, local, exists: fs.existsSync(local) });
    });
  }
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  const checkFn = function (fileID) {
    return new Promise(function (resolve) {
      wx.cloud.downloadFile({
        fileID,
        success: function (res) { try { wx.getFileSystemManager().unlinkSync(res.tempFilePath); } catch (e) {} resolve(true); },
        fail: function () { resolve(false); },
      });
    });
  };
  const uploadFn = async function (data, remote) {
    const fsm = wx.getFileSystemManager();
    const filePath = wx.env.USER_DATA_PATH + '/fixup-' + Date.now();
    try {
      fsm.writeFileSync(filePath, data, 'base64');
      const res = await wx.cloud.uploadFile({ cloudPath: remote, filePath });
      return { fileID: res.fileID };
    } catch (e) {
      return { error: (e && e.errMsg) || String(e) };
    } finally { try { fsm.unlinkSync(filePath); } catch (e2) {} }
  };
  let fixed = 0;
  try {
    for (const j of jobs) {
      if (!j.exists) { console.log('✗ 本地也没有，无法补传:', j.aid + '/' + j.name); continue; }
      const online = await mini.evaluate(checkFn, j.fileID);
      if (online) { console.log('✓ 在线:', j.aid + '/' + j.name); continue; }
      let result = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        result = await mini.evaluate(uploadFn, fs.readFileSync(j.local).toString('base64'), 'insights/images/' + j.aid + '/' + j.name);
        if (result && result.fileID) break;
        await new Promise(r => setTimeout(r, 1200));
      }
      if (result && result.fileID) { fixed++; console.log('↑ 已补传:', j.aid + '/' + j.name); }
      else console.log('✗ 补传失败:', j.aid + '/' + j.name);
    }
  } finally { await mini.disconnect(); }
  console.log('\n完成，补传', fixed, '张');
})();
