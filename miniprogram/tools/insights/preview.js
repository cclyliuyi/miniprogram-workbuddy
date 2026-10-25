// Browser preview of the article's data and WXSS. This is not a WeChat runtime.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const id = process.argv[2] || 'causal-emergence';
if (!/^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5_-]{0,79}$/.test(id)) throw Error('Invalid article ID');
const a = JSON.parse(fs.readFileSync(path.join(dir, 'dist/articles', id + '.json'), 'utf8'));
const escape = v => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const view = (cls, html) => `<div class="${cls}">${html}</div>`;
function nodes(list) {
  return (list || []).map(n => n.type === 'text' ? escape(n.text) : n.name === 'br' ? '<br>' : `<span style="${escape(n.attrs?.style)}">${nodes(n.children)}</span>`).join('');
}
function picture(b) {
  if (!b.fileID) return '';
  const filename = b.fileID.split('/').pop();
  const local = path.join(dir, 'dist/images', id, filename);
  const src = fs.existsSync(local) ? `data:image/${path.extname(filename).slice(1)};base64,${fs.readFileSync(local).toString('base64')}` : '';
  return src ? `<img src="${src}" alt="${escape(b.caption)}">` : '';
}
function block(b) {
  const copy = b.nodes ? nodes(b.nodes) : escape(b.text);
  if (b.t === 'section-label') return view('section-label', `<span class="section-label-cn">${escape(b.label)}</span><span class="section-label-en">${escape(b.english)}</span><div class="section-label-rule"></div>`);
  if (b.t === 'h2') return `<div id="preview-${escape(b.anchor)}"></div>` + view('b-h2', `<span class="h2-index">${b.num}</span><span class="h2-text">${escape(b.text)}</span>`);
  if (b.t === 'h3') return view(`b-h3 heading-level-${b.level || 3}`, copy);
  if (b.t === 'p') return view(`b-p ${b.lead ? 'b-lead' : ''}`, copy);
  if (b.t === 'list') return view('b-list', b.items.map(x=>view('list-row', `<span class="list-marker">${escape(x.marker)}</span>${view('list-copy', nodes(x.nodes))}`)).join(''));
  if (b.t === 'quote') return view(`b-quote ${b.kind === 'pullquote' ? 'b-pullquote' : ''}`, (b.kind === 'pullquote' ? view('quote-mark','“') : '') + copy + (b.credit ? view('quote-credit',escape(b.credit)) : ''));
  if (b.t === 'callout') {
    const meta = b.eyebrow || b.badge ? view('callout-meta', `<span class="callout-eyebrow">${escape(b.eyebrow)}</span><span class="callout-badge">${escape(b.badge)}</span>`) : '';
    const marks = b.variant === 'level' ? view('level-marks', [1,2,3].map(n=>view(`level-mark ${n <= b.level ? 'level-mark-active' : ''}`,'')).join('')) : '';
    return view(`b-callout callout-${b.variant || 'default'} ${b.featured ? 'callout-featured' : ''} ${b.kind === 'formula' ? 'b-formula' : ''}`, meta + view('callout-heading',view('callout-title',escape(b.title))+marks)+copy);
  }
  if (b.t === 'image') return view('b-figure', picture(b) + view('figure-caption',escape(b.caption)));
  if (b.t === 'hr') return view('b-hr','✦');
  if (b.t === 'table') return view('b-table-scroll',view('b-table',b.rows.map(r=>view('table-row',r.cells.map(c=>view('table-cell '+(c.heading?'table-heading':''),nodes(c.nodes))).join(''))).join('')));
  return '';
}
const css = fs.readFileSync(path.join(dir,'../../pages/insight-detail/detail.wxss'),'utf8').replace(/\bpage\s*\{/g,'body {').replace(/(-?\d+(?:\.\d+)?)rpx/g,(_,n)=>`${Number(n)/2}px`);
const hero = view('hero',view('hero-inner',view('hero-brand','洞见 <span>INSIGHTS / 原创长文</span>')+view('hero-kicker',escape(a.hero.kicker))+view('hero-title',escape(a.title))+view('hero-sub',escape(a.subtitle))+view('hero-meta',`${escape(a.dateText)} · ${a.readMinutes} 分钟阅读`)));
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>洞见排版预览 · ${escape(a.title)}</title><style>*{box-sizing:border-box}body{width:375px;max-width:100%;margin:0 auto;background:${a.theme.bg};color:${a.theme.ink};font-family:-apple-system,"Microsoft YaHei",sans-serif} ${css} .reader{--accent:${a.theme.accent};--line:${a.theme.line}} .hero-brand span{font-size:10px;letter-spacing:2px;margin-left:10px;color:#c2b696}.b-figure img{width:100%;display:block;border-radius:8px}.preview-notice{padding:10px 20px;background:#e7e0cf;font-size:12px;line-height:1.6;color:#5a554a}.article-body>.section-label:first-child{margin-top:20px}</style><body><div class="preview-notice">本地排版预览 · 使用新版文章数据和阅读页样式；微信真机效果需单独验收。<br><a href="#preview-s2">查看关键词与概念卡片</a> · <a href="#preview-s5">查看等级标识</a> · <a href="#preview-s7">查看编号步骤</a></div><div class="reader serif">${hero}<main class="article-body">${a.blocks.map(block).join('')}</main></div></body></html>`;
const output = path.join(dir,'preview.html');
fs.writeFileSync(output,html);
console.log(output);
