#!/usr/bin/env python3
"""重新压缩 EIT 图片，更小"""
import os
from PIL import Image

DST_DIR = r"D:\WorkBuddy\03_images_final\miniprogram\pages\eit\images"
TARGET_WIDTH = 640
QUALITY = 75

total_out = 0
for i in range(1, 13):
    src = os.path.join(DST_DIR, f"eit_{i:02d}.webp")
    if not os.path.exists(src):
        continue
    img = Image.open(src)
    w, h = img.size
    new_w = TARGET_WIDTH
    new_h = int(h * TARGET_WIDTH / w)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    tmp = src + '.tmp'
    img.save(tmp, 'WEBP', quality=QUALITY, method=6)
    os.replace(tmp, src)
    out_size = os.path.getsize(src)
    total_out += out_size
    print(f"{i:02d}: {out_size//1024}KB  ({img.size[0]}x{img.size[1]})")

print(f"\n总计: {total_out//1024}KB")
