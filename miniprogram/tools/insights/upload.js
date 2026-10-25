#!/usr/bin/env node
/**
 * 洞见 · 云存储上传脚本（通过微信开发者工具自动化）
 * 前置：开发者工具已打开本项目并开启自动化端口（cli auto --auto-port 9420）
 * 用法：node tools/insights/upload.js <articleId>
 * 原理：把 dist 产物 base64 写入小程序临时文件 → wx.cloud.uploadFile 传云存储
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const automator = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/miniprogram-automator');

const articleId = process.argv[2];
if (!articleId || !/^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5_-]{0,79}$/.test(articleId)) {
  console.error('用法: node tools/insights/upload.js <articleId>');
  process.exit(1);
}
const DIST = path.join(__dirname, 'dist');
const artJsonPath = path.join(DIST, 'articles', `${articleId}.json`);
const imgDir = path.join(DIST, 'images', articleId);
const manifestPath = path.join(DIST, 'manifest.json');
if (!fs.existsSync(artJsonPath)) { console.error('缺少 ' + artJsonPath); process.exit(1); }

// 重组上传清单：图片 → 文章 JSON → manifest
const jobs = [];
fs.readdirSync(imgDir).forEach(name => {
  jobs.push({ local: path.join(imgDir, name), remote: `insights/images/${articleId}/${name}`, label: `img/${name}` });
});
jobs.push({ local: artJsonPath, remote: `insights/articles/${articleId}.json`, label: 'article.json' });
jobs.push({ local: manifestPath, remote: `insights/manifest.json`, label: 'manifest.json' });

const checkpoint = path.join(__dirname, '.upload-checkpoint.json');
const done = fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : {};
jobs.forEach(j => { j.hash = crypto.createHash('sha256').update(fs.readFileSync(j.local)).digest('hex'); });
// 清单每次最后提交；旧版本的路径检查点不能证明文件内容相同。
const pending = jobs.filter(j => j.remote === 'insights/manifest.json' || !done[j.remote] || done[j.remote].hash !== j.hash);
console.log(`待上传 ${pending.length}/${jobs.length} 个文件`);

async function main() {
  const mini = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  try {
    for (const job of pending) {
      const b64 = fs.readFileSync(job.local).toString('base64');
      let result = null;
      // 3 次重试：临时文件写入与云上传偶发竞态（stat undefined），重试即过
      for (let attempt = 1; attempt <= 3; attempt++) {
        result = await mini.evaluate(async (data, remote) => {
          const fs2 = wx.getFileSystemManager();
          const filePath = `${wx.env.USER_DATA_PATH}/up-tmp-${Date.now()}`;
          try {
            fs2.writeFileSync(filePath, data, 'base64');
            const stat = fs2.statSync(filePath);
            if (!stat || !stat.size) return { error: 'tmp file empty' };
            const res = await wx.cloud.uploadFile({ cloudPath: remote, filePath });
            return { fileID: res.fileID };
          } catch (e) {
            return { error: (e && e.errMsg) || (e && e.message) || String(e) };
          } finally {
            try { fs2.unlinkSync(filePath); } catch (e2) {}
          }
        }, b64, job.remote);
        if (result && result.fileID) break;
        console.log(`  ↻ 第${attempt}次失败(${result && result.error})，重试…`);
        await new Promise(r => setTimeout(r, 1200));
      }
      if (result && result.fileID) {
        done[job.remote] = { fileID: result.fileID, hash: job.hash };
        fs.writeFileSync(checkpoint, JSON.stringify(done, null, 2));
        console.log(`✓ ${job.label} → ${job.remote}`);
      } else {
        throw new Error(`${job.label} 上传失败: ${JSON.stringify(result)}`);
      }
    }
    console.log(`\n全部完成，共 ${Object.keys(done).length} 个文件在线。`);
    console.log('小程序内打开「洞见」tab 下拉刷新即可看到《' + articleId + '》');
  } finally {
    await mini.disconnect();
  }
}
main().catch(e => { console.error('失败:', e.message); process.exitCode = 1; });
