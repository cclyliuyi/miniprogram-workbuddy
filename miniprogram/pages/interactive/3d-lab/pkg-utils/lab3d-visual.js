// Shared visual primitives, compatible with threejs-miniprogram r108.
const { mixHex } = require('./lab-theme');
const HEAT = ['#253494','#167ac6','#22bfd0','#58ce8a','#d9e85b','#ffbf3f','#f46d32','#c9283e'];
function heatColor(t) {
  const x=Math.max(0,Math.min(1,t))*(HEAT.length-1),i=Math.min(HEAT.length-2,Math.floor(x));
  return mixHex(HEAT[i],HEAT[i+1],x-i);
}
function rod(T,parent,a,b,r,color) {
  const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
  const mesh=new T.Mesh(new T.CylinderGeometry(r,r,delta.length(),12),new T.MeshStandardMaterial({color,metalness:.5,roughness:.4}));
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());parent.add(mesh);return mesh;
}
function rim(T,parent,points,r,color) { for(let i=0;i<points.length;i++)rod(T,parent,points[i],points[(i+1)%points.length],r,color); }
function heatGeometry(T,geo,values) {
  const colors=[];
  values.forEach(v=>{const c=new T.Color(heatColor(v));colors.push(c.r,c.g,c.b);});
  geo.addAttribute('color',new T.Float32BufferAttribute(colors,3));
}
// Fit the visible scene, including changed parameter geometry, to the current viewport.
function fitView(page,mode) {
  const T=page.THREE,c=page.controls,camera=page.camera;
  if(!T||!c||!camera||!page.scene)return;
  page.scene.updateMatrixWorld(true);
  const box=new T.Box3();
  page.scene.traverseVisible(o=>{
    if(!o.geometry || o.userData.excludeFromFit)return;
    o.geometry.computeBoundingBox();
    if(o.geometry.boundingBox)box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  if(box.isEmpty())return;
  const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  const radius=Math.max(size.length()*.5,.1);
  const target=c.target||c._target;
  if(!page._visualDirection)page._visualDirection=camera.position.clone().sub(target).normalize();
  const direction=mode==='front'?new T.Vector3(0,.001,1):mode==='top'?new T.Vector3(0,1,.001):page._visualDirection.clone();
  direction.normalize();
  const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize();
  const up=new T.Vector3().crossVectors(direction,right).normalize();
  const tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;
  let distance=radius;
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const corner=new T.Vector3(x*size.x/2,y*size.y/2,z*size.z/2);
    distance=Math.max(distance,Math.abs(corner.dot(right))/tanX+corner.dot(direction),Math.abs(corner.dot(up))/tanY+corner.dot(direction));
  }
  distance*=1.14;
  target.copy(center);camera.position.copy(center).add(direction.multiplyScalar(distance));
  c._targetSpherical.setFromVector3(camera.position.clone().sub(center));c._spherical.copy(c._targetSpherical);
  c.minDistance=radius*.4;c.maxDistance=distance*3;
  camera.near=Math.max(.001,radius/1000);camera.far=Math.max(200,distance*6);camera.updateProjectionMatrix();
  c.autoRotate=false;c.update();
  page.setData({labView:mode||'perspective',autoRotate:false});
}
module.exports={heatColor,rod,rim,heatGeometry,fitView};
