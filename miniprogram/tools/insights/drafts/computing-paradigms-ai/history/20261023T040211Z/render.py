from pathlib import Path
import base64, html, json, re
from prepare import HERE, SOURCES

text=(HERE/'edited.md').read_text(encoding='utf-8')
title='从数字到量子：三种计算范式与 AI 的未来'
summary='数字计算、模拟计算和量子计算各擅长什么？沿着物理机制、系统成本与软件生态，重新审视 AI 计算的机会与边界。'
template=Path('C:/Users/Administrator/.codex/skills/insights-article/assets/article-template.html').read_text(encoding='utf-8')
css=re.search(r'<style>([\s\S]*?)</style>',template)[1]
css+='\n.pid-card h4,.adv h4{margin:8px 0 12px;font-size:20px}.pid-card p:last-child,.note p:last-child{margin-bottom:0}.hero{background:linear-gradient(130deg,#10283f,#244453)}.image-note{font-size:12px}a{color:#8f6a1c;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd3bd;padding:12px;text-align:left}th{background:#f3eee2}'
core_starts=['我对','可编程性才是','可编程性差这个短板','但这里有个大问题','可表达性','量子计算在原理上','算法进步和硬件进步','真正值得关注的']
keyword_budget={k:2 for k in ['存储墙','存算一体','量子态','输入瓶颈','参数平移法则','贫瘠高原','系统总账','软件生态']}
def inline(s):
    parts=re.split(r'(\*\*.*?\*\*)',s,flags=re.S);out=[]
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            body=part[2:-2];kind=' class="hl"' if any(body.startswith(x) for x in core_starts) else ' class="gold-t"' if len(body)<16 else ''
            out.append('<strong'+kind+'>'+html.escape(body)+'</strong>')
        else:
            safe=html.escape(part)
            for term,left in keyword_budget.items():
                if left and term in safe:
                    safe=safe.replace(term,'<strong class="gold-t">'+term+'</strong>',1);keyword_budget[term]-=1;break
            out.append(safe)
    return ''.join(out)

metadata=json.loads((HERE/'assets/metadata.json').read_text(encoding='utf-8'))
captions=[
'FIG. 01 · 三种物理机制，三类计算资源。离散逻辑、经典连续响应与量子操作可以协作，不代表后者会依次取代前者。AI 辅助生成 · 概念示意。',
'FIG. 02 · 存储墙的直观解释：减少反复搬运，让部分计算在存储阵列内发生。系统仍需要输入、输出和控制，不是所有数据移动都被消除。AI 辅助生成 · 架构示意。',
'FIG. 03 · 软件生态的复利：同一硬件基础上，工具、应用与开发者相互促进。AI 辅助生成 · 概念示意。',
'FIG. 04 · 让物理过程参与计算：上图用电流汇合表示电阻阵列的求和，下图用光路表示光学变换与探测。仅作原理比喻，不是可制造的电路或光学设计。AI 辅助生成。',
'FIG. 05 · 干涉的波形类比：同相叠加可以增强，反相叠加可以抵消。图示的是振幅关系；量子测量概率仍需按具体量子态与测量条件计算。AI 辅助生成。',
'FIG. 06 · 量子训练的混合循环：制备量子态、执行电路、重复测量，再由经典优化器更新参数。箭头与样本点为概念示意，不代表实验结果。AI 辅助生成。',
'FIG. 07 · 按任务分工，而非只押一条路线：数字系统与不同加速器可能协作。包含量子模块是作者对未来的概念设想，不代表当前通用 AI 系统已采用该组合。AI 辅助生成。']
def image(index):
    m=metadata[index];data=base64.b64encode((HERE/'assets'/m['name']).read_bytes()).decode()
    return f'<figure><img src="data:image/webp;base64,{data}" width="{m["width"]}" height="{m["height"]}" alt="{html.escape(captions[index])}"><figcaption>{html.escape(captions[index])}</figcaption></figure>'
def note(label,body):return f'<div class="note"><span class="note-tag">{label}</span><p>{inline(body)}</p></div>'

