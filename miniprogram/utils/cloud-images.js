// utils/cloud-images.js
// 方法论 + 工具页 图片及公式渲染图的云存储 fileID 映射
// 图片已上传至云存储 cloud1-d3gsxamaw26beccb8

const PREFIX = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783';

// 方法论主图 12张
const METHOD_FILE_IDS = {};
for (let i = 1; i <= 12; i++) {
  const id = String(i).padStart(2, '0');
  METHOD_FILE_IDS[i] = `${PREFIX}/method/m_${id}.webp`;
}

// 方法论公式渲染图
const METHOD_FORMULA_IDS = {
  system: `${PREFIX}/method/formula/f_m_system.png`,
  optimize: `${PREFIX}/method/formula/f_m_optimize.png`,
};

// 工具页公式渲染图
const TOOLS_FORMULA_IDS = {
  skin: `${PREFIX}/tools/formula/f_tools_skin.png`,
  ae: `${PREFIX}/tools/formula/f_tools_ae.png`,
  farfield: `${PREFIX}/tools/formula/f_tools_farfield.png`,
  los: `${PREFIX}/tools/formula/f_tools_los.png`,
  noise: `${PREFIX}/tools/formula/f_tools_noise.png`,
};

module.exports = {
  METHOD_FILE_IDS,
  METHOD_FORMULA_IDS,
  TOOLS_FORMULA_IDS,
};
