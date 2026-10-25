// Build a self-contained publisher for the Mini Program's own developer console.
// Uses the current app identity, preserves remote manifest entries, and backs up JSON.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const id = process.argv[2];
if (!id || !/^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5_-]{0,79}$/.test(id)) throw Error('Provide a valid article ID');
const dist = path.join(__dirname,'dist');
const article = JSON.parse(fs.readFileSync(path.join(dist,'articles',id+'.json'),'utf8'));
const entry = JSON.parse(fs.readFileSync(path.join(dist,'manifest.json'),'utf8')).articles.find(a=>a.id===id);
if (!entry || article.id !== id || !article.blocks.length) throw Error('Article and manifest do not match');
const prefix = 'cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights/';
const images = fs.readdirSync(path.join(dist,'images',id)).map(name=>{
  const bytes = fs.readFileSync(path.join(dist,'images',id,name));
  return {remote:`images/${id}/${name}`,fileID:prefix+`images/${id}/${name}`,base64:bytes.toString('base64'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
for (const b of article.blocks.filter(b=>b.t==='image')) if(!images.some(i=>i.fileID===b.fileID)) throw Error('Missing local image '+b.fileID);
const payload = {article,entry,images};
const script = `(async()=>{
const payload=${JSON.stringify(payload)};
const {article,entry,images}=payload;
const prefix=${JSON.stringify(prefix)};
const files=wx.getFileSystemManager();
const read=async relative=>{
  const r=await wx.cloud.getTempFileURL({fileList:[prefix+relative]});
  const f=r.fileList[0];if(!f||f.status||!f.tempFileURL)throw Error('Unavailable '+relative);
  const url=f.tempFileURL+(f.tempFileURL.includes('?')?'&':'?')+'_insights='+Date.now();
  return new Promise((resolve,reject)=>wx.request({url,dataType:'json',success:r=>r.statusCode===200?resolve(r.data):reject(Error('HTTP '+r.statusCode)),fail:reject}));
};
const put=async(relative,data,encoding='utf8')=>{
  let last;
  for(let attempt=0;attempt<3;attempt++){
    const tmp=wx.env.USER_DATA_PATH+'/insights-publish-'+Date.now()+'-'+attempt;
    try{files.writeFileSync(tmp,data,encoding);return await wx.cloud.uploadFile({cloudPath:'insights/'+relative,filePath:tmp});}
    catch(e){last=e;}finally{try{files.unlinkSync(tmp);}catch(e){}}
  }throw last;
};
const json=async(relative,data)=>put(relative,JSON.stringify(data));
const manifest=await read('manifest.json');
if(!Array.isArray(manifest.articles))throw Error('Invalid remote manifest');
const beforeIds=manifest.articles.map(a=>a.id);
const backup='backups/'+article.id+'-'+Date.now();
await json(backup+'-manifest.json',manifest);
if(beforeIds.includes(article.id))await json(backup+'-article.json',await read('articles/'+article.id+'.json'));
console.log('INSIGHTS_PUBLISH_BACKUP',backup);
for(const img of images){
  const result=await put(img.remote,img.base64,'base64');
  if(result.fileID!==img.fileID)throw Error('Unexpected image fileID');
  console.log('INSIGHTS_PUBLISH_IMAGE',img.remote);
}
await json('articles/'+article.id+'.json',article);
const verified=await read('articles/'+article.id+'.json');
if(verified.builtAt!==article.builtAt||verified.blocks.length!==article.blocks.length)throw Error('Article readback mismatch; manifest not changed');
manifest.articles=manifest.articles.filter(a=>a.id!==article.id);
manifest.articles.push(entry);
manifest.articles.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
await json('manifest.json',manifest);
const listed=await read('manifest.json');
if(!listed.articles.some(a=>a.id===article.id)||!beforeIds.every(id=>listed.articles.some(a=>a.id===id)))throw Error('Manifest readback mismatch');
const report={id:article.id,version:verified.version,builtAt:verified.builtAt,blocks:verified.blocks.length,images:images.length,articles:listed.articles.map(a=>a.id),backup,manifest:listed};
console.log('INSIGHTS_PUBLISH_COMPLETE',JSON.stringify(report));
return report;
})().catch(e=>{console.error('INSIGHTS_PUBLISH_FAILED',e);throw e;});`;
const output = path.join(__dirname,`.runtime-publish-${id}.js`);
fs.writeFileSync(output,script);
console.log(JSON.stringify({output,images:images.length,scriptBytes:Buffer.byteLength(script)}));
