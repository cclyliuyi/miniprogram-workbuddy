const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../..');
let saved,cloudCalls=0,downloads=0,clientSigns=0;
const fsm={readFileSync(p){if(!saved)throw Error('missing');return JSON.stringify(saved)},writeFileSync(p,text){saved=JSON.parse(text)},unlinkSync(){},accessSync(){}};
const fresh={id:'sample',builtAt:'same',mediaExpiresAt:Date.now()+3600000,hero:{cover:'cloud://private/cover.webp',coverUrl:'https://signed.example/cover'},blocks:[{t:'image',fileID:'cloud://private/pic.webp',src:'https://signed.example/new',width:100,height:50}],toc:[]};
const wx={env:{USER_DATA_PATH:'wxfile://test'},getFileSystemManager:()=>fsm,cloud:{callFunction(o){cloudCalls++;o.success({result:{ok:true,data:fresh}})},downloadFile(o){downloads++;o.fail({errMsg:'empty download url'})},async getTempFileURL(){clientSigns++;throw Error('ordinary reader has no storage permission')}},nextTick:cb=>cb(),setNavigationBarTitle(){}};
function load(file,requireExtra){const c={module:{exports:{}},exports:{},wx,Date,console,setTimeout(){},require:requireExtra};vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),c);return c.module.exports;}
const helper=load('utils/cloud-json.js');
let page;
const c={wx,Date,console,setTimeout(){},Page:p=>page=p,require:name=>name.includes('cloud-json')?helper:{light(){}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'pages/insight-detail/detail.js'),'utf8'),c);
page.setData=patch=>{for(const [k,v] of Object.entries(patch)){const parts=k.replace(/\[(\d+)\]/g,'.$1').split('.');let obj=page.data;for(const part of parts.slice(0,-1))obj=obj[part];obj[parts.at(-1)]=v}};
(async()=>{
 assert.equal((await helper.fetchArticleJSON('sample')).id,'sample');assert.equal(downloads,0);
 helper.writeArticleCache('sample',{...fresh,mediaExpiresAt:Date.now()-1});assert.equal(helper.readArticleCache('sample'),null,'expired media must be fetched again');
 saved=null;
 page.articleId='sample';page.markRead=()=>{};page.measureOffsets=()=>{};
 page.applyArticle(fresh);await Promise.resolve();
 assert.equal(page.data.blocks[0].src,'https://signed.example/new');assert.equal(page.data.article.hero.coverUrl,'https://signed.example/cover');assert.equal(clientSigns,0,'signed images must not be reauthorized with reader credentials');
 saved={data:{...fresh,mediaExpiresAt:undefined}};page.data.article=saved.data;
 await page.refreshArticleSilently();assert(page.data.article.mediaExpiresAt,'old body cache must pick up server media even when builtAt is unchanged');
 const before=cloudCalls;await page.retryImage({currentTarget:{dataset:{index:0}}});assert(cloudCalls>before,'image retry must renew server authorization');assert.equal(clientSigns,0);
 console.log('PASS ordinary-reader gateway, signed media without storage access, expired cache, cache migration and image retry');
})().catch(e=>{console.error(e);process.exitCode=1});
