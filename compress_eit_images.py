#!/usr/bin/env python3
"""压缩 EIT 卡片 PNG 为 WebP 缩略图"""
import os
from PIL import Image

SRC_DIR = r"D:\WorkBuddy\03_images_final\electromagnetic_information_theory_cards_v1.0\02_images\final_candidates"
DST_DIR = r"D:\WorkBuddy\03_images_final\miniprogram\subpackages\eit\images"
TARGET_WIDTH = 800  # 宽度 800px，高度按比例缩放

os.makedirs(DST_DIR, exist_ok=True)

total_in = 0
total_out = 0

for i in range(1, 13):
    # 查找匹配的文件
    matches = [f for f in os.listdir(SRC_DIR) if f.startswith(f"{i:02d}_")]
    if not matches:
        print(f"WARN: 找不到第 {i:02d} 张卡片图片")
        continue
    src = os.path.join(SRC_DIR, matches[0])
    dst = os.path.join(DST_DIR, f"eit_{i:02d}.webp")

    in_size = os.path.getsize(src)
    total_in += in_size

    img = Image.open(src)
    # 按宽度等比缩放
    w, h = img.size
    new_w = TARGET_WIDTH
    new_h = int(h * TARGET_WIDTH / w)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    # 转 RGB（WebP 不支持 RGBA 的某些模式，强制 RGB + 白底）
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

    out_size = os.path.getsize(dst)
    total_out += out_size
    print(f"{i:02d}: {in_size//1024}KB -> {out_size//1024}KB  ({img.size[0]}x{img.size[1]})")

print(f"\n总计: {total_in//1024//1024}MB -> {total_out//1024}KB")
