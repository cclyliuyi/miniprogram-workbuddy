const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const uploaded = require('./uploaded.json');
const storage = {};
let retryResponse;
const wx = {getStorageSync:key=>storage[key],setStorageSync:(key,value)=>storage[key]=value,cloud:{getTempFileURL:async()=>retryResponse},navigateTo(){},vibrateShort(){}};
const context = {module:{exports:{}},wx,require:()=>({light(){}})};
vm.runInNewContext(fs.readFileSync(path.join(root,'utils/learning-pages.js'),'utf8'),context);
const {createList,createDetail}=context.module.exports;
function page(definition) {
  const p = {...definition,data:JSON.parse(JSON.stringify(definition.data))};
  p.setData = function(values){
    for(const [key,value] of Object.entries(values)) {
      const keys=key.replace(/\[(\d+)\]/g,'.$1').split('.');
      let target=this.data;
      for(const k of keys.slice(0,-1)) target=target[k];
      target[keys[keys.length-1]]=value;
    }
  };
  return p;
}
async function main() {
  for(const [key,count] of [['eit',18],['method',16]]) {
    const cards=require(path.join(root,`pages/${key}/${key}-data.js`)).CARDS;
    assert.equal(cards.length,count);
    assert.equal(new Set(cards.map(c=>c.id)).size,count);
    for(const card of cards) {
      assert.ok(uploaded.some(asset=>asset.fileID===card.imageSrc));
      assert.ok(card.sources.length && card.sections.length===2 && card.exercise);
      for(const source of card.sources) assert.ok(source.url.startsWith('https://'));
      const file=card.id.replace('v2-','')+'.png';
      assert.ok(fs.statSync(path.join(__dirname,'originals',file)).size>1000);
    }
    console.log('PASS '+key+'：数量、来源、图片与练习完整');
    storage[key+'_read']=[1,2,3];
    storage[key+'_read_v2']=[cards[0].id,'unknown'];
    const stages=[...new Set(cards.map(c=>c.stage))].map(title=>({title}));
    const list=page(createList({cards,key,title:key,intro:'',stages}));
    list.onShow();
    assert.equal(list.data.groups.length,4);
    assert.equal(list.data.readCount,1);
    assert.equal(list.data.groups.flatMap(g=>g.cards).length,count);
    const detail=page(createDetail({cards,key}));
    for(const index of ['-1','999','NaN','1.5']) {detail.onLoad({index});assert.equal(detail.data.currentIndex,0);}
    detail.onLoad({id:cards[count-1].id});
    assert.equal(detail.data.currentIndex,count-1);
    detail.navigateCard({currentTarget:{dataset:{step:1}}});
    assert.equal(detail.data.currentIndex,count-1);
    detail.navigateCard({currentTarget:{dataset:{step:-1}}});
    assert.equal(detail.data.currentIndex,count-2);
    assert.ok(storage[key+'_read_v2'].includes(cards[count-2].id));
    assert.deepEqual(storage[key+'_read'],[1,2,3]);
    console.log('PASS '+key+'：阶段分组、稳定链接、边界翻页、旧进度保留');
    retryResponse={fileList:[{status:0,tempFileURL:'https://example.test/image.webp'}]};
    await detail.retryImage({currentTarget:{dataset:{index:0}}});
    assert.equal(detail.data.cards[0].imageSrc,'https://example.test/image.webp');
    retryResponse={fileList:[{status:-1}]};
    await detail.retryImage({currentTarget:{dataset:{index:0}}});
    assert.equal(detail.data.cards[0].imageStatus,'error');
    detail.onUnload();
    retryResponse={fileList:[{status:0,tempFileURL:'https://example.test/late.webp'}]};
    await detail.retryImage({currentTarget:{dataset:{index:0}}});
    assert.equal(detail.data.cards[0].imageSrc,'https://example.test/image.webp');
    console.log('PASS '+key+'：图片重试及卸载保护');
  }
  assert.equal(uploaded.length,34);
  console.log('All content-v2 checks passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
