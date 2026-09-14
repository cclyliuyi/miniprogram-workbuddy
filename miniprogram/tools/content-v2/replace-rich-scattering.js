// Replace the explicitly corrected illustration using a new cloud filename.
const fs=require('fs'),path=require('path'),os=require('os'),sharp=require('sharp');
const automator=require('C:/Users/Administrator/AppData/Local/Temp/codex-wx-debug/node_modules/miniprogram-automator');
const revision=require('./rich-scattering-revision.json');
async function main(){
  const original=path.join(__dirname,'originals/e07.png');
  const webp=path.join(__dirname,'webp/e07.webp');
  fs.copyFileSync(revision.source,original);
  await sharp(original).webp({quality:88}).toFile(webp);
  const manifestPath=path.join(__dirname,'generated-manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  manifest.find(x=>x.key==='e07').source=revision.source;
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  const promptPath=path.join(__dirname,'prompts.json');
  const prompts=JSON.parse(fs.readFileSync(promptPath,'utf8'));
  prompts.find(x=>x.key==='e07').prompt=revision.prompt;
  fs.writeFileSync(promptPath,JSON.stringify(prompts,null,2));
  await new Promise(resolve=>setTimeout(resolve,5000));
  const m=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
  try{
    await m.reLaunch('/pages/eit/eit');
    const result=await m.evaluate(async(data,cloudPath)=>{
      const filePath=wx.env.USER_DATA_PATH+'/e07-rich-scattering.webp';
      wx.getFileSystemManager().writeFileSync(filePath,data,'base64');
      try{return await wx.cloud.uploadFile({cloudPath,filePath});}
      finally{wx.getFileSystemManager().unlinkSync(filePath);}
    },fs.readFileSync(webp).toString('base64'),revision.cloudPath);
    if(!result.fileID)throw new Error('Upload returned no fileID');
    const uploadedPath=path.join(__dirname,'uploaded.json');
    const uploaded=JSON.parse(fs.readFileSync(uploadedPath,'utf8'));
    Object.assign(uploaded.find(x=>x.key==='e07'),{fileID:result.fileID,bytes:fs.statSync(webp).size});
    const value=JSON.stringify(uploaded,null,2);
    fs.writeFileSync(path.join(os.tmpdir(),'codex-content-v2-uploaded.json'),value);
    fs.writeFileSync(uploadedPath,value);
    console.log('Corrected e07 uploaded: '+result.fileID);
  }finally{m.disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
