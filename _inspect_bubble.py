import json, re
d = json.load(open('data/content.json', encoding='utf-8'))
works = d['collections']['works']
for w in works:
    c = w.get('content') or ''
    if '你真是我的宝' in c:
        i = c.find('你真是我的宝')
        seg = c[max(0, i-3000):i+200]
        fills = re.findall(r'fill="[^"]{1,20}"', seg)
        bgs = re.findall(r'background(?:-color)?:\s*[^;"]{1,25}', seg)
        print('WORK ID:', w.get('id'), '| TITLE:', w.get('title'))
        print('fills near bubble:', fills[:20])
        print('bgs near bubble:', bgs[:15])
        print('---segment tail---')
        print(seg[-500:])
        break