sections=[('壹','FRAME THE QUESTION'),('贰','DIGITAL COMPUTING'),('叁','ANALOG COMPUTING'),('肆','QUANTUM COMPUTING'),('伍','BRAIN & COMPUTATION'),('陆','THREE PREDICTIONS'),('附','SOURCES & NOTES')]
content=[note('阅读提示','这是一篇比较与判断型文章。技术事实与作者预测分开呈现；文末保留核对来源，三项市场或应用预测不代表已实现的结果。')]
sec=0;inserted=set()
for para in text.split('\n\n'):
    para=para.strip()
    if not para or para.startswith('# '):continue
    if para.startswith('## '):
        if sec:content.append('</section>')
        cn,en=sections[sec];sec+=1
        heading=re.sub(r'^[一二三四五六七八九十]+、','',para[3:])
        content.append(f'<section><div class="sec-kicker"><span class="sec-cn">{cn}</span><span class="sec-en">{en}</span><span class="sec-rule"></span></div><h2>{html.escape(heading)}</h2>')
        if sec==6:content.append(note('个人判断 · 可被证伪','下面三个判断保留作者立场。尤其“2030 年至少 10%”是主观预测，不是市场统计或量化模型结论。'))
        continue
    if para.startswith('### '):
        content.append('<h3>'+inline(para[4:])+'</h3>')
        if para.startswith('### 数字计算'):content.append(image(1));inserted.add(1)
        if para.startswith('### 量子神经网络'):content.append(image(5));inserted.add(5)
        continue
    match=re.match(r'^(第一|第二|第三|第四|第五)，([^。]+)。([\s\S]*)',para)
    if sec==2 and match:
        num=['第一','第二','第三','第四','第五'].index(match[1])+1
        content.append(f'<div class="adv"><span class="adv-no">{num:02d}</span><h4>{inline(match[2])}</h4><p>{inline(match[3])}</p></div>')
        if num==5:content.append(image(2));inserted.add(2)
        continue
    if sec==4 and (para.startswith('第一，高维') or para.startswith('第二，特征') or para.startswith('第三，概率')):
        content.append('<h4>'+inline(para)+'</h4>');continue
    if sec==3 and para.startswith(('光计算是一条','存算一体是另一条','微波/射频计算','神经形态计算关注')):
        label='光计算' if para.startswith('光计算') else '存算一体' if para.startswith('存算一体') else '微波与射频计算' if para.startswith('微波') else '神经形态计算'
        content.append('<h4>'+label+'</h4>')
    if '\n' in para:
        lines=[x.strip() for x in para.splitlines() if x.strip()]
        content.append('<ul>'+''.join('<li>'+inline(x)+'</li>' for x in lines)+'</ul>')
    elif para.startswith(('**但这里有个大问题','**但第二个质疑','**但第三个质疑')):
        content.append(note('需要追问',para))
    else:content.append('<p>'+inline(para)+'</p>')
    if sec==1 and para.startswith('存算一体横跨'):
        content.append(image(0));inserted.add(0)
        content.append('<table><tr><th>比较对象</th><th>信息与机制</th><th>要问的关键问题</th></tr><tr><td>经典数字</td><td>离散编码与数字逻辑</td><td>通用性、带宽与生态</td></tr><tr><td>经典模拟</td><td>连续物理量与直接映射</td><td>精度、校准与系统开销</td></tr><tr><td>量子</td><td>量子态、干涉与测量</td><td>制备、噪声、读出与实际优势</td></tr></table>')
    if sec==3 and para.startswith('比如，在电阻交叉阵列'):
        content.append(image(3));inserted.add(3)
    if sec==4 and para.startswith('经典的互斥事件'):
        content.append(image(4));inserted.add(4)
    if sec==6 and para.startswith('我的预测是，未来十年计算'):
        content.append(image(6));inserted.add(6)

content.append('</section>')
cn,en=sections[6]
content.append(f'<section><div class="sec-kicker"><span class="sec-cn">{cn}</span><span class="sec-en">{en}</span><span class="sec-rule"></span></div><h2>核对来源与阅读边界</h2>')
content.append(note('制作说明','依据作者原稿整理，去除重复标题，保留核心观点及三个预测，对数量级、分类、测量和工程边界作了事实校正。七幅图片为 AI 辅助生成的解释性示意，不代表实测数据。'))
for n,topic,name,url in SOURCES:
    content.append(f'<p><strong>〔{n}〕{html.escape(topic)}</strong><br>{html.escape(name)}<br><a href="{url}">{url}</a></p>')
content.append('</section>')
assert inserted==set(range(7)),inserted
document=f'''<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{summary}"><meta property="og:description" content="{summary}"><title>{title}</title><style>{css}</style></head><body><section class="hero"><div class="hero-inner"><p class="kicker">计算范式 · AI 硬件 · 原创洞见</p><h1>{title}</h1><p class="hero-sub">从物理机制到软件生态，看清机会，也看清边界。</p></div></section><main>{''.join(content)}</main></body></html>'''
assert '{{' not in document
(HERE/'article.html').write_text(document,encoding='utf-8')
print('Rendered article with 6 chapters + sources, 7 inline illustrations.')
