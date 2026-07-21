"""
生成 tabBar 图标：5 套 × 2 态 = 10 张 81x81 透明 PNG
默认态：#9b9384 (muted gray)
选中态：#20201c (ink black)
线条风格：简约线性，2-3px 描边
"""
from PIL import Image, ImageDraw
import os

SIZE = 81
LINE = 3  # 描边宽度

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'assets', 'tabbar')
os.makedirs(OUT_DIR, exist_ok=True)

COLORS = {
    'default': (155, 147, 132, 255),   # #9b9384
    'active':  (32, 32, 28, 255),      # #20201c
}

def new_canvas():
    return Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

def draw_calendar(color):
    """日历：圆角矩形 + 顶部装订环 + 内部网格点"""
    img = new_canvas()
    d = ImageDraw.Draw(img)
    w = LINE
    # 外框
    d.rounded_rectangle([16, 18, 64, 66], radius=6, outline=color, width=w)
    # 顶部装订线
    d.line([16, 32, 64, 32], fill=color, width=w)
    # 装订环（两根竖线穿出顶部）
    d.line([26, 12, 26, 24], fill=color, width=w)
    d.line([54, 12, 54, 24], fill=color, width=w)
    # 内部日期点（3x2 网格）
    for row in range(2):
        for col in range(3):
            cx = 28 + col * 12
            cy = 44 + row * 12
            d.ellipse([cx-1, cy-1, cx+1, cy+1], fill=color)
    return img

def draw_lightning(color):
    """闪电：多边形折线"""
    img = new_canvas()
    d = ImageDraw.Draw(img)
    w = LINE
    # 闪电折线坐标
    pts = [(48, 12), (28, 44), (42, 44), (34, 68), (56, 36), (42, 36)]
    d.line(pts + [pts[0]], fill=color, width=w, joint='curve')
    return img

def draw_book(color):
    """书本：打开的书，两页 + 中缝 + 几条文字线"""
    img = new_canvas()
    d = ImageDraw.Draw(img)
    w = LINE
    # 左页轮廓
    d.rectangle([16, 20, 40, 60], outline=color, width=w)
    # 右页轮廓
    d.rectangle([41, 20, 65, 60], outline=color, width=w)
    # 中缝
    d.line([40, 18, 40, 62], fill=color, width=w)
    # 左页文字线
    d.line([22, 30, 34, 30], fill=color, width=2)
    d.line([22, 38, 34, 38], fill=color, width=2)
    d.line([22, 46, 30, 46], fill=color, width=2)
    # 右页文字线
    d.line([47, 30, 59, 30], fill=color, width=2)
    d.line([47, 38, 59, 38], fill=color, width=2)
    d.line([47, 46, 55, 46], fill=color, width=2)
    return img

def draw_gear(color):
    """齿轮：圆环 + 8 个齿 + 中心孔"""
    img = new_canvas()
    d = ImageDraw.Draw(img)
    w = LINE
    cx, cy = 40, 40
    # 外圆环
    d.ellipse([24, 24, 56, 56], outline=color, width=w)
    # 内圆（中心孔）
    d.ellipse([34, 34, 46, 46], outline=color, width=w)
    # 8 个齿（短径向线段）
    import math
    for i in range(8):
        angle = i * math.pi / 4
        x1 = cx + 16 * math.cos(angle)
        y1 = cy + 16 * math.sin(angle)
        x2 = cx + 24 * math.cos(angle)
        y2 = cy + 24 * math.sin(angle)
        d.line([x1, y1, x2, y2], fill=color, width=w)
    return img

def draw_heart(color):
    """爱心：两个圆 + 底部三角组合"""
    img = new_canvas()
    d = ImageDraw.Draw(img)
    w = LINE
    # 左半圆
    d.arc([20, 18, 50, 50], start=180, end=360, fill=color, width=w)
    # 右半圆
    d.arc([32, 18, 62, 50], start=180, end=360, fill=color, width=w)
    # 底部两条线汇聚成尖角
    d.line([20, 34, 41, 64], fill=color, width=w)
    d.line([62, 34, 41, 64], fill=color, width=w)
    return img

ICONS = {
    'calendar': draw_calendar,
    'frontier': draw_lightning,
    'method': draw_book,
    'tools': draw_gear,
    'favs': draw_heart,
}

for name, draw_fn in ICONS.items():
    for state, color in COLORS.items():
        img = draw_fn(color)
        fname = f'{name}_{state}.png'
        img.save(os.path.join(OUT_DIR, fname))
        print(f'  {fname} ({SIZE}x{SIZE})')

print(f'\nDone! {len(ICONS) * 2} icons saved to {OUT_DIR}')
