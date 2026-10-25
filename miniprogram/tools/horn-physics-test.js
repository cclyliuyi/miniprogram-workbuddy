const assert = require('assert');
global.wx = { getSystemInfoSync: () => ({windowWidth:375,windowHeight:667,pixelRatio:2}) };
let page;
global.Page = p => { page=p; };
require('../pages/interactive/3d-lab/horn/horn');
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
page.setData=(patch,cb)=>{Object.assign(page.data,patch);if(cb)cb();};
page.state={A:6,B:4,R:8};
const m=page.compute();
close(m.h.phaseDeg,360*6*(6-.75)/(8*8));
close(m.e.phaseDeg,360*4*(4-.375)/(8*8));
close(page.phaseAt(m,0,0),0);
close(page.phaseAt(m,3,2),m.corner);
close(page.phaseAt(m,3,0),m.h.phaseDeg);
close(page.phaseAt(m,0,2),m.e.phaseDeg);
page.state.R=16;
const long=page.compute();
close(long.h.phaseDeg,m.h.phaseDeg/2);
close(long.e.phaseDeg,m.e.phaseDeg/2);
assert.ok(long.gain>m.gain,'longer horn improves this design');
page.state={A:8,B:4,R:8};
const wide=page.compute();
assert.ok(wide.h.phaseDeg>m.h.phaseDeg);
close(wide.e.phaseDeg,m.e.phaseDeg);
for(const mode of ['wrapped','unwrapped']) {
  const old=page.phaseFraction(page.phaseAt(m,1.5,1),mode);
  const changed=page.phaseFraction(page.phaseAt(long,1.5,1),mode);
  assert.notEqual(old,changed,'fixed color mapping responds to length: '+mode);
  assert.notEqual(page.phaseFraction(wide.h.phaseDeg,mode),page.phaseFraction(m.h.phaseDeg,mode));
}
close(page.phaseFraction(30,'wrapped'),page.phaseFraction(390,'wrapped'));
assert.ok(page.phaseFraction(720,'unwrapped')>page.phaseFraction(360,'unwrapped'));
close(page.phaseFraction(180,'unwrapped'),.5);
const n=4096;
close(page.apInt('E',0,6,0,0,n)**2/4,1);
close(page.apInt('H',0,6,0,0,n)**2/2,8/Math.PI**2,1e-6);
for(const R of [2,8,24]) {
  const o=page.optimalDimensions(R);
  for(const plane of ['E','H']) {
    const w=plane==='H'?o.A:o.B;
    const best=w*page.planeModel(plane,w,R).eta;
    for(let i=20;i<=160;i+=2) assert.ok(best+1e-10>=i/10*page.planeModel(plane,i/10,R).eta);
  }
  console.log('Optimal grid dimensions at R='+R, o);
}
for(const [plane,w,R] of [['H',16,2],['E',16,2],['H',5.2,8]]) {
  const x=page.planeModel(plane,w,R);
  for(const st of [0,.5,1]) close(page.apInt(plane,st,w,x.dMax,0,x.N),page.apInt(plane,st,w,x.dMax,0,x.N*2),2e-4);
}
page.state={A:5.2,B:4.2,R:8};
const normal=page.compute();
assert.ok(normal.hpbwE>0 && normal.hpbwH>0);
normal.eDb.forEach((v,i)=>close(v,normal.eDb[180-i],1e-8));
assert.equal(page.hpbwOf([-2,-1,0,1,2],[-5,0,-6,0,-5]),null,'split beam has no axial HPBW');
page.useOptimal();
close(page.state.A,page.optimalDimensions(8).A);
close(page.data.aSlider,page.state.A*10);
assert.equal(page.data.optimalLoss,'0.00 dB');
assert.ok(page.data.apertureDifference.includes('等于最佳口径'));
page.state={A:12,B:4.2,R:8};
page.renderAll();
assert.equal(page.data.hBeam,'近似平顶（浅双峰）');
assert.ok(parseFloat(page.data.optimalLoss)>0);
assert.ok(page.data.apertureDifference.includes('大于最佳'));
for(const [dip,label] of [[.04,'近似平顶（浅双峰）'],[1.5,'双峰趋势'],[4,'明显分裂']]) {
  const sample={ang:[-2,-1,0,1,2],hDb:[-5,0,-dip,0,-5]};
  assert.equal(page.beamReading('H',6,sample).label,label);
}
page.state={A:5.4,B:4.2,R:8};
const reference=page.compute();
const idealRaw=reference.ang.map(deg=>{
  const th=deg*Math.PI/180;
  return (1+Math.cos(th))/2*page.apInt('H',Math.sin(th),5.4,0,0,256);
});
const idealMax=Math.max(...idealRaw);
const idealDb=idealRaw.map(v=>20*Math.log10(Math.max(v/idealMax,1e-6)));
const idealWidth=page.hpbwOf(reference.ang,idealDb);
assert.equal(page.beamReading('H',5.4,{ang:reference.ang,hDb:idealDb,hpbwH:idealWidth}).label,'轴向单峰');
assert.equal(page.beamReading('H',5.4,{ang:reference.ang,hDb:idealDb,hpbwH:idealWidth*1.3}).label,'轴向单峰 · 展宽');
assert.ok(!JSON.stringify(page.data).includes('NaN'));
// Verify actual uploaded vertex colors, so a later per-image normalization
// in layout3d cannot pass solely by keeping phaseFraction correct.
const THREE=require('../pages/interactive/3d-lab/node_modules/threejs-miniprogram').createScopedThreejs({width:375,height:340});
page.THREE=THREE;page.hornGroup=new THREE.Group();page.phaseGroup=new THREE.Group();
for(const mode of ['wrapped','unwrapped']) {
  page.data.phaseMode=mode;
  page.state={A:5.2,B:4.2,R:8};page.layout3d(page.compute());
  const before=Array.from(page.phaseGroup.children[0].geometry.attributes.color.array);
  page.state.R=16;page.layout3d(page.compute());
  const after=Array.from(page.phaseGroup.children[0].geometry.attributes.color.array);
  assert.equal(before.length,after.length);
  assert.ok(before.some((v,i)=>Math.abs(v-after[i])>.05),'visible vertex colors change: '+mode);
  assert.ok(after.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
}
console.log('PASS horn phase, fixed color scale, TE10 efficiency, grid optimum, integration convergence, symmetry and UI');
