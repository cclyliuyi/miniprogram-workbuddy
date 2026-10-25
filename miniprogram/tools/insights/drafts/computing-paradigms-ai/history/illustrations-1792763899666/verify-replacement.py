from pathlib import Path
from html.parser import HTMLParser
import hashlib, json, re
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
class Reader(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,data):self.parts.append(data)
def norm(text):return re.sub(r'\s+','',text)
reader=Reader();reader.feed((HERE/'article.html').read_text(encoding='utf-8'))
actual=norm(''.join(reader.parts));missing=[];checked=0
for line in (HERE/'source-20261022-2358.md').read_text(encoding='utf-8').splitlines():
    line=line.strip()
    if not line or re.fullmatch(r'[-*_]{3,}',line):continue
    if line.startswith('|'):
        cells=[c.strip() for c in line.strip('|').split('|')]
        if all(re.fullmatch(r':?-+:?',c) for c in cells):continue
        candidates=cells
    else:
        if line.startswith('## '):line=re.sub(r'^## [一二三四五六]+、','',line)
        line=re.sub(r'^#{1,4}\s+|^[-*]\s+|^\d+[.)]\s+','',line)
        candidates=[line]
    for candidate in candidates:
        candidate=re.sub(r'<br\s*/?>','',candidate,flags=re.I).replace('**','')
        if norm(candidate) and norm(candidate) not in actual:missing.append(candidate[:100])
        checked+=1
assert not missing,missing
article=json.loads((ROOT/'tools/insights/dist/articles/computing-paradigms-ai.json').read_text(encoding='utf-8'))
assert article['id']=='computing-paradigms-ai'
assert len(article['toc'])==6
assert len([b for b in article['blocks'] if b['t']=='image'])==7
assert len([b for b in article['blocks'] if b['t']=='table'])==3
assert any('储备池计算' in b.get('text','') for b in article['blocks'])
assert any('80%以上' in b.get('text','') for b in article['blocks'])
backup=Path((HERE/'active-backup.txt').read_text(encoding='utf-8'))
previous=json.loads((backup/'article.json').read_text(encoding='utf-8'))
assert [b['fileID'] for b in article['blocks'] if b['t']=='image']==[b['fileID'] for b in previous['blocks'] if b['t']=='image']
hashes=json.loads((backup/'runtime-hashes.json').read_text(encoding='utf-8'))
assert all(hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest for path,digest in hashes.items()),'Runtime code changed during content replacement'
print(json.dumps({'sourceSegmentsPreserved':checked,'chapters':len(article['toc']),'imagesUnchanged':7,'tables':3,'blocks':len(article['blocks']),'runtimeFilesUnchanged':len(hashes)}))
