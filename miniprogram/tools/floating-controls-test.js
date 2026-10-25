const assert=require('assert');
const fs=require('fs');
const sharedStyles=fs.readFileSync(require('path').join(__dirname,'../styles/tool-ui.wxss'),'utf8');
assert(!/\.fd-stage\s*\{[^}]*min-height\s*:\s*calc/.test(sharedStyles),'Chart stage must not reserve viewport-sized blank space');
const {withFloatingControls,shouldFloat}=require('../utils/lab-canvas');
assert.equal(shouldFloat(800,700,200),true);
assert.equal(shouldFloat(500,700,200),false);
assert.equal(shouldFloat(-20,700,200),false);
assert.equal(shouldFloat(501,700,200),true);
let anchor=800, callbacks=[], readied=0, unloaded=0, scrolls=0;
let scrollTarget;
global.wx={pageScrollTo:opts=>{scrollTarget=opts;},getWindowInfo:()=>({windowHeight:700,windowWidth:375}),createSelectorQuery:()=>{
 const q={in:()=>q,select:()=>q,boundingClientRect:()=>q,exec:cb=>callbacks.push(()=>cb([{top:anchor},{height:200}]))};return q;
}};
const page=withFloatingControls({data:{S:{power:30}},onReady(){readied++;},onUnload(){unloaded++;},onPageScroll(){scrolls++;}},2);
page.setData=function(data,done){Object.assign(this.data,data);if(done)done();};
page.onReady();callbacks.shift()();assert.equal(readied,1);assert.equal(page.data.fdVisible,true);
assert.equal(page.data.fdHeight,200);
page.fdShowAll();assert.equal(scrollTarget.selector,'#fd-anchor');
page.fdTouchStart();anchor=100;page.fdMeasure();assert.equal(callbacks.length,0);assert.equal(page.data.fdVisible,true);
page.fdTouchEnd();callbacks.shift()();assert.equal(page.data.fdVisible,false);
anchor=850;page.fdMeasure();callbacks.shift()();assert.equal(page.data.fdVisible,true);
page.fdSelect({currentTarget:{dataset:{group:1}}});assert.equal(page.data.fdGroup,1);assert.equal(page.data.S.power,30);
page.fdMeasure();page.onUnload();callbacks.shift()();assert.equal(unloaded,1);
const all=require('../utils/tool-registry').SECTIONS.slice(0,2).flatMap(s=>s.items);
let pages=0;
for(const t of all){
 const source=fs.readFileSync(require('path').join(__dirname,'..',t.url+'.wxml'),'utf8');
 const [original,mirror]=source.split('<!-- floating-controls:start -->');if(!mirror)continue;
 assert.equal((source.match(/id="fd-anchor"/g)||[]).length,1);
 assert.equal((source.match(/id="fd-panel"/g)||[]).length,1);
 assert(!source.includes('<scroll-view'),t.key+' canvas and parameter cards must share native page scrolling');
 assert(!source.includes('height:calc(100vh -'),t.key+' floating state must not resize the scroll viewport');
 const sliders=s=>[...s.matchAll(/<slider\b[\s\S]*?\/>/g)].map(m=>m[0].replace(/\s+/g,' '));
 const originals=sliders(original), tracks=[...mirror.matchAll(/<cover-view id="fd-track-[^>]+>/g)].map(m=>m[0]);
 assert.equal(originals.length,tracks.length);
 assert(!/<(?:view|text|slider)\b/.test(mirror),t.key+' overlay must contain only native cover views');
 for(let i=0;i<originals.length;i++)for(const [a,b] of [['min','data-min'],['max','data-max'],['step','data-step'],['disabled','data-disabled'],['bindchanging','data-changing'],['bindchange','data-change']]){
  const read=(str,key)=>(str.match(new RegExp(key+'="([^\"]*)"'))||[])[1]||'';
  assert.equal(read(originals[i],a),read(tracks[i],b),t.key+' '+a);
 }
 if(t.key==='friis')assert(mirror.includes('wx:if="{{S.mode === \'radar\'}}"'));
 if(t.key==='smart')assert(mirror.includes('wx:if="{{S.dual}}"'));
 pages++;
}
assert.equal(pages,12);
// Register every affected page through its actual dependency chain.
// No standalone floating-controls module may be required by a page again.
let registered, loaded=0;
global.Page=definition=>{ registered=definition; };
for(const t of all){
 const file=require('path').join(__dirname,'..',t.url+'.js');
 const source=fs.readFileSync(file,'utf8');
 if(!source.includes('withFloatingControls'))continue;
 assert(!/require\([^)]*floating-controls/.test(source),t.key+' must use the existing canvas module');
 registered=null;require(file);
 assert(registered && typeof registered.fdMeasure==='function',t.key+' page registration failed');
 loaded++;
}
assert.equal(loaded,12);
console.log('PASS docking boundary, reverse scroll, drag lock, lifecycle cleanup and all 12 pages / slider bindings');


const realSetTimeout=global.setTimeout,realClearTimeout=global.clearTimeout;
let sequence=0;const tasks=new Map();global.setTimeout=(fn,ms)=>{tasks.set(++sequence,{fn,ms});return sequence;};global.clearTimeout=id=>tasks.delete(id);
function flush(){for(const ms of [16,48])for(const [id,t] of [...tasks])if(t.ms===ms){tasks.delete(id);t.fn();}}
let emitted=[],query;
global.wx.createSelectorQuery=()=>{const q={in:()=>q,select:()=>q,boundingClientRect:()=>q,exec:cb=>{query=()=>cb([{left:180,width:200}]);}};return q;};
const native=withFloatingControls({data:{},onChanging(e){emitted.push(e.detail.value);},onChange(e){emitted.push(e.detail.value);}},1);native._fdAlive=true;native.fdMeasure=()=>{};native.setData=function(d){Object.assign(this.data,d);};
const dataset={id:1,value:-21,min:-75,max:75,step:1,changing:'onChanging',change:'onChange'};
function start(touch){native.fdNativeStart({currentTarget:{dataset},touches:[touch]});query();}
start({pageX:250,clientX:0});native.fdNativeEnd({changedTouches:[{pageX:0,clientX:0}]});assert.deepEqual(emitted,[],'tap must preserve existing value');
start({pageX:250,clientX:0});native.fdNativeMove({touches:[{pageX:270,clientX:0}]});flush();assert.equal(emitted.at(-1),-6);native.fdNativeEnd({changedTouches:[{pageX:0}]});assert.equal(emitted.at(-1),-6,'touchend zero must not reset');
start({x:15});native.fdNativeMove({touches:[{x:35}]});flush();assert.equal(emitted.at(-1),-6,'local coordinates must work without subtracting viewport left');native.fdNativeEnd({});
start({clientX:250});native.fdNativeMove({touches:[{clientX:-500}]});flush();assert.equal(emitted.at(-1),-75);native.fdNativeMove({touches:[{clientX:1000}]});flush();assert.equal(emitted.at(-1),75);native.fdNativeEnd({});
const count=emitted.length;start({pageX:200});native.fdNativeMove({touches:[{}]});native.fdNativeEnd({});assert.equal(emitted.length,count,'missing coordinates must not emit invalid values');
native.fdNativeStart({currentTarget:{dataset},touches:[{pageX:250}]});native.fdNativeMove({touches:[{pageX:270}]});native.fdNativeEnd({changedTouches:[{pageX:0}]});query();assert.equal(emitted.at(-1),-6,'quick gesture before measurement must commit last movement');
console.log('PASS phone/desktop/local coordinates, tap preservation, zero touchend, clamping, missing coordinates and asynchronous measurement');

start({pageX:250});const before=emitted.length;for(let x=251;x<=280;x++)native.fdNativeMove({touches:[{pageX:x}]});assert.equal(emitted.length,before);flush();assert.equal(emitted.length,before+1,'burst must coalesce to latest value');native.fdNativeEnd({});assert.equal(emitted.at(-1),2);assert.equal(tasks.size,0);global.setTimeout=realSetTimeout;global.clearTimeout=realClearTimeout;console.log('PASS move burst coalescing and final flush');
