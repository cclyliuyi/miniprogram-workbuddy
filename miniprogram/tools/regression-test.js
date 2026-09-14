const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
require('./sync-subpackage-utils').sync({check:true});
function storeWx(extra={}) { const store = {}; return {store, wx:{getStorageSync:k=>store[k],setStorageSync:(k,v)=>{store[k]=v},...extra}} }
function load(file, wx, extra={}) {
 const context={module:{exports:{}},wx,console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,require:p=>require(path.resolve(root,path.dirname(file),p)),...extra};
 vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});return context.module.exports;
}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS',name)}
(async()=>{
 await test('闰年网格与课程日期分离',()=>{const d=require('../utils/date');assert.equal(d.buildMonthGrid(2,{},2028).daysInMonth,29);assert.equal(d.daysInMonth(2),28);assert.equal(d.buildMonthGrid(2,{},2026).daysInMonth,28);assert.equal(d.getLunarDate(2026,1,5).term,'')});
 await test('复习计入当天打卡但不重复增加已读数',()=>{const {wx,store}=storeWx();const p=load('utils/progress.js',wx);assert.equal(p.markRead(1,1),true);store.em_streak={count:3,lastDate:'2000-1-1'};assert.equal(p.markRead(1,1),false);assert.equal(p.getReadCount(),1);assert.equal(p.getStreak().todayChecked,true);assert.equal(p.getStreak().count,1);p.markRead(1,1);assert.equal(p.getStreak().count,1)});
 await test('月查询并发去重且日查询命中月内存缓存',async()=>{let calls=0;const {wx,store}=storeWx({cloud:{callFunction:({success})=>{calls++;setTimeout(()=>success({result:{ok:true,data:[{month:1,day:1}]}}),1)}}});const db=load('utils/db.js',wx);await Promise.all([db.getMonthPhotos(1),db.getMonthPhotos(1)]);delete store.calcache_m1;const r=await db.getDayPhoto(1,1);assert.equal(r.data.length,1);assert.equal(calls,1)});
 await test('网络失败返回过期缓存，仍可阅读',async()=>{const {wx,store}=storeWx({cloud:{callFunction:({fail})=>fail({errMsg:'offline'}),database:()=>{throw Error('offline')}}});store.calcache_m1={list:[{month:1,day:1}],t:1};const db=load('utils/db.js',wx,{setTimeout:fn=>setTimeout(fn,0),Date:class extends Date{static now(){return 1000000000000}}}); // ensureCloud replaced with immediate failing DB below
 // Avoid initialization polling: a valid query object which rejects get().
 wx.cloud.database=()=>({collection:()=>({where(){return this},skip(){return this},limit(){return this},get:()=>Promise.reject(Error('offline'))})});
 const r=await db.getMonthPhotos(1);assert.equal(r.stale,true);assert.equal(r.data.length,1)});
 await test('全资源唯一 ID、有效路由、英文搜索与缩写',()=>{const a=require('../app.json');const routes=new Set(a.pages.concat(a.subPackages.flatMap(p=>p.pages.map(x=>p.root+'/'+x))));const r=require('../utils/resources');const all=r.getResources();assert.equal(all.length,new Set(all.map(x=>x.id)).size);all.forEach(x=>assert.ok(routes.has(x.url.slice(1).split('?')[0]),x.url));assert.ok(r.searchResources('SMITH').length);assert.deepEqual(r.searchResources('VSWR').map(x=>x.id),r.searchResources('驻波比').map(x=>x.id));assert.ok(r.searchResources('Agent').some(x=>x.type==='方法论'))});
 await test('日历收藏返回状态并保持存储一致',()=>{const {wx}=storeWx();const p=load('utils/progress.js',wx);assert.equal(p.toggleFav(9,30),true);assert.equal(p.isFav(9,30),true);assert.equal(p.toggleFav(9,30),false);assert.equal(p.isFav(9,30),false)});
 await test('新收藏不覆盖原有日历收藏',()=>{const {wx,store}=storeWx();store.em_favs=[{month:1,day:1}];const f=load('utils/resource-favs.js',wx);assert.equal(f.toggle('tool:smith'),true);assert.equal(f.getIds().length,1);assert.equal(f.toggle('tool:smith'),false);assert.equal(store.em_favs.length,1)});
 function page(file,wx,overrides={}){let definition;load(file,wx,{Page:p=>definition=p,...overrides});const p={...definition,data:JSON.parse(JSON.stringify(definition.data))};p.setData=function(patch){for(const [k,v] of Object.entries(patch)){const keys=k.replace(/\[(\d+)\]/g,'.$1').split('.');let target=this.data;keys.slice(0,-1).forEach(key=>target=target[key]);target[keys.at(-1)]=v}};return p}
 await test('详情图片失败可重试，卸载后不写回',async()=>{let fail=true;const {wx}=storeWx();const p=page('pages/day-detail/day-detail.js',wx,{require:id=>id.endsWith('/db')?{getDayPhoto:async()=>{if(fail)throw Error('offline');return{data:[{front:{preview:'image'}}]}}}:require(path.resolve(root,'pages/day-detail',id))});p.data.swiperList=[{key:'1-1',month:1,day:1,loaded:false}];await p.loadSlide(0);assert.equal(p.data.swiperList[0].loaded,false);assert.equal(p.data.swiperList[0].status,'error');fail=false;await p.loadSlide(0);assert.equal(p.data.swiperList[0].loaded,true);p.onUnload()});
 await test('首次停留才记读，隐藏页面取消计时',()=>{
  let reads=0, next=0;const timers=new Map();const {wx}=storeWx({showToast(){}});
  const p=page('pages/day-detail/day-detail.js',wx,{
    setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next},clearTimeout:id=>timers.delete(id),
    require:id=>id.endsWith('/progress')?{getFavs:()=>[],isFav:()=>false,markRead:()=>{reads++;return false},getStreak:()=>({count:1}),checkMilestone:()=>null}:id.endsWith('/db')?{getDayPhoto:async()=>({data:[]})}:require(path.resolve(root,'pages/day-detail',id))
  });
  p.onLoad({month:'1',day:'1'});assert.equal(reads,0);p.onHide();assert.equal([...timers.values()].filter(x=>x.ms===1500).length,0);
  p.onShow();const timer=[...timers.values()].find(x=>x.ms===1500);assert.ok(timer);timer.fn();assert.equal(reads,1);p.onUnload();
 });
 await test('注册页面四件套完整',()=>{const a=require('../app.json');for(const r of a.pages.concat(a.subPackages.flatMap(p=>p.pages.map(x=>p.root+'/'+x))))for(const ext of ['.js','.json','.wxml','.wxss'])assert.ok(fs.existsSync(path.join(root,r+ext)),r+ext)});
 console.log(`${passed} regression tests passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
