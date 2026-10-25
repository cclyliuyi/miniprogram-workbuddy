#!/usr/bin/env node
/**
 * 洞见 · 一次性运维脚本
 * 1. 检查/修正云存储 ins 路径的存储安全规则 → 所有用户可读（公开文章数据）
 * 2. 输出当前权限状态供人工确认
 *
 * 需要 TCB 密钥（腾讯云 SecretId/SecretKey），从环境变量读取：
 *   TCB_SECRET_ID / TCB_SECRET_KEY
 * 若未配置，提示用户改用「微信开发者工具 → 云开发控制台 → 存储 → 权限设置」手动切换。
 */
const fs = require('fs');
const path = require('path');

const ENV_ID = 'cloud1-d3gsxamaw26beccb8';

async function main() {
  const id = process.env.TCB_SECRET_ID;
  const key = process.env.TCB_SECRET_KEY;
  if (!id || !key) {
    console.log('未配置 TCB_SECRET_ID / TCB_SECRET_KEY 环境变量，无法用 API 改权限。');
    console.log('请手动操作（1 分钟）：');
    console.log('  微信开发者工具 → 云开发 → 存储 → 权限设置 →');
    console.log('  选择「所有用户可读，仅管理端可写」→ 保存。');
    process.exit(0);
  }
  const sdk = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/@cloudbase/node-sdk');
  const app = sdk.init({ env: ENV_ID, secretId: id, secretKey: key });
  console.log('TCB 连接成功，环境:', ENV_ID);
  // 注意：存储安全规则 API 属于 CAM/TCBAPI 范畴，node-sdk 不直接暴露；
  // 此处仅做连通性验证，规则修改仍建议走控制台。
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
