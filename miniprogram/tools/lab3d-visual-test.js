const assert=require('assert');
require('./sync-subpackage-utils').sync({check:true});
global.wx={getSystemInfoSync:()=>({windowWidth:375,windowHeight:667,pixelRatio:2}),vibrateShort(){}};
const stage=require('../utils/lab3d-stage'),visual=require('../utils/lab3d-visual'),lc=require('../utils/lab-canvas');
lc.mount=()=>{};
for(const pkg of ['3d-lab','radiation-3d'])require('../pages/interactive/'+pkg+'/pkg-utils/lab-canvas').mount=lc.mount;
const names=['horn','loop','microstrip','parabolic','phased-array','planar-array','array-synthesis','polarization','traveling-wave','radiation-3d'];
for(const name of names){
 let p;global.Page=o=>p=o;
 const prefix=name==='radiation-3d'?'../pages/interactive/radiation-3d/':'../pages/interactive/3d-lab/'+name+'/';
 require(prefix+name);p.data=JSON.parse(JSON.stringify(p.data));p.state=JSON.parse(JSON.stringify(p.state));
 p.setData=patch=>{for(const [key,value] of Object.entries(patch)){const parts=key.split('.');let obj=p.data;for(const k of parts.slice(0,-1))obj=obj[k];obj[parts[parts.length-1]]=value;}};
 p.startAnim=()=>{};p.createSelectorQuery=()=>{};
 const canvas={width:375,height:340};
 const THREE=require('../pages/interactive/3d-lab/node_modules/threejs-miniprogram').createScopedThreejs(canvas);
 const env={THREE,canvas,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(42,375/340,.01,200),renderer:{render(){},dispose(){}},dispose(){}};env.camera.position.set(3,2,3);
 const shim=require(name==='radiation-3d'?prefix+'lab3d-stage':'../pages/interactive/3d-lab/lab3d-stage');
 shim.initThree=(page,selector,opts)=>opts.onReady(env);
 if(name==='radiation-3d')p.initScene();else p.initThree();
 assert.equal(p.data.glReady,true,name+' ready');
 function check(){
  p.scene.traverse(o=>{
   const g=o.geometry;if(!g)return;
   if(g.attributes&&g.attributes.position)assert.ok([...g.attributes.position.array].every(Number.isFinite),name+' positions');
   if(g.attributes&&g.attributes.color){assert.ok([...g.attributes.color.array].every(Number.isFinite));if(name!=='parabolic'||p.state.show.phase)assert.equal(o.material.vertexColors,THREE.VertexColors,name+' color mode');}
  });
  for(const mode of ['perspective','front','top']){visual.fitView(p,mode);p.controls.update();assert.ok(p.camera.position.toArray().every(Number.isFinite),name+' camera');const target=p.controls.target||p.controls._target;assert.ok(target.distanceTo(p.camera.position)>0);}
 }
 check();
 if(name==='horn'){p.state.A=16;p.state.R=2;p.renderAll();assert.equal(p.compute().ang.length,181);}
 if(name==='loop'){p.state.a=.05;p.layout();p.updateStats();}
 if(name==='microstrip'){p.state.f=1;p.state.er=2.2;p.renderAll();const id=p.patch.geometry.uuid;p.state.inset=.2;p.renderAll();assert.equal(p.patch.geometry.uuid,id,'patch geometry reused');}
 if(name==='parabolic'){p.state.dz=.2;p.state.show.phase=true;p.renderAll();}
 if(name==='phased-array'){p.state.N=16;p.state.d=1;p.state.beta=90;p.rebuildElements();p.updatePattern();}
 if(name==='planar-array'){p.state.N=16;p.rebuildFace(16);p.setTaper('hamming');p.state.theta=45;p.update();assert.equal(p.patches.length,256);}
 if(name==='array-synthesis'){p.state.N=20;p.state.method='taylor';p.renderAll();}
 if(name==='polarization'){p.state.del=-90;p.layout();p.t=0;p.updateVectors();const a=p._waveLines[2].geometry.attributes.position.array.slice();p.t=1;p.updateVectors();assert.ok(a.some((v,i)=>Math.abs(v-p._waveLines[2].geometry.attributes.position.array[i])>1e-6));}
 if(name==='traveling-wave'){p.state.geo='v';p.state.L=8;p.renderStatic();}
 if(name==='radiation-3d'){p.state.type='custom';p.state.hl=2;p.buildPattern();p.refreshStats();}
 check();p.dispose();stage.clearTimers(p);console.log('PASS',name,'geometry, colors, parameter rebuild and 3 views');
}
const T=require('../pages/interactive/3d-lab/node_modules/threejs-miniprogram').createScopedThreejs({width:1,height:1});const root=new T.Group(),child=new T.Group(),geo=new T.BoxGeometry(1,1,1),mat=new T.MeshBasicMaterial();let ng=0,nm=0;geo.dispose=()=>ng++;mat.dispose=()=>nm++;child.add(new T.Mesh(geo,mat),new T.Mesh(geo,mat));root.add(child);stage.clearGroup(root);assert.equal(ng,1);assert.equal(nm,1);assert.equal(child.parent,null);console.log('PASS nested and shared geometry disposal');


