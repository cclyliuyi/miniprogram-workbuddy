// Rebuild slider mirrors from the original WXML, preserving conditions and bindings.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const tools=require('../utils/tool-registry').SECTIONS.slice(0,2).flatMap(s=>s.items);
const labels={array:['阵列','扫描'],friis:['发射','接收','距离','灵敏度'],synth:['阵列','旁瓣'],aperture:['口径与照明'],tline:['传输线'],pa:['阵列','扫描'],pol:['幅度','相位'],mom:['结构','线径'],bbm:['结构','扫频'],mini:['尺寸与损耗'],radint:['辐射积分'],smart:['阵列','目标','干扰']};
const start='<!-- floating-controls:start -->',end='<!-- floating-controls:end -->';
function parse(source){
 const stack=[],nodes=[];
 const tokens=/<!--[\s\S]*?-->|<\/?[\w-]+(?:[^>"']|"[^"]*"|'[^']*')*>/g;
 for(const m of source.matchAll(tokens)){
  const text=m[0];if(text.startsWith('<!--'))continue;
  if(text.startsWith('</')){const node=stack.pop();if(node)node.end=m.index+text.length;continue;}
  const node={start:m.index,openEnd:m.index+text.length,open:text,parent:stack[stack.length-1]};nodes.push(node);
  if(text.endsWith('/>'))node.end=node.openEnd;else stack.push(node);
 }
 return nodes;
}
let count=0;
for(const tool of tools){
 const file=path.join(root,tool.url+'.wxml');
 // tool.url begins with '/', path.join keeps the provided workspace prefix.
 let source=fs.readFileSync(file,'utf8');
 if(source.includes('<!-- fd-viewport:content -->')) source=source.split('<!-- fd-viewport:content -->')[1].split('<!-- fd-viewport:close -->')[0].trim();
 source=source.replace('<view class="fd-stage">','').replace('</view><!-- fd-stage:end -->','');
 source=source.replace(new RegExp(start+'[\\s\\S]*?'+end+'\\s*'),'').replace(/<view id="fd-anchor" class="fd-anchor"><\/view>\s*/,'');
 const nodes=parse(source),rows=nodes.filter(n=>/^<view\s/.test(n.open)&&/class="tp-slider-row(?:\s|")/.test(n.open)&&source.slice(n.start,n.end).includes('<slider'));
 if(!rows.length)continue;
 const groups=Math.ceil(rows.length/2);
 const panels=rows.map((n,i)=>{
  let row=source.slice(n.start,n.end),conditions=[];
  row=row.replace(/<slider\b[\s\S]*?\/>/,tag=>{
   const attr=name=>{const m=tag.match(new RegExp(name+'="([^\"]*)"'));return m?m[1]:'';};
   const min=attr('min'),max=attr('max'),value=attr('value'),expr=x=>x.replace(/^{{|}}$/g,'');
   const percent='{{fdActiveId === '+i+' ? fdPercent : (('+expr(value)+')-('+expr(min)+'))/(('+expr(max)+')-('+expr(min)+'))*100}}';
   return '<cover-view id="fd-track-'+i+'" class="fd-native-track" data-id="'+i+'" data-value="'+value+'" data-min="'+min+'" data-max="'+max+'" data-step="'+attr('step')+'" data-disabled="'+attr('disabled')+'" data-changing="'+attr('bindchanging')+'" data-change="'+attr('bindchange')+'" catchtouchstart="fdNativeStart" catchtouchmove="fdNativeMove" catchtouchend="fdNativeEnd" catchtouchcancel="fdNativeEnd"><cover-view class="fd-native-rail"></cover-view><cover-view class="fd-native-fill" style="width:'+percent+'%"></cover-view><cover-view class="fd-native-thumb" style="left:'+percent+'%"></cover-view></cover-view>';
  });
  row=row.replace(/<(\/?)(view|text)(?=[\s>])/g,'<$1cover-view');
  for(let p=n.parent;p;p=p.parent){const cond=p.open.match(/wx:if="(.*?)"/);if(cond)conditions.push(cond[1]);if(/wx:for=|wx:else/.test(p.open))throw Error('Unsupported slider ancestor in '+file);}
  for(const condition of conditions) row='<block wx:if="'+condition+'">'+row+'</block>';
  return '<block wx:if="{{fdGroup === '+Math.floor(i/2)+'}}">'+row+'</block>';
 }).join('\n');
 let anchor=rows[0];while(anchor.parent && !/class="(?:screen)/.test(anchor.parent.open))anchor=anchor.parent;
 source=source.slice(0,anchor.start)+'</view><!-- fd-stage:end --><view id="fd-anchor" class="fd-anchor"></view>\n'+source.slice(anchor.start);
 const head=nodes.find(n=>/class="(?:tp-head|lab3d-head)/.test(n.open));
 if(!head)throw Error('Missing page header '+file);
 source=source.slice(0,head.end)+'<view class="fd-stage">'+source.slice(head.end);
 source=source.replace(/class="screen(?![^\"]*fd-page)/,'class="screen fd-page');
 let panel=`${start}
 <view id="fd-panel" class="fd-panel {{fdVisible ? 'fd-visible' : ''}}" bindtouchstart="fdTouchStart" bindtouchend="fdTouchEnd" bindtouchcancel="fdTouchEnd" catchtouchmove="fdPreventScroll">
  <view class="fd-head"><text class="fd-title">实时调参</text><view class="fd-all" bindtap="fdShowAll">全部参数 ↓</view></view>
  <view class="fd-tabs">${Array.from({length:groups},(_,i)=>`<view class="fd-tab {{fdGroup === ${i} ? 'selected' : ''}}" data-group="${i}" bindtap="fdSelect">${labels[tool.key][i]}</view>`).join('')}</view>
  <view class="fd-controls">${panels}</view>
 </view>
${end}`;
 panel=panel.replace(/<(\/?)(view|text)(?=[\s>])/g,'<$1cover-view').replace('id="fd-panel"','id="fd-panel" hidden="{{!fdVisible}}"');
 const close=source.lastIndexOf('</view>');source=source.slice(0,close)+panel+'\n'+source.slice(close);fs.writeFileSync(file,source);
 const js=file.replace(/\.wxml$/,'.js');let body=fs.readFileSync(js,'utf8');
 if(!body.includes('withFloatingControls')){
  const request=path.relative(path.dirname(js),path.join(root,'utils/lab-canvas')).replace(/\\/g,'/');
  body='const { withFloatingControls } = require(\''+request+'\');\n'+body;
  body=body.replace('Page({','Page(withFloatingControls({');
  const last=body.lastIndexOf('})');body=body.slice(0,last)+'}, '+groups+'))'+body.slice(last+2);fs.writeFileSync(js,body);
 }
 count++;
}
console.log('Built floating controls for '+count+' pages');
