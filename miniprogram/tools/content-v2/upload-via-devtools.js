// Use the already logged-in WeChat developer session; no credential export.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const automator = require('C:/Users/Administrator/AppData/Local/Temp/codex-wx-debug/node_modules/miniprogram-automator');
async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'generated-manifest.json'), 'utf8'));
  const out = path.join(__dirname, 'uploaded.json');
  const checkpoint = path.join(require('os').tmpdir(), 'codex-content-v2-uploaded.json');
  const existing = fs.existsSync(checkpoint) ? checkpoint : out;
  const uploaded = fs.existsSync(existing) ? JSON.parse(fs.readFileSync(existing, 'utf8')) : [];
  fs.mkdirSync(path.join(__dirname, 'originals'), {recursive:true});
  fs.mkdirSync(path.join(__dirname, 'webp'), {recursive:true});
  const pending = [];
  for (const item of manifest) {
      const original = path.join(__dirname, 'originals', item.key + '.png');
      if (!fs.existsSync(original)) fs.copyFileSync(item.source, original);
      if (uploaded.some(x => x.key === item.key)) continue;
      const webp = path.join(__dirname, 'webp', item.key + '.webp');
      await sharp(original).webp({quality:88}).toFile(webp);
      pending.push({...item, webp});
  }
  await new Promise(resolve => setTimeout(resolve, 5000));
  const mini = await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
  try {
    await mini.reLaunch('/pages/eit/eit');
    for (const item of pending) {
      const webp = item.webp;
      const cloudPath = `content-v2-20260914/${item.module}/${item.key}.webp`;
      const result = await mini.evaluate(async (key, data, remote) => {
        const filePath = wx.env.USER_DATA_PATH + '/content-v2-' + key + '.webp';
        wx.getFileSystemManager().writeFileSync(filePath, data, 'base64');
        try { return await wx.cloud.uploadFile({cloudPath:remote, filePath}); }
        finally { wx.getFileSystemManager().unlinkSync(filePath); }
      }, item.key, fs.readFileSync(webp).toString('base64'), cloudPath);
      if (!result.fileID) throw new Error('Upload did not return fileID: ' + item.key);
      uploaded.push({key:item.key,module:item.module,fileID:result.fileID,bytes:fs.statSync(webp).size});
      fs.writeFileSync(checkpoint, JSON.stringify(uploaded,null,2));
      console.log(item.key + ' uploaded');
    }
    fs.writeFileSync(out, JSON.stringify(uploaded,null,2));
    console.log('Total uploaded: ' + uploaded.length);
  } finally {mini.disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
