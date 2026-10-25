// Fallback for IDE versions whose CLI automation port is unavailable.
// Produces a reviewed script to run in the project's Mini Program console.
// Reuses the unchanged illustrations already online; backs up live JSON first.
const fs = require('fs');
const path = require('path');
const id = process.argv[2] || 'causal-emergence';
if (!/^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5_-]{0,79}$/.test(id)) throw Error('Invalid article ID');
const article = JSON.parse(fs.readFileSync(path.join(__dirname,'dist/articles',id+'.json'),'utf8'));
const entry = JSON.parse(fs.readFileSync(path.join(__dirname,'dist/manifest.json'),'utf8')).articles.find(a=>a.id===id);
const script = `(async()=>{
  const page=getCurrentPages().slice(-1)[0];
  const old=page.data.article;
  const next=${JSON.stringify(article)};
  const entry=${JSON.stringify(entry)};
  if (!old || old.id!==next.id) throw Error('请先打开目标文章');
  const previous=old.blocks.filter(b=>b.t==='image');
  const pictures=next.blocks.filter(b=>b.t==='image');
  if(previous.length!==pictures.length) throw Error('图片数量变化，请使用完整上传流程');
  pictures.forEach((b,i)=>{
    const before=(previous[i].fileID||'').match(/img_(\\d+)/);
    const after=(b.fileID||'').match(/img_(\\d+)/);
    if(!before || !after || before[1]!==after[1] || previous[i].width!==b.width || previous[i].height!==b.height) throw Error('图片顺序或尺寸变化，停止同步');
    b.fileID=previous[i].fileID;
  });
  next.hero.cover=pictures[0]?.fileID||'';
  entry.coverFileID=next.hero.cover;
  const prefix='cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights/';
  const files=wx.getFileSystemManager();
  const request=url=>new Promise((resolve,reject)=>wx.request({url,dataType:'json',success:r=>r.statusCode===200?resolve(r.data):reject(Error('HTTP '+r.statusCode)),fail:reject}));
  const read=async relative=>{
    const r=await wx.cloud.getTempFileURL({fileList:[prefix+relative]});
    const f=r.fileList[0];if(f.status||!f.tempFileURL) throw Error('读取失败 '+relative);
    return request(f.tempFileURL+(f.tempFileURL.includes('?')?'&':'?')+'_insights='+Date.now());
  };
  const put=async(relative,data)=>{
    const tmp=wx.env.USER_DATA_PATH+'/insights-sync-'+Date.now()+'.json';
    files.writeFileSync(tmp,JSON.stringify(data),'utf8');
    try{return await wx.cloud.uploadFile({cloudPath:'insights/'+relative,filePath:tmp});}
    finally{try{files.unlinkSync(tmp);}catch(e){}}
  };
  const live=await read('articles/'+next.id+'.json');
  const manifest=await read('manifest.json');
  if(live.id!==next.id || !Array.isArray(manifest.articles)) throw Error('云端数据校验失败');
  const stamp=Date.now();
  const backup='backups/'+next.id+'-'+stamp;
  await put(backup+'-article.json',live);
  await put(backup+'-manifest.json',manifest);
  console.log('INSIGHTS_BACKUP',backup);
  await put('articles/'+next.id+'.json',next);
  manifest.articles=manifest.articles.filter(a=>a.id!==next.id);
  manifest.articles.push(entry);
  manifest.articles.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  await put('manifest.json',manifest);
  console.log('INSIGHTS_SYNC_COMPLETE',JSON.stringify({id:next.id,version:next.version,blocks:next.blocks.length,builtAt:next.builtAt,backup}));
  await page.loadArticle();
  console.log('INSIGHTS_RELOADED',JSON.stringify({version:page.data.article.version,blocks:page.data.blocks.length,inline:page.data.blocks.filter(b=>b.nodes).length}));
})().catch(e=>console.error('INSIGHTS_SYNC_FAILED',e));`;
const output=path.join(__dirname,'.runtime-sync.js');
fs.writeFileSync(output,script);
console.log(output);
