const assert=require('assert');
const sharp=require('sharp');
const {rasterizeCharts}=require('./rasterize-charts');
const {parseContent}=require('./parse-content');
(async()=>{
  const source='<style>:root{--gold-strong:#8f6a1c;}[data-theme="light"]{--surface:#fff;--ink-3:#857b68;}.curve{stroke:var(--gold-strong);fill:none;}</style><main><p>相变前</p><div class="chart-box"><svg viewBox="0 0 340 196" role="img" aria-label="相变图"><path class="curve" d="M10 150L300 20"/></svg><p class="chart-cap">非线性跃迁示意图</p></div><p>相变后</p><svg class="icon" viewBox="0 0 24 24"><path d="M1 1L2 2"/></svg></main>';
  const result=await rasterizeCharts(source);
  const embedded=result.match(/src="data:image\/png;base64,([^"]+)"/);
  assert(embedded,'semantic SVG chart must become an image');
  const meta=await sharp(Buffer.from(embedded[1],'base64')).metadata();
  assert.equal(meta.width,1360);assert.equal(meta.height,784);
  assert(result.includes('class="icon"'),'decorative icons must remain outside the chart conversion');
  const blocks=parseContent(result.replace(/<img\b[^>]*>/,'__IMG_0__'),[{fileID:'cloud://test/chart.png',width:1360,height:784}]).blocks;
  assert.deepEqual(blocks.map(b=>b.t),['p','image','p']);
  assert.equal(blocks[1].caption,'非线性跃迁示意图');
  assert.equal(blocks[2].text,'相变后');
  console.log('PASS inline SVG becomes a 4x image at its original position; caption retained once; icons excluded');
})().catch(e=>{console.error(e);process.exitCode=1;});
