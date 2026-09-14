const assert=require('assert');
global.wx={getSystemInfoSync:()=>({windowWidth:375,windowHeight:667,pixelRatio:2}),vibrateShort:()=>{}};
let page;global.Page=p=>page=p;require('../pages/interactive/3d-lab/anechoic/anechoic');
page.data={...page.data};page.setData=p=>Object.assign(page.data,p);
const THREE=require('../pages/interactive/3d-lab/node_modules/threejs-miniprogram').createScopedThreejs({width:375,height:600});
const root=new THREE.Group();require('../pages/interactive/3d-lab/anechoic/chamber-model').buildChamber(THREE,root);
assert.ok(root.userData.absorberCount>300);
root.traverse(o=>{if(o.geometry && o.geometry.attributes && o.geometry.attributes.position) assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});
console.log('PASS chamber geometry and absorber batches');
const realNow=Date.now;let now=0,frame;Date.now=()=>now;
page.canvasNode={requestAnimationFrame:f=>(frame=f,1)};page.controls={update(){}};page.renderer={render(){}};
try{for(const aut of ['horn','dipole','array']){page.state={aut,ang:0,step:7,scan:false,samples:[]};page._scanIndex=0;page.animId=null;page.onScan();page.startAnim();for(let i=0;i<60;i++){now+=100;frame();}assert.equal(page.state.scan,false);assert.equal(page.state.samples.length,52);assert.equal(new Set(page.state.samples).size,52);const e=page.estimate();assert.ok(e.enough);if(aut==='horn')assert.ok(Math.abs(e.hpbw-38.6)<1);if(aut==='dipole')assert.ok(Math.abs(e.hpbw-78)<1);if(aut==='array')assert.ok(e.sll<-10 && e.sll>-20);console.log('PASS',aut,'52-point sweep',e);page.onClear();assert.equal(page.state.samples.length,0);assert.equal(page.estimate().enough,false);}}finally{Date.now=realNow;}
const {registerOrbitControls}=require('../pages/interactive/3d-lab/orbit-controls');registerOrbitControls(THREE);page.THREE=THREE;page.camera=new THREE.PerspectiveCamera(38,1,.1,100);page.camera.position.set(7,5.5,9);page.controls=new THREE.OrbitControls(page.camera,{width:375,height:600});page.onView({currentTarget:{dataset:{view:'top'}}});page.controls.update();assert.ok(page.camera.position.y>13);assert.ok(Math.abs(page.camera.position.x)<.01);console.log('PASS top view survives OrbitControls update');
