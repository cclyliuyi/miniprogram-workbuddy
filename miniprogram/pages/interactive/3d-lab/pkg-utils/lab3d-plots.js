// Compact polar scale for phone screens: clockwise angles, normalized dB radius.
function polarGrid(ctx,cx,cy,r) {
  const point=(a,s)=>[cx+Math.sin(a*Math.PI/180)*s,cy-Math.cos(a*Math.PI/180)*s];
  ctx.save();ctx.font='11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(let a=0;a<360;a+=30){
    const p=point(a,r),label=point(a,r+18);
    ctx.strokeStyle=a%90===0?'#a2b0b7':'#dfe5e6';ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(...p);ctx.stroke();
    ctx.fillStyle='#526775';ctx.fillText(a+'°',...label);
  }
  for(const db of [-20,-10,0]){
    const rr=r*(1+db/30),p=point(135,rr);
    ctx.strokeStyle=db===0?'#93a5ae':'#d4dde0';ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fbf9f4';ctx.fillRect(p[0]-19,p[1]-7,38,14);ctx.fillStyle='#526775';ctx.fillText(db+' dB',...p);
  }
  ctx.restore();
}
module.exports={polarGrid};
