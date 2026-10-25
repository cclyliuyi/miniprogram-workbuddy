const assert = require('assert');
const { parseContent } = require('./parse-content');
const parsed = parseContent(`<body><header><p>导航</p></header><section class="hero"><h1>标题</h1><p class="kicker">原创</p></section><main>
<section><h2>章节</h2><p>开头<strong>重点</strong><br>下一行<script>malicious()</script></p>
<div><ul><li>找回<strong>列表内容</strong></li><li>第二项</li></ul></div>
<div class="pid-card"><h4>概念标题</h4><p>完整卡片</p></div>
<div class="formula"><span class="f-main">W &gt; S</span><span class="f-cap">说明</span></div>
<blockquote><p>引用内容</p></blockquote><figure><div>__IMG_0__</div><figcaption>FIG. 01说明</figcaption></figure>
<table><tbody><tr><th>列名</th></tr><tr><td>单元格</td></tr></tbody></table></section></main><footer><p>页脚</p></footer></body>`, [{fileID:'cloud://test/picture.webp',width:100,height:50}]);
assert.equal(parsed.hero.title, '标题');
assert.equal(parsed.toc.length, 1);
assert.equal(parsed.blocks.filter(b=>b.t==='list').length,1);
assert.equal(parsed.blocks.find(b=>b.t==='list').items[0].text,'找回列表内容');
assert.equal(parsed.blocks.filter(b=>b.t==='callout').length,2);
assert.equal(parsed.blocks.find(b=>b.kind==='formula').title,'W > S');
assert.equal(parsed.blocks.find(b=>b.t==='table').rows[1].cells[0].text,'单元格');
assert.equal(parsed.blocks.find(b=>b.t==='image').caption,'FIG. 01 · 说明');
assert.equal(parseContent('<main><figure>__IMG_0__<figcaption>FIG. 01 · 已有分隔</figcaption></figure></main>',[{fileID:'cloud://test/img'}]).blocks[0].caption,'FIG. 01 · 已有分隔');
assert.equal(parsed.blocks.filter(b=>b.t==='quote').length,1);
assert(!JSON.stringify(parsed.blocks).includes('malicious'));
assert(!JSON.stringify(parsed.blocks).includes('导航'));
assert(!JSON.stringify(parsed.blocks).includes('页脚'));
assert(JSON.stringify(parsed.blocks).includes('font-weight:700'));

// The source's editorial markers must survive, rather than becoming plain text.
const hierarchy = parseContent(`<main><section>
<div class="sec-kicker rv"><span class="sec-cn">贰</span><span class="sec-en">INFORMATION</span></div>
<h2>信息的层级</h2><h3>小节</h3><h4>次级标题</h4>
<p>普通文字<strong>加粗</strong><strong class="gold-t">金色关键词</strong><strong class="hl">核心结论</strong><span class="hl" onclick="evil()">另一处重点</span></p>
<div class="pid-card synergy"><span class="pid-badge">1 + 1 &gt; 2</span><span class="pid-en">SYNERGY</span><h4>协同信息</h4><p>内容</p></div>
<div class="lv-card hi"><div class="lv-top"><span class="lv-name">强涌现</span><span class="lv-dots"><i class="on"></i><i class="on"></i><i class="on"></i></span></div><p>等级内容</p></div>
<div class="note"><span class="note-tag">边界说明</span><p>说明内容</p></div>
<div class="adv"><span class="adv-no">02</span><h4>第二步</h4><p>步骤内容</p></div>
<div class="pullquote"><span class="pq-mark">“</span><p>独立结论<br>第二行</p></div>
</section></main>`);
assert.deepEqual(hierarchy.blocks[0], {t:'section-label',label:'贰',english:'INFORMATION'});
assert.deepEqual(hierarchy.blocks.filter(b=>b.t==='h3').map(b=>b.level),[3,4]);
const inlineNodes = hierarchy.blocks.find(b=>b.t==='p').nodes;
assert(inlineNodes.find(n=>n.attrs?.style.includes('color:#8f6a1c')));
assert.equal(inlineNodes.filter(n=>n.attrs?.style.includes('background-color:#eee1b9')).length,2);
assert(!JSON.stringify(inlineNodes).includes('onclick'));
const synergy = hierarchy.blocks.find(b=>b.title==='协同信息');
assert.equal(synergy.badge,'1 + 1 > 2'); assert.equal(synergy.eyebrow,'SYNERGY'); assert(synergy.featured);
assert.equal(hierarchy.blocks.find(b=>b.title==='强涌现').level,3);
assert.equal(hierarchy.blocks.find(b=>b.title==='边界说明').variant,'note');
assert.equal(hierarchy.blocks.find(b=>b.title==='第二步').badge,'02');
assert.equal(hierarchy.blocks.find(b=>b.t==='quote').kind,'pullquote');
const definition = parseContent('<main><figure class="quote-def"><blockquote>关键定义<strong>重点</strong></blockquote><figcaption>—— 作者 · 2013</figcaption></figure></main>');
assert.equal(definition.blocks[0].kind,'definition');
assert.equal(definition.blocks[0].text,'关键定义重点');
assert.equal(definition.blocks[0].credit,'—— 作者 · 2013');
console.log('PASS section labels, heading levels, bold/gold/highlight semantics, badges, steps, levels and pullquotes');

// Exercise page refresh with cached content: it must still request the manifest.
let page;
global.Page = p => { page = p; };
let downloads = 0;
let payload;
const old = { id:'old', title:'旧文章' }, fresh = { id:'new', title:'新文章' };
global.wx = {
  getStorageSync: key => key === 'insights_manifest_v1' ? {articles:[old]} : {},
  setStorageSync() {},
  env:{USER_DATA_PATH:'wxfile://test'},
  nextTick:callback=>callback(),
  getFileSystemManager:()=>({readFileSync:path=>{if(path.includes('/insights-cache/'))throw Error('Cache miss');return JSON.stringify(payload);},unlinkSync(){},accessSync(){},writeFileSync(){}}),
  cloud:{downloadFile:options=>{downloads++;assert(options.fileID.startsWith('cloud://'));options.success({tempFilePath:'wxfile://cloud-json-test'});}},
  request:()=>{throw Error('Cloud JSON must not depend on request domain configuration');},
};
require('../../pages/insights/insights');
page.setData = patch => Object.assign(page.data, patch);
page.prefetchNewArticles=()=>{};
(async()=>{
  payload={articles:[fresh]};
  await page.loadArticles(false);
  assert.equal(downloads,1);
  assert.equal(page.data.articles[0].id,'new');
  require('../../pages/insight-detail/detail');
  page.setData = patch => Object.assign(page.data,patch);
  const levels = page.prepareBlocks(hierarchy.blocks).find(b=>b.variant==='level');
  assert.deepEqual(levels.levelMarks.map(x=>x.active),[true,true,true]);
  payload={id:'sample',version:2,blocks:hierarchy.blocks,toc:[]};
  page.articleId='sample';
  page.resolveImages=()=>{};page.markRead=()=>{};page.measureOffsets=()=>{};
  await page.loadArticle();
  assert.equal(page.data.article.version,2);
  assert.equal(page.data.blocks.length,hierarchy.blocks.length);
  assert.equal(downloads,2);
  console.log('PASS cached lists and article refresh fetch cloud JSON without wx.request domain dependency');
  console.log('PASS nested content, inline formatting, safe nodes, image captions, tables and cached-list refresh');
})().catch(e=>{console.error(e);process.exitCode=1;});
