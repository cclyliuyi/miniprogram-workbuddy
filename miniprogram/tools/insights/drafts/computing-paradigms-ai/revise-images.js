const fs=require('fs');
const path=require('path');
const sharp=require('../../../../tools/node_modules/sharp');
const assets=path.join(__dirname,'assets');
const originals='C:/Users/Administrator/.codex/generated_images/01a1615e-18c3-7b61-9f6f-1fe1ab5ca3b3';
const files=[
 ['03-software-ecosystem.webp','exec-e314f389-948e-401e-87a6-5a142199ae28.png'],
 ['04-analog-visual-v2.webp','exec-7081723e-fceb-4369-b229-cc3cc6c4d6db.png'],
 ['05-interference.webp','exec-82acea6c-71c4-4c52-946a-6361b8bface9.png'],
 ['06-quantum-loop-visual-v3.webp','exec-df4dba6f-0054-4e31-99f2-172f6f958eb1.png'],
 ['07-hybrid-future.webp','exec-48ad165c-42bd-4897-9485-edb141a2098f.png']
];
(async()=>{
 const metadata=JSON.parse(fs.readFileSync(path.join(assets,'metadata.json'),'utf8')).slice(0,2);
 for(const [name,source] of files){
  const target=path.join(assets,name);
  const info=await sharp(path.join(originals,source)).webp({quality:86}).toFile(target);
  metadata.push({name,width:info.width,height:info.height,bytes:info.size});
 }
 fs.writeFileSync(path.join(assets,'metadata.json'),JSON.stringify(metadata,null,2));
 console.log(JSON.stringify(metadata));
})().catch(e=>{console.error(e);process.exitCode=1});
