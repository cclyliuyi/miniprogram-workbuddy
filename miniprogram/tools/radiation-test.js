const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),app=require('../app.json'),seen=new Set();
function owner(f){return app.subPackages.find(p=>f.startsWith(p.root+'/'))?.root||'main'}
function check(file){if(seen.has(file))return;seen.add(file);const source=fs.readFileSync(path.join(root,file),'utf8');for(const [,dep] of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)){if(!dep.startsWith('.'))continue;let target=path.posix.normalize(path.posix.join(path.posix.dirname(file),dep));if(!target.endsWith('.js'))target+='.js';const from=owner(file),to=owner(target);assert.ok(to==='main'||to===from,`${file} illegally imports sibling package: ${target}`);check(target)}}
check('pages/interactive/radiation-3d/radiation-3d.js');
console.log('PASS radiation package dependency boundary');
// 使用项目安装的 Three.js 构建真实几何，验证方向图与物理读数。
global.wx={getSystemInfoSync:()=>({windowWidth:375,windowHeight:667,pixelRatio:2})};
let page;global.Page=p=>page=p;require('../pages/interactive/radiation-3d/radiation-3d');
page.data=JSON.parse(JSON.stringify(page.data));page.state={...page.state};page.setData=patch=>Object.assign(page.data,patch);
page.THREE=require('../pages/interactive/radiation-3d/node_modules/threejs-miniprogram').createScopedThreejs({width:375,height:600});
page.scene=new page.THREE.Scene();
for(const type of ['isotropic','short','halfwave','fullwave','custom']){
 page.state.type=type;page.buildPattern();page.refreshStats();
 const positions=page.patMesh.geometry.attributes.position.array;
 assert.equal(page.patMesh.material.vertexColors,page.THREE.VertexColors);
 const colors=page.patMesh.geometry.attributes.color.array;
 assert.ok([...colors].every(Number.isFinite));
 if(type==='halfwave'){
   assert.ok(colors[2]>colors[0], '零辐射点应为冷蓝色');
   const peak=40*3;assert.ok(colors[peak]>colors[peak+2], '峰值应为暖红色');
 }
 assert.ok(positions.length>1000);assert.ok([...positions].every(Number.isFinite));
 assert.ok(Number.isFinite(Number(page.data.stats.D)));
 if(type==='halfwave'){assert.ok(Math.abs(Number(page.data.stats.dbi)-2.15)<0.03);assert.ok(Math.abs(parseFloat(page.data.stats.Rr)-73.1)<0.2)}
}
console.log('PASS actual Three.js surfaces and half-wave reference values');
const stage=require('../utils/lab3d-stage');
const host={createSelectorQuery:()=>({select(){return this},fields(){return this},exec(fn){fn([{node:{},width:300,height:300}])}})};
(async()=>{
 let reported=false;
 await assert.rejects(stage.initThree(host,'#canvas',{createScopedThreejs:()=>{throw Error('WebGL unavailable')},onError:()=>{reported=true}}));
 assert.ok(reported);console.log('PASS WebGL initialization failure reaches error handler');
})().catch(e=>{console.error(e);process.exitCode=1});
