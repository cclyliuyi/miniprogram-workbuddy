// Preserve meaningful inline SVG charts as high-resolution images before parsing.
// Decorative SVG icons and canvas animations are not article figures.
const sharp = require('sharp');
const { parseDocument, DomUtils } = require('htmlparser2');
const serialize = require('dom-serializer').default;
const fs = require('fs');
async function rasterizeCharts(html) {
  const doc = parseDocument(html, { decodeEntities:true });
  const styles = DomUtils.getElementsByTagName('style',doc.children,true).map(n=>DomUtils.textContent(n)).join('\n');
  const vars = {};
  for (const block of [styles.match(/:root\s*\{([^}]+)\}/)?.[1], styles.match(/\[data-theme="light"\]\s*\{([^}]+)\}/)?.[1]]) {
    for (const m of (block||'').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]]=m[2].trim();
  }
  const resolve = s=>s.replace(/var\(--([\w-]+)(?:,\s*([^)]*))?\)/g,(_,key,fallback)=>vars[key]||fallback||'#857b68');
  const containers = DomUtils.getElementsByTagName('div',doc.children,true).filter(n=>(n.attribs.class||'').split(/\s+/).includes('chart-box'));
  for (const box of containers) {
    const svg = DomUtils.getElementsByTagName('svg',box.children,true)[0];
    if (!svg || !(svg.attribs.role==='img' || svg.attribs['aria-label'])) continue;
    const classes = new Set(DomUtils.findAll(n=>!!n.attribs?.class,[svg]).flatMap(n=>n.attribs.class.split(/\s+/)));
    const rules=[];
    for (const m of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors=m[1].trim().split(',').map(s=>s.trim()).filter(s=>/^\.[\w.-]+$/.test(s)&&s.slice(1).split('.').every(c=>classes.has(c)));
      if (selectors.length) rules.push(selectors.join(',')+'{'+resolve(m[2])+'}');
    }
    const view=(svg.attribs.viewBox||svg.attribs.viewbox||'0 0 340 196').split(/\s+/).map(Number);
    const [width,height]=view.slice(2);
    if (!(width>0&&height>0)) throw Error('Invalid SVG chart dimensions');
    let source=serialize(svg,{xmlMode:true});
    source=source.replace(/viewbox=/g,'viewBox=').replace(/lineargradient/g,'linearGradient');
    source=source.replace('<svg ',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" color="${vars['ink-3']||'#857b68'}" `);
    source=source.replace(/(<svg[^>]*>)/,`$1<style>text{font-family:"Microsoft YaHei","Noto Sans CJK SC",sans-serif}${rules.join('\n')}</style>`);
    // The source label extends past the right viewBox edge; retain all its text.
    source=source.replace(/(<text\b[^>]*class="chart-lb gold"[^>]*x=")238("[^>]*>)/,'$1326$2');
    source=source.replace(/(<text\b[^>]*class="chart-lb gold")/,'$1 text-anchor="end"');
    source=source.replace(/(<text\b[^>]*class="chart-lb gold"[^>]*y=")40("[^>]*>)/,'$175$2');
    const png=await sharp(Buffer.from(resolve(source)),{density:288}).flatten({background:vars.surface||'#ffffff'}).png().toBuffer();
    const caption=DomUtils.getElementsByTagName('p',box.children,true).find(n=>(n.attribs.class||'').includes('chart-cap'));
    const label=caption?DomUtils.textContent(caption):svg.attribs['aria-label'];
    const safe=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const replacement=parseDocument(`<figure class="converted-svg-chart"><img src="data:image/png;base64,${png.toString('base64')}" width="${width*4}" height="${height*4}" alt="${safe(svg.attribs['aria-label']||label)}"><figcaption>${safe(label)}</figcaption></figure>`).children[0];
    DomUtils.replaceElement(box,replacement);
  }
  return containers.length ? serialize(doc,{decodeEntities:true}) : html;
}
module.exports={rasterizeCharts};
if(require.main===module) rasterizeCharts(fs.readFileSync(0,'utf8')).then(html=>process.stdout.write(html)).catch(e=>{console.error(e);process.exitCode=1;});
