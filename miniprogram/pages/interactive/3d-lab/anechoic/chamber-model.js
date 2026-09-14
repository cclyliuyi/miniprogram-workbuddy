// Cutaway teaching model. Dimensions are illustrative, not a chamber design.
function buildChamber(THREE, root) {
  const material = (color, metalness=0, roughness=.8) => new THREE.MeshStandardMaterial({color,metalness,roughness});
  const shell=material(0xb6bfc3,.35,.48), dark=material(0x25384a), floor=material(0x334756);
  const metal=material(0xc4cbd0,.65,.32), teal=material(0x348e99,.2,.45);
  const box=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);root.add(m);return m;};
  box(6.4,.18,3.9,0,-.15,0,shell);
  box(6.15,.08,3.65,0,-.025,0,floor);
  box(6.4,2.35,.12,0,1.09,-1.9,shell);
  box(.12,2.35,3.8,-3.15,1.09,0,shell);
  box(6.2,2.18,.05,0,1.07,-1.8,dark);
  box(.05,2.18,3.7,-3.06,1.07,0,dark);
  // Shared buffers: hundreds of pyramidal absorbers in three draw calls.
  const batches=[[],[],[]];
  let count=0;
  function pyramid(center,u,v,n,size,height){
    const p=(a,b,c)=>center.map((x,i)=>x+a*u[i]+b*v[i]+c*n[i]);
    const s=size/2, corners=[p(-s,-s,0),p(s,-s,0),p(s,s,0),p(-s,s,0)], tip=p(0,0,height);
    const vertices=batches[count++%3];
    for(let i=0;i<4;i++)vertices.push(...corners[i],...corners[(i+1)%4],...tip);
  }
  for(let col=0;col<24;col++)for(let row=0;row<8;row++)
    pyramid([-2.92+col*.25,.13+row*.26,-1.765],[1,0,0],[0,1,0],[0,0,1],.242,.30);
  for(let col=0;col<14;col++)for(let row=0;row<8;row++)
    pyramid([-3.025,.13+row*.26,-1.55+col*.25],[0,0,1],[0,1,0],[1,0,0],.242,.30);
  for(let col=0;col<23;col++)for(let row=0;row<12;row++){
    const x=-2.7+col*.25,z=-1.45+row*.25;
    if(Math.abs(z)<.68)continue; // removable absorber strip shown as an access corridor
    pyramid([x,.02,z],[1,0,0],[0,0,1],[0,1,0],.24,.23);
  }
  batches.forEach((vertices,i)=>{
    const geo=new THREE.BufferGeometry();geo.addAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
    const mat=material([0x29435b,0x34526b,0x3e5f78][i]);mat.side=THREE.DoubleSide;
    const mesh=new THREE.Mesh(geo,mat);mesh.name='absorber-panel-'+i;root.add(mesh);
  });
  // Visible cut edges and a removable low-scattering access deck.
  box(6.4,.045,.065,0,2.27,-1.91,metal);
  box(.065,.045,3.8,-3.16,2.27,0,metal);
  box(5.7,.045,1.22,.04,.04,0,material(0x9caab0,.15,.72));
  for(let x=-2.65;x<2.9;x+=.7)box(.008,.003,1.18,x,.064,0,floor);
  // Fixed source pedestal, independent of the AUT rotary positioner.
  const cylinder=(r,h,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),mat);m.position.set(x,y,z);root.add(m);};
  cylinder(.22,.09,-2.57,.11,.05,dark);
  cylinder(.042,.70,-2.57,.50,.05,metal);
  box(.30,.08,.21,-2.50,.82,.05,metal);
  // Measurement axis; fixed source and rotary AUT share the same height.
  const axis=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.57,.88,.05),new THREE.Vector3(1.35,.88,.05)]);
  const line=new THREE.Line(axis,new THREE.LineDashedMaterial({color:0x43b7c0,dashSize:.11,gapSize:.07,transparent:true,opacity:.75}));
  line.computeLineDistances();line.name='measurement-axis';root.add(line);
  // Quiet-zone outline: a visual boundary, not a field simulation.
  const zone=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.48,1.22,1.48)),new THREE.LineBasicMaterial({color:0x58adb1,transparent:true,opacity:.30}));
  zone.position.set(1.35,.92,.05);root.add(zone);
  // Small controller outside the test volume, with screen and rotary knob.
  box(.69,.37,.37,-2.18,.21,1.74,dark);
  box(.43,.22,.014,-2.27,.23,1.935,material(0x112c39));
  box(.34,.012,.017,-2.27,.22,1.947,teal);
  const knob=new THREE.Mesh(new THREE.CylinderGeometry(.046,.046,.025,24),metal);knob.rotation.x=Math.PI/2;knob.position.set(-1.96,.24,1.955);root.add(knob);
  const cablePts=[[-2.57,.15,.05],[-2.73,.10,.42],[-2.85,.09,.95],[-2.7,.07,1.48],[-2.18,.07,1.6]].map(p=>new THREE.Vector3(...p));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts),24,.016,6,false),dark));
  root.userData.absorberCount=count;
}
module.exports={buildChamber};
