#!/usr/bin/env node
// 逐一校验两篇文章全部图片对象在云存储的存在性
const automator = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/miniprogram-automator');
const fs = require('fs');

const PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights';

(async () => {
  const fileIds = [];
  for (const aid of ['causal-emergence', 'computing-paradigms-ai']) {
    const d = JSON.parse(fs.readFileSync(`tools/insights/dist/articles/${aid}.json`, 'utf8'));
    d.blocks.filter(b => b.t === 'image').forEach(b => fileIds.push({ aid, name: b.fileID.split('/').pop(), fileID: b.fileID }));
  }
  console.log('共', fileIds.length, '张图待验');
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  const missing = [];
  const checkFn = async function (fileID) {
    return new Promise(function (resolve) {
      wx.cloud.downloadFile({
        fileID: fileID,
        success: function (res) {
          try { wx.getFileSystemManager().unlinkSync(res.tempFilePath); } catch (e) {}
          resolve(true);
        },
        fail: function () { resolve(false); },
      });
    });
  };
  try {
    for (const item of fileIds) {
      try {
        const ok = await mini.evaluate(checkFn, item.fileID);
        if (!ok) {
          missing.push(item);
          console.log('✗ 缺失:', item.aid, '/', item.name);
        } else {
          console.log('✓', item.aid, '/', item.name);
        }
      } catch (e) {
        console.log('？通讯异常，跳过:', item.name, e.message.slice(0, 50));
      }
    }
  } finally { await mini.disconnect(); }
  console.log('\n=== 结论 ===');
  console.log(missing.length ? `缺失 ${missing.length} 张：` + missing.map(m => m.aid + '/' + m.name).join(', ') : '全部图片对象在线');
})();
