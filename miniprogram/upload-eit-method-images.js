// upload-eit-method-images.js
// 使用方法：
// 1. 在微信开发者工具的编辑器中打开此文件
// 2. 全选复制，粘贴到「调试器 Console」中，回车执行
// 3. 等待上传完成，会打印出所有 fileID
// 4. 将打印的 fileID 数组复制，替换 eit-data.js 和 method-data.js 中的 image 字段

const ENV_ID = 'cloud1-d3gsxamaw26beccb8';

// EIT 图片（本地路径）
const eitImages = Array.from({length: 12}, (_, i) => ({
  localPath: `/pages/eit/images/eit_${String(i+1).padStart(2,'0')}.webp`,
  cloudPath: `eit/eit_${String(i+1).padStart(2,'0')}.webp`,
  module: 'eit',
  id: i + 1,
}));

const methodImages = Array.from({length: 12}, (_, i) => ({
  localPath: `/pages/method/images/m_${String(i+1).padStart(2,'0')}.webp`,
  cloudPath: `method/m_${String(i+1).padStart(2,'0')}.webp`,
  module: 'method',
  id: i + 1,
}));

async function uploadAll() {
  const all = [...eitImages, ...methodImages];
  const results = [];
  
  for (const img of all) {
    try {
      console.log(`上传中: ${img.cloudPath} ...`);
      const res = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath: img.cloudPath,
          filePath: img.localPath,
          success: resolve,
          fail: reject,
        });
      });
      console.log(`✅ ${img.cloudPath} → ${res.fileID}`);
      results.push({ ...img, fileID: res.fileID });
    } catch (err) {
      console.error(`❌ ${img.cloudPath} 失败:`, err);
      results.push({ ...img, fileID: null, error: err.errMsg || String(err) });
    }
  }
  
  console.log('\n========== 上传完成 ==========');
  console.log('成功:', results.filter(r => r.fileID).length, '/', all.length);
  
  // 打印可直接复制的 fileID 映射
  console.log('\n=== EIT fileID 映射（复制到 eit-data.js 的 image 字段）===');
  results.filter(r => r.module === 'eit' && r.fileID).forEach(r => {
    console.log(`卡${r.id}: "${r.fileID}",`);
  });
  
  console.log('\n=== Method fileID 映射（复制到 method-data.js 的 image 字段）===');
  results.filter(r => r.module === 'method' && r.fileID).forEach(r => {
    console.log(`卡${r.id}: "${r.fileID}",`);
  });
  
  // 存到本地缓存供后续使用
  wx.setStorageSync('uploaded_fileIDs', results);
  console.log('\nfileID 已存入 localStorage "uploaded_fileIDs"');
  
  return results;
}

uploadAll();
