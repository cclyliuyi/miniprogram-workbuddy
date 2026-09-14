// Keep one editable source in utils/, ship only the copies needed by each subpackage.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const shared=['rf-math','lab-canvas','lab-theme','lab3d-stage','lab3d-visual','lab3d-plots'];
const app=require('../app.json');
const deps=/require\(\s*(['"])([^'"]+)\1\s*\)/g;
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>['node_modules','miniprogram_npm','pkg-utils'].includes(e.name)?[]:e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.js')?[path.join(dir,e.name)]:[]);}
function sync({check=false}={}){
 const pending=[],needed=new Map();
 function write(file,body){if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===body)return;pending.push(path.relative(root,file));if(!check){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}}
 function add(pkg,name){const set=needed.get(pkg)||new Set();needed.set(pkg,set);if(set.has(name))return;set.add(name);
  const body=fs.readFileSync(path.join(root,'utils',name+'.js'),'utf8');
  for(const m of body.matchAll(deps)){const key=m[2].replace(/^\.\//,'').replace(/\.js$/,'');if(shared.includes(key))add(pkg,key);}
 }
 for(const file of files(path.join(root,'pages'))){
  const relative=path.relative(root,file).replace(/\\/g,'/');
  const pkg=app.subPackages.find(p=>relative.startsWith(p.root+'/'));
  const body=fs.readFileSync(file,'utf8');
  const next=body.replace(deps,(full,quote,request)=>{
   if(!request.startsWith('.'))return full;
   const resolved=path.relative(root,path.resolve(path.dirname(file),request)).replace(/\\/g,'/').replace(/\.js$/,'');
   let name=shared.find(n=>resolved==='utils/'+n);
   if(!name && pkg)name=shared.find(n=>resolved===pkg.root+'/pkg-utils/'+n);
   if(!name)return full;
   if(!pkg)throw Error('Main package unexpectedly imports '+name+' in '+relative);
   add(pkg.root,name);
   let target=path.relative(path.dirname(file),path.join(root,pkg.root,'pkg-utils',name)).replace(/\\/g,'/');if(!target.startsWith('.'))target='./'+target;
   return 'require('+quote+target+quote+')';
  });
  write(file,next);
 }
 for(const [pkg,names] of needed)for(const name of names)write(path.join(root,pkg,'pkg-utils',name+'.js'),fs.readFileSync(path.join(root,'utils',name+'.js'),'utf8'));
 const configPath=path.join(root,'project.config.json'),config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 for(const name of shared){const value='utils/'+name+'.js';if(!config.packOptions.ignore.some(x=>x.type==='file'&&x.value===value))config.packOptions.ignore.push({type:'file',value});}
 const current=JSON.parse(fs.readFileSync(configPath,'utf8'));if(JSON.stringify(current)!==JSON.stringify(config))write(configPath,JSON.stringify(config,null,2)+'\n');
 if(check&&pending.length)throw Error('Subpackage layout is stale; run node tools/sync-subpackage-utils.js\n'+pending.join('\n'));
 return {packages:needed.size,copies:[...needed.values()].reduce((n,s)=>n+s.size,0),changed:pending.length};
}
module.exports={sync};
if(require.main===module){try{console.log(sync({check:process.argv.includes('--check')}));}catch(e){console.error(e.message);process.exitCode=1;}}
