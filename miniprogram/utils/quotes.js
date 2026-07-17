// utils/quotes.js —— 兼容入口
// 微信打包器 require('./quotes') 优先解析本文件，再透传到 quotes/ 目录
const Q = require('./quotes/index');
module.exports = Q;
