#!/usr/bin/env node
// 校验线上云存储所有 insights 对象的存在性（管理员视角）
const automator = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/miniprogram-automator');

(async () => {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  try {
    const r = await mini.evaluate(async () => {
      const fsm = wx.getFileSystemManager();
      const dl = fileID => new Promise(resolve => {
        wx.cloud.downloadFile({
          fileID,
          success: res => { try { fsm.unlinkSync(res.tempFilePath); } catch (e) {} resolve(true); },
          fail: () => resolve(false),
        });
      });
      const dlText = async fileID => {
        const res = await new Promise((resolve, reject) =>
          wx.cloud.downloadFile({ fileID, success: resolve, fail: reject }));
        const text = fsm.readFileSync(res.tempFilePath, 'utf8');
        try { fsm.unlinkSync(res.tempFilePath); } catch (e) {}
        return text;
      };
      const PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights';
      const manifest = JSON.parse(await dlText(PREFIX + '/manifest.json'));
      const report = [];
      for (const a of manifest.articles) {
        const ok = await dl(PREFIX + '/articles/' + a.id + '.json');
        report.push({ file: 'articles/' + a.id + '.json', exists: ok });
      }
      for (const a of manifest.articles) {
        const art = JSON.parse(await dlText(PREFIX + '/articles/' + a.id + '.json'));
        for (const b of art.blocks.filter(x => x.t === 'image')) {
          const ok = await dl(b.fileID);
          if (!ok) {
            report.push({ file: '.../' + b.fileID.split('/').slice(-2).join('/'), exists: false, article: a.id });
          }
        }
      }
      return report;
    });
    console.log(JSON.stringify(r, null, 1));
  } finally { await mini.disconnect(); }
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
