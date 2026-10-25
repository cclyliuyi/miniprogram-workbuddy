const fs=require('fs'),path=require('path');
const sharp=require('../../../../tools/node_modules/sharp');
const assets=path.join(__dirname,'assets');
const originals='C:/Users/Administrator/.codex/generated_images/01a1615e-18c3-7b61-9f6f-1fe1ab5ca3b3';
const files=[
 ['05-reservoir-flow.webp','exec-a8e5f9d7-e9e6-4180-997a-96747d537033.png'],
 ['06-reservoir-memory.webp','exec-ddee54df-113a-4f7a-aaa0-17943fcdc596.png'],
 ['09-algorithm-shift.webp','exec-644aad7f-9df2-45cb-a381-7f952fabc9d7.png'],
 ['10-gpu-cim-forecast.webp','exec-95b3dd08-75d4-40cc-bb22-1fd19195e0c2.png']
];
(async()=>{
 const before=JSON.parse(fs.readFileSync(path.join(assets,'metadata.json'),'utf8'));
 const backup=path.join(__dirname,'history','illustrations-'+Date.now());fs.mkdirSync(backup,{recursive:true});
 for(const name of ['render-shared.py','replace-content.py','verify-replacement.py','article.html','publication.json','replacement-notes.md'])fs.copyFileSync(path.join(__dirname,name),path.join(backup,name));
 fs.copyFileSync(path.join(assets,'metadata.json'),path.join(backup,'metadata.json'));
 fs.copyFileSync(path.join(__dirname,'../../dist/articles/computing-paradigms-ai.json'),path.join(backup,'article.json'));
 fs.writeFileSync(path.join(__dirname,'active-image-backup.txt'),backup);
 const added=[];
 for(const [name,source] of files){const info=await sharp(path.join(originals,source)).webp({quality:86}).toFile(path.join(assets,name));added.push({name,width:info.width,height:info.height,bytes:info.size});}
 const metadata=[...before.slice(0,4),...added.slice(0,2),before.find(m=>m.name==='05-interference.webp'),before.find(m=>m.name==='06-quantum-loop-visual-v3.webp'),...added.slice(2)];
 if(metadata.some(m=>!m))throw Error('Missing previous illustration');
 fs.writeFileSync(path.join(assets,'metadata.json'),JSON.stringify(metadata,null,2));
 console.log(JSON.stringify({backup,images:metadata}));
})().catch(e=>{console.error(e);process.exitCode=1});
