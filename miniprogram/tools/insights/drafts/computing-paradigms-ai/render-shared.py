from pathlib import Path
import base64, html, json, re
HERE=Path(__file__).resolve().parent

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
'FIG. 05 · 储备池计算：输入激发固定动态系统，从丰富的状态中训练读出。锁表示内部连接固定，旋钮表示可训练的读出；水波只是动态响应的比喻。AI 辅助生成 · 原理示意。',
'FIG. 06 · 衰退记忆：早期输入的影响逐渐变淡，新输入继续激发系统。水波展示直观类比，不是实验数据，也不代表所有储备池都服从同一种衰减曲线。AI 辅助生成。',
'FIG. 07 · 干涉的波形类比：同相叠加可以增强，反相叠加可以抵消。图示的是振幅关系；量子测量概率仍需按具体量子态与测量条件计算。AI 辅助生成。',
'FIG. 08 · 量子训练的混合循环：制备量子态、执行电路、重复测量，再由经典优化器更新参数。箭头与样本点为概念示意，不代表实验结果。AI 辅助生成。',
'FIG. 09 · 算法变化会改变硬件需求，专用加速器可能需要软件、映射或架构适配；并非算法一变，旧硬件就必然失效。AI 辅助生成 · 概念示意。',
'FIG. 10 · 作者设想的分工：GPU 承担灵活、复杂的任务，数字存算处理适合其架构的重复推理负载。它是对文中预测的图解，不代表已落地的标准架构或实测能效。AI 辅助生成。']
def image(index):
    m=metadata[index];data=base64.b64encode((HERE/'assets'/m['name']).read_bytes()).decode()
    return f'<figure><img src="data:image/webp;base64,{data}" width="{m["width"]}" height="{m["height"]}" alt="{html.escape(captions[index])}"><figcaption>{html.escape(captions[index])}</figcaption></figure>'
def note(label,body):return f'<div class="note"><span class="note-tag">{label}</span><p>{inline(body)}</p></div>'

