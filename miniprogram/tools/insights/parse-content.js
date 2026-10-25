// Parse HTML as a tree: nested cards/lists must not be flattened by regex.
const { parseDocument } = require('htmlparser2');
const OMIT = new Set(['script', 'style', 'header', 'nav', 'footer', 'canvas', 'button', 'svg']);
const text = n => !n || OMIT.has(n.name) ? '' : n.type === 'text' ? n.data : n.name === 'br' ? '\n' : (n.children || []).map(text).join('');
const classes = n => (n.attribs && n.attribs.class || '').split(/\s+/);
function find(n, predicate) {
  if (predicate(n)) return n;
  for (const c of n.children || []) { const found = find(c, predicate); if (found) return found; }
}
// Only emit a small inline allowlist. No source styles, event handlers or scripts.
function inline(n) {
  if (n.type === 'text') return [{ type: 'text', text: n.data }];
  if (OMIT.has(n.name)) return [];
  if (n.name === 'br') return [{ name: 'br', attrs: {}, children: [] }];
  const children = (n.children || []).flatMap(inline);
  const styles = { strong: 'font-weight:700;color:#1f3a5c;', b: 'font-weight:700;color:#1f3a5c;', em: 'font-style:italic;', mark: 'background-color:#eee1b9;font-weight:700;', code: 'font-family:monospace;', sub: 'vertical-align:sub;font-size:80%;', sup: 'vertical-align:super;font-size:80%;' };
  let style = styles[n.name] || '';
  // Source classes carry editorial meaning; translate them to supported inline styles.
  if (classes(n).includes('gold-t')) style += 'color:#8f6a1c;font-weight:700;';
  if (classes(n).includes('hl')) style += 'background-color:#eee1b9;color:#283b4b;font-weight:700;border-radius:2px;';
  if (style) return [{ name: 'span', attrs: { style }, children }];
  return children;
}
function parseContent(html, images = []) {
  const doc = parseDocument(html, { decodeEntities: true });
  const blocks = [], toc = [];
  let skippedSvg = 0;
  const heroNode = find(doc, n => classes(n).includes('hero'));
  const field = c => text(find(heroNode || {}, n => classes(n).includes(c))).trim();
  const hero = heroNode ? { kicker: field('kicker'), title: text(find(heroNode, n => n.name === 'h1')).trim(), subtitle: field('hero-sub'), cover: '' } : null;
  function image(n) {
    const match = text(n).match(/__IMG_(\d+)__/);
    if (match && images[Number(match[1])]) blocks.push({ t: 'image', ...images[Number(match[1])], caption: text(find(n, c => c.name === 'figcaption')).trim().replace(/(FIG\.\s*\d+)(?=[^\d\s])/, '$1 · ') });
    else if (find(n, c => c.name === 'blockquote')) {
      const quote = find(n, c => c.name === 'blockquote');
      blocks.push({ t: 'quote', kind: 'definition', text: text(quote).trim(), nodes: inline(quote), credit: text(find(n, c => c.name === 'figcaption')).trim() });
    }
    else if (find(n, c => c.name === 'svg')) skippedSvg++;
  }
  function walk(n) {
    if (n === heroNode || OMIT.has(n.name)) return;
    const cls = classes(n);
    if (cls.includes('sec-kicker')) {
      blocks.push({ t: 'section-label', label: text(find(n, c => classes(c).includes('sec-cn'))).trim(), english: text(find(n, c => classes(c).includes('sec-en'))).trim() });
      return;
    }
    if (cls.some(c => ['pq-mark', 'hero-touch'].includes(c))) return;
    const value = text(n).trim();
    if (n.name === 'figure') { image(n); return; }
    if (n.name === 'hr') { blocks.push({ t: 'hr' }); return; }
    if (/^h[2-5]$/.test(n.name)) {
      const isSection = n.name === 'h2';
      const anchor = isSection ? 's' + (toc.length + 1) : '';
      if (isSection) toc.push({ id: anchor, num: toc.length + 1, title: value });
      blocks.push({ t: isSection ? 'h2' : 'h3', text: value, num: isSection ? toc.length : '', anchor, level: Number(n.name.slice(1)) }); return;
    }
    if (n.name === 'ul' || n.name === 'ol') {
      blocks.push({ t: 'list', items: (n.children || []).filter(c => c.name === 'li').map((c, i) => ({ marker: n.name === 'ol' ? `${i + 1}.` : '•', text: text(c).trim(), nodes: inline(c) })) }); return;
    }
    if (n.name === 'table') {
      const rows = [];
      function rowWalk(c) { if (c.name === 'tr') rows.push({ cells: (c.children || []).filter(x => /^(td|th)$/.test(x.name)).map(x => ({ text: text(x).trim(), nodes: inline(x), heading: x.name === 'th' })) }); else (c.children || []).forEach(rowWalk); }
      rowWalk(n); blocks.push({ t: 'table', rows }); return;
    }
    if (cls.includes('formula')) {
      blocks.push({ t: 'callout', kind: 'formula', title: text(find(n, c => classes(c).includes('f-main'))).trim(), text: text(find(n, c => classes(c).includes('f-cap'))).trim() }); return;
    }
    if (n.name === 'blockquote' || cls.includes('pullquote')) {
      const copy = cls.includes('pullquote') ? find(n, c => c.name === 'p') || n : n;
      blocks.push({ t: 'quote', kind: cls.includes('pullquote') ? 'pullquote' : 'quote', text: text(copy).trim(), nodes: inline(copy) }); return;
    }
    if (cls.some(c => /^(pid-card|vs-card|lv-card|adv|cap|adv-card|cap-card|step|callout|note)$/.test(c))) {
      const heading = find(n, c => /^h[3-5]$/.test(c.name) || classes(c).some(x => ['lv-name', 'note-tag'].includes(x)));
      const paragraphs = (n.children || []).filter(c => c.name === 'p' || c.name === 'dl');
      // Cards without paragraphs use normal traversal to avoid losing other content.
      if (heading && paragraphs.length) {
        const variant = cls.includes('note') ? 'note' : cls.includes('pid-card') ? 'information' : cls.includes('lv-card') ? 'level' : cls.includes('vs-card') ? 'comparison' : cls.includes('adv') ? 'step' : cls.includes('cap') ? 'capability' : 'default';
        const badge = text(find(n, c => classes(c).some(x => ['pid-badge', 'adv-no', 'vs-arrow'].includes(x)))).trim();
        const eyebrow = text(find(n, c => classes(c).includes('pid-en') || c.name === 'small')).trim();
        const dots = find(n, c => classes(c).includes('lv-dots'));
        blocks.push({ t: 'callout', kind: 'card', variant, badge, eyebrow, featured: cls.some(c => ['hi', 'synergy', 'up'].includes(c)), level: dots ? (dots.children || []).filter(c => classes(c).includes('on')).length : 0, title: text(heading).trim(), text: paragraphs.map(text).join('\n'), nodes: paragraphs.flatMap((p, i) => [...(i ? [{ name: 'br', attrs: {}, children: [] }] : []), ...inline(p)]) }); return;
      }
    }
    if (n.name === 'p') {
      if (value) blocks.push({ t: 'p', text: value, nodes: inline(n), lead: cls.includes('lead') }); return;
    }
    if (n.name === 'dt' || n.name === 'dd') {
      if (value) blocks.push({ t: n.name === 'dt' ? 'h3' : 'p', text: value, nodes: inline(n) }); return;
    }
    (n.children || []).forEach(walk);
  }
  const main = find(doc, n => n.name === 'main') || find(doc, n => n.name === 'body') || doc;
  walk(main);
  return { blocks, toc, hero, skippedSvg };
}
module.exports = { parseContent };
