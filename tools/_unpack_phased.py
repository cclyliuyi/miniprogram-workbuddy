import re, json, base64, gzip, os

src = r"C:\Users\Administrator\Downloads\相控阵天线-单文件.html"
out_dir = r"D:\WorkBuddy\03_images_final\tools\_phased_array_src"
os.makedirs(out_dir, exist_ok=True)

with open(src, "r", encoding="utf-8") as f:
    html = f.read()

m = re.search(r'<script type="__bundler/manifest">([\s\S]*?)</script>', html)
t = re.search(r'<script type="__bundler/template">([\s\S]*?)</script>', html)
manifest = json.loads(m.group(1).strip())
template = json.loads(t.group(1).strip())

with open(os.path.join(out_dir, "template.html"), "w", encoding="utf-8") as f:
    f.write(template if isinstance(template, str) else json.dumps(template, indent=2, ensure_ascii=False))

names = ["three-d-stage.js", "react.js", "react-dom.js", "babel.js"]
idx = 0
for uuid, entry in manifest.items():
    if entry.get("mime") != "text/javascript":
        continue
    raw = base64.b64decode(entry["data"])
    text = gzip.decompress(raw).decode("utf-8") if entry.get("compressed") else raw.decode("utf-8")
    name = names[idx] if idx < len(names) else f"chunk{idx}.js"
    with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
        f.write(text)
    print(f"saved {name}: {len(text)} chars")
    idx += 1
print(f"\ntotal JS: {idx}, output dir: {out_dir}")
