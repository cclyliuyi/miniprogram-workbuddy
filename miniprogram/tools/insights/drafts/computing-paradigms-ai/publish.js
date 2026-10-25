const fs=require('fs');
const path=require('path');
const automator=require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/miniprogram-automator');
const root=path.resolve(__dirname,'../../../..');
const id='computing-paradigms-ai';
const dist=path.join(root,'tools/insights/dist');
const article=JSON.parse(fs.readFileSync(path.join(dist,'articles',id+'.json'),'utf8'));
const entry=JSON.parse(fs.readFileSync(path.join(dist,'manifest.json'),'utf8')).articles.find(a=>a.id===id);
const prefix='cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/insights/';
(async()=>{
 const mini=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 const readOnce=relative=>mini.evaluate(async(fileID)=>{
   const r=await wx.cloud.downloadFile({fileID});
   const fs=wx.getFileSystemManager();
   try{return JSON.parse(fs.readFileSync(r.tempFilePath,'utf8'));}finally{try{fs.unlinkSync(r.tempFilePath)}catch(e){}}
 },prefix+relative);
 const read=async relative=>{let error;for(let attempt=0;attempt<3;attempt++){try{return await readOnce(relative);}catch(e){error=e;await new Promise(r=>setTimeout(r,1200));}}throw error;};
 const put=async(relative,bytes)=>{
   let error;
   for(let attempt=0;attempt<3;attempt++){
     try{return await mini.evaluate(async(data,remote)=>{
       const f=wx.getFileSystemManager(),tmp=wx.env.USER_DATA_PATH+'/insights-publish-'+Date.now();
       f.writeFileSync(tmp,data,'base64');
       try{return await wx.cloud.uploadFile({cloudPath:remote,filePath:tmp});}finally{try{f.unlinkSync(tmp)}catch(e){}}
     },bytes.toString('base64'),'insights/'+relative);}catch(e){error=e;await new Promise(r=>setTimeout(r,1000));}
   }throw error;
 };
 const json=(relative,value)=>put(relative,Buffer.from(JSON.stringify(value)));
 try{
   const manifest=await read('manifest.json');
   if(!Array.isArray(manifest.articles))throw Error('Invalid live manifest');
   const oldIds=manifest.articles.map(a=>a.id),backup='backups/'+id+'-'+Date.now();
   await json(backup+'-manifest.json',manifest);
   const previous=oldIds.includes(id)?await read('articles/'+id+'.json'):null;
   if(previous)await json(backup+'-article.json',previous);
   console.log('BACKUP',backup);
   const names=[...new Set(article.blocks.filter(b=>b.t==='image').map(b=>b.fileID.split('/').pop()))];
   const existing=new Set((previous?.blocks||[]).filter(b=>b.t==='image').map(b=>b.fileID));
   for(const name of names){const relative='images/'+id+'/'+name;if(existing.has(prefix+relative)){console.log('REUSE IMAGE',name);continue;}const r=await put(relative,fs.readFileSync(path.join(dist,'images',id,name)));if(r.fileID!==prefix+relative)throw Error('Image path mismatch');console.log('IMAGE',name);}
   await json('articles/'+id+'.json',article);
   const checked=await read('articles/'+id+'.json');
   if(checked.id!==id||checked.builtAt!==article.builtAt||checked.blocks.length!==article.blocks.length)throw Error('Article readback mismatch; manifest not changed');
   manifest.articles=manifest.articles.filter(a=>a.id!==id);manifest.articles.push(entry);manifest.articles.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
   await json('manifest.json',manifest);
   const listed=await read('manifest.json');
   if(!listed.articles.some(a=>a.id===id)||!oldIds.every(old=>listed.articles.some(a=>a.id===old)))throw Error('Manifest mismatch');
   const oldRecord=fs.existsSync(path.join(__dirname,'publication.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'publication.json'),'utf8')):{};
   const record={...oldRecord,id,title:article.title,date:article.date,publishedAt:new Date().toISOString(),builtAt:checked.builtAt,version:checked.version,blocks:checked.blocks.length,inline:checked.blocks.filter(b=>b.nodes).length,images:checked.blocks.filter(b=>b.t==='image').map(b=>({fileID:b.fileID,status:'cloud-uploaded; native check pending'})),manifestIds:listed.articles.map(a=>a.id),previousBackup:oldRecord.backup,backup:{cloudPath:'insights/'+backup+'-manifest.json',articleCloudPath:'insights/'+backup+'-article.json'},validation:{cloudReadback:true,native:'pending after final illustration revision'},source:'source.md',html:'article.html',editorialNotes:'editorial-notes.md',imagePrompts:'image-prompts.md',imageMode:'built-in image_gen'};
   record.source='source-20261022-2358.md';record.editorialNotes='replacement-notes.md';record.replacementHistory=fs.readFileSync(path.join(__dirname,'active-backup.txt'),'utf8');record.screenshots=[];
   fs.writeFileSync(path.join(__dirname,'publication.json'),JSON.stringify(record,null,2));fs.writeFileSync(path.join(dist,'manifest.json'),JSON.stringify(listed));
   console.log('PUBLISHED',JSON.stringify({id,blocks:record.blocks,images:names.length,articles:record.manifestIds,backup}));
 }finally{await mini.disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
