// utils/cloud-images.js
// EIT + 方法论图片 + 公式渲染图的云存储 fileID 映射
// 图片已上传至云存储 cloud1-d3gsxamaw26beccb8
// fileID 格式: cloud://<env>.<bucket>/<cloudPath>

const PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783';

// EIT 主图 12张
const EIT_FILE_IDS = {};
for (let i = 1; i <= 12; i++) {
  const id = String(i).padStart(2, '0');
  EIT_FILE_IDS[i] = `${PREFIX}/eit/eit_${id}.webp`;
}

// EIT 公式渲染图（card 12 没有公式）
const EIT_FORMULA_IDS = {};
for (let i = 1; i <= 11; i++) {
  const id = String(i).padStart(2, '0');
  EIT_FORMULA_IDS[i] = `${PREFIX}/eit/formula/f_eit_${id}.png`;
}

// 方法论主图 12张
const METHOD_FILE_IDS = {};
for (let i = 1; i <= 12; i++) {
  const id = String(i).padStart(2, '0');
  METHOD_FILE_IDS[i] = `${PREFIX}/method/m_${id}.webp`;
}

// 方法论公式渲染图
const METHOD_FORMULA_IDS = {
  system: `${PREFIX}/method/formula/f_m1_system.png`,
  optimize: `${PREFIX}/method/formula/f_m4_optimize.png`,
};

module.exports = { EIT_FILE_IDS, EIT_FORMULA_IDS, METHOD_FILE_IDS, METHOD_FORMULA_IDS };
