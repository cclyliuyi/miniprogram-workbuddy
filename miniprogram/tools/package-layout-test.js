const fs=require('fs'),path=require('path'),assert=require('assert');const root=path.resolve(__dirname,'..'),app=require('../app.json'),config=require('../project.config.json');
require('./sync-subpackage-utils').sync({check:true});
const ignored=file=>config.packOptions.ignore.some(x=>x.type==='file'?file===x.value:x.type==='folder'&&(file===x.value||file.startsWith(x.value+'/')));
const owner=file=>app.subPackages.find(p=>file.startsWith(p.root+'/'))?.root||'main';const seen=new Set();
function check(file){if(seen.has(file))return;seen.add(file);assert.ok(!ignored(file),'Runtime depends on excluded source '+file);const content=fs.readFileSync(path.join(root,file),'utf8');
 for(const [,dep] of content.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'').matchAll(/require\(['"]([^'"]+)['"]\)/g)){if(!dep.startsWith('.'))continue;let target=path.posix.normalize(path.posix.join(path.posix.dirname(file),dep));if(!path.posix.extname(target))target+='.js';assert.ok(fs.existsSync(path.join(root,target)),file+' missing '+target);assert.ok(owner(target)==='main'||owner(target)===owner(file),file+' imports another subpackage: '+target);if(target.endsWith('.js'))check(target);}
}
check('app.js');for(const page of app.pages)check(page+'.js');for(const pkg of app.subPackages)for(const page of pkg.pages)check(pkg.root+'/'+page+'.js');
console.log('PASS '+seen.size+' runtime JS files: no missing, excluded, or sibling-package dependencies');

