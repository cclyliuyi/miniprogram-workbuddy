#!/usr/bin/env python3
"""压缩方法论卡片 PNG 为 WebP"""
import os
from PIL import Image

SRC_DIR = r"D:\WorkBuddy\03_images_final\miniprogram\pages\method\images"
TARGET_WIDTH = 800

total_out = 0
for i in range(1, 13):
    src = os.path.join(SRC_DIR, f"m_{i:02d}_src.png")
    dst = os.path.join(SRC_DIR, f"m_{i:02d}.webp")
    if not os.path.exists(src):
        print(f"WARN: 找不到第 {i:02d} 张")
        continue
    img = Image.open(src)
    w, h = img.size
    new_w = TARGET_WIDTH
    new_h = int(h * TARGET_WIDTH / w)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    if img.mode in ('RGBA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'RGBA':
            bg.paste(img, mask=img.split()[3])
        else:
            bg.paste(img.convert('RGB'))
        img = bg
    else:
        img = img.convert('RGB')
    img.save(dst, 'WEBP', quality=82, method=6)
    # 删掉原图（沙箱禁删 → 改名）
    bak = src + '.bak'
    os.rename(src, bak)
    out_size = os.path.getsize(dst)
    total_out += out_size
    print(f"{i:02d}: -> {out_size//1024}KB  ({img.size[0]}x{img.size[1]})")

print(f"\n总计: {total_out//1024}KB")
