// utils/cloud-images.js
// EIT + 方法论图片的云存储 fileID 映射
// 图片已上传至云存储 cloud1-d3gsxamaw26beccb8
// fileID 格式: cloud://<env>.<bucket>/<cloudPath>

const PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783';

// EIT 12张
const EIT_FILE_IDS = {};
for (let i = 1; i <= 12; i++) {
  const id = String(i).padStart(2, '0');
  EIT_FILE_IDS[i] = `${PREFIX}/eit/eit_${id}.webp`;
}

// 方法论 12张
const METHOD_FILE_IDS = {};
for (let i = 1; i <= 12; i++) {
  const id = String(i).padStart(2, '0');
  METHOD_FILE_IDS[i] = `${PREFIX}/method/m_${id}.webp`;
}

module.exports = { EIT_FILE_IDS, METHOD_FILE_IDS };
