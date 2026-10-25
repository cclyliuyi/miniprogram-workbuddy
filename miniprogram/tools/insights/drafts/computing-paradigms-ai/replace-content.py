"""Replace the article with the supplied revision; preserve author wording and existing images."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, html, json, re, shutil, sys
sys.stdout.reconfigure(encoding='utf-8')

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
INPUT=Path('C:/Users/Administrator/Downloads/从数字到量子：三种计算范式与AI的未来 2026.10.22-23.58.md')
STAMP=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
BACKUP=HERE/'history'/STAMP

def snapshot():
    BACKUP.mkdir(parents=True,exist_ok=False)
    for name in ['source.md','edited.md','render.py','article.html','publication.json','editorial-notes.md']:
        if (HERE/name).exists():shutil.copy2(HERE/name,BACKUP/name)
    shutil.copy2(ROOT/'tools/insights/dist/articles/computing-paradigms-ai.json',BACKUP/'article.json')
    shutil.copy2(ROOT/'tools/insights/dist/manifest.json',BACKUP/'manifest.json')
    hashes={str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['pages/insights','pages/insight-detail'] for p in (ROOT/folder).glob('*') if p.is_file()}
    for name in ['app.js','app.json','utils/cloud-json.js','project.config.json']:
        p=ROOT/name
        if p.exists():hashes[name]=hashlib.sha256(p.read_bytes()).hexdigest()
    (BACKUP/'runtime-hashes.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
    (HERE/'active-backup.txt').write_text(str(BACKUP),encoding='utf-8')
    shutil.copy2(INPUT,HERE/'source-20261022-2358.md')
    shutil.copy2(INPUT,HERE/'source.md')
    old=(HERE/'render.py').read_text(encoding='utf-8')
    prefix=old.split('sections=[',1)[0]
    prefix=prefix.replace('from prepare import HERE, SOURCES','HERE=Path(__file__).resolve().parent')
    (HERE/'render-shared.py').write_text(prefix,encoding='utf-8')
    (HERE/'render.py').write_text("from pathlib import Path\nimport runpy\nrunpy.run_path(str(Path(__file__).with_name('replace-content.py')),run_name='render')\n",encoding='utf-8')

if __name__=='__main__':snapshot()

# Load the established visual language without importing the old editorial rewrite script.
shared={'__file__':str(HERE/'render-shared.py')}
exec(compile((HERE/'render-shared.py').read_text(encoding='utf-8'),str(HERE/'render-shared.py'),'exec'),shared)
inline=shared['inline'];image=shared['image'];note=shared['note'];css=shared['css'];title=shared['title'];summary=shared['summary']
raw=(HERE/'source-20261022-2358.md').read_text(encoding='utf-8').replace('\r\n','\n')
lines=raw.splitlines();seen_title=False;clean=[]
for line in lines:
    if line.startswith('# '):
        if seen_title:continue
        seen_title=True
    clean.append(line)
text='\n'.join(clean).strip()+'\n'
(HERE/'edited.md').write_text(text,encoding='utf-8')

def rich(s):
    return '<br>'.join(inline(x) for x in re.split(r'<br\s*/?>',s,flags=re.I))

sections=[('壹','FRAME THE QUESTION'),('贰','DIGITAL COMPUTING'),('叁','ANALOG COMPUTING'),('肆','QUANTUM COMPUTING'),('伍','BRAIN & COMPUTATION'),('陆','THREE PREDICTIONS')]
content=[note('阅读提示','本文保留作者新版观点与论证。市场份额、时间窗口和技术路线胜负属于作者预测，不代表已实现的结果。')]
sec=0;inserted=[]
def add_image(i):
    assert i not in inserted
    content.append(image(i));inserted.append(i)

def prose(block):
    items=[];ordered=None
    def flush():
        nonlocal items,ordered
        if items:
            tag='ol' if ordered else 'ul'
            content.append('<'+tag+'>'+''.join('<li>'+rich(x)+'</li>' for x in items)+'</'+tag+'>')
            items=[];ordered=None
    for line in block.splitlines():
        ul=re.match(r'^\s*[-*]\s+(.+)',line)
        ol=re.match(r'^\s*\d+[.)]\s+(.+)',line)
        if ul or ol:
            kind=bool(ol)
            if items and ordered!=kind:flush()
            ordered=kind;items.append((ol or ul)[1])
        else:
            flush();content.append('<p>'+rich(line)+'</p>')
    flush()

for block in re.split(r'\n\s*\n',text):
    block=block.strip()
    if not block or block.startswith('# '):continue
    if re.fullmatch(r'[-*_]{3,}',block):content.append('<hr>');continue
    if block.startswith('## '):
        if sec:content.append('</section>')
        cn,en=sections[sec];sec+=1
        heading=re.sub(r'^[一二三四五六七八九十]+、','',block[3:])
        content.append(f'<section><div class="sec-kicker"><span class="sec-cn">{cn}</span><span class="sec-en">{en}</span><span class="sec-rule"></span></div><h2>{html.escape(heading)}</h2>')
        if sec==6:content.append(note('个人判断 · 可被证伪','本章的“至少 10%”“80% 以上”等比例为作者主观预测；证伪条件与适用范围保留在正文中。'))
        continue
    if block.startswith('### '):
        content.append('<h3>'+rich(block[4:])+'</h3>')
        if block.startswith('### 2.2 '):add_image(1)
        if block.startswith('### 4.3 '):add_image(7)
        continue
    if block.startswith('|'):
        rows=[]
        for row in block.splitlines():
            cells=[x.strip() for x in row.strip().strip('|').split('|')]
            if all(re.fullmatch(r':?-+:?',x) for x in cells):continue
            tag='th' if not rows else 'td'
            rows.append('<tr>'+''.join('<'+tag+'>'+rich(x)+'</'+tag+'>' for x in cells)+'</tr>')
        content.append('<table>'+''.join(rows)+'</table>');continue
    sole=re.fullmatch(r'\*\*(.+)\*\*',block)
    if sole and len(sole[1])<105 and (re.match(r'^(第一[，个种]|第二[，个种]|第三[，个种]|第四，|第五，|疑问[一二]|层面[一二]|光计算[：:]|存算一体[：:]|微波/射频|神经形态计算|量子计算[：:]|数字储备池|模拟储备池|量子储备池)',sole[1])):
        content.append('<h4>'+rich(sole[1])+'</h4>')
    elif block.startswith(('**但这里有个大问题','**但第二个质疑','**但第三个质疑')):
        content.append(note('需要追问',block))
    else:prose(block)
    if sec==1 and block=='后面的讨论，都基于这个框架。':add_image(0)
    if sec==2 and block.startswith('这五条约束'):add_image(2)
    if sec==3 and block.startswith('模拟计算呢？'):add_image(3)
    if sec==3 and block.startswith('打个比方：传统神经网络像'):add_image(4)
    if sec==3 and block.startswith('储备池的"记忆"'):add_image(5)
    if sec==4 and '概率幅相加：' in block:add_image(6)
    if sec==6 and block.startswith('**最后，也是最重要'):add_image(8)
    if sec==6 and block.startswith('两者是什么关系？'):add_image(9)

content.append('</section>')
content.append(note('配图说明','十幅图片为 AI 辅助生成的概念或原理示意，不代表实测数据。未来分工图表达作者设想；预测比例与适用范围仍以正文为准。'))
assert sec==6,sec
assert inserted==list(range(10)),inserted
document=f'<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{summary}"><meta property="og:description" content="{summary}"><title>{title}</title><style>{css}</style></head><body><section class="hero"><div class="hero-inner"><p class="kicker">计算范式 · AI 硬件 · 原创洞见</p><h1>{title}</h1><p class="hero-sub">从物理机制到软件生态，看清机会，也看清边界。</p></div></section><main>{"".join(content)}</main></body></html>'
(HERE/'article.html').write_text(document,encoding='utf-8')
(HERE/'replacement-notes.md').write_text('# 正文替换与配图记录\n\n以 source-20261022-2358.md 为本次内容来源，保留新版措辞、论证及预测。仅删除一次重复的文章标题，并转换标题、加粗、列表和表格；未套用旧版 83 处改写。配图更新后共十张：保留六张旧图，新增储备池原理、衰退记忆、算法变化三张图，并以 GPU 与数字存算分工图替换原未来协作图。旧版正文备份见 active-backup.txt，配图前版本见 active-image-backup.txt。此记录不是对新增技术数据与引语完成事实核查的声明。\n',encoding='utf-8')
print(json.dumps({'source':str(INPUT),'sourceCharacters':len(raw),'chapters':sec,'images':len(inserted),'backup':(HERE/'active-backup.txt').read_text(encoding='utf-8')},ensure_ascii=False))
