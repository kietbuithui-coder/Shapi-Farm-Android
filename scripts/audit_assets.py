#!/usr/bin/env python3
import os, json, re, io, hashlib, base64, zlib, collections, statistics
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path('game-source')
EXCLUDE={'node_modules','.git','.next','.expo','.gradle','build','dist','android'}
EXCLUDE_PREFIX={'art/source-sheets','art/references'}
IMAGE_EXT={'.png','.jpg','.jpeg','.gif','.webp','.bmp'}
asset_files=[]
code_files=[]
for p in ROOT.rglob('*'):
    if not p.is_file(): continue
    rel=p.relative_to(ROOT).as_posix()
    if any(q in EXCLUDE for q in p.relative_to(ROOT).parts): continue
    if p.suffix.lower() in IMAGE_EXT: asset_files.append(p)
    if p.suffix.lower() in {'.ts','.tsx','.js','.jsx','.css','.html','.json','.svg'} and p.stat().st_size<1500000:code_files.append(p)

rows=[]; errors=[]; pixel_hash=collections.defaultdict(list); byte_hash=collections.defaultdict(list)
for p in asset_files:
    rel=p.relative_to(ROOT).as_posix()
    try:
        with Image.open(p) as im:
            im.load()
            rgba=im.convert('RGBA')
            w,h=rgba.size
            if w*h>16000000: raise RuntimeError('very large image')
            thumb=rgba.copy(); thumb.thumbnail((120,110),Image.Resampling.NEAREST)
            colors=len(rgba.getcolors(maxcolors=200000) or [])
            a=rgba.getchannel('A'); bbox=a.getbbox()
            nontrans=(bbox is not None)
            alpha_ext=a.getextrema()
            size=p.stat().st_size
            row={'p':rel,'w':w,'h':h,'bytes':size,'colors':colors,'alpha':alpha_ext,'blank':not nontrans,'format':im.format}
            rows.append(row)
            pixel_hash[hashlib.sha256(rgba.tobytes()).hexdigest()].append(rel)
            byte_hash[hashlib.sha256(p.read_bytes()).hexdigest()].append(rel)
    except Exception as e: errors.append([rel,str(e)])
rows.sort(key=lambda x:x['p'])
groups=collections.defaultdict(list)
for r in rows:
    parts=r['p'].split('/')
    groups['/'.join(parts[:min(4,len(parts)-1)])].append(r['p'])
dups=[v for v in pixel_hash.values() if len(v)>1]
candidates=[]
for p in code_files:
    rel=p.relative_to(ROOT).as_posix()
    if rel.startswith(('art/','scripts/')): continue
    try: t=p.read_text('utf-8',errors='replace')
    except: continue
    for pattern in (r'/(?:assets|images|sprites|audio)/[A-Za-z0-9_\-./]+', r'["\x27]([A-Za-z0-9_\-/]+\.png)["\x27]'):
        for found in re.findall(pattern,t):
            val=found if isinstance(found,str) else found[0]
            if isinstance(val,str) and val.endswith(('.png','.webp','.jpg','.svg','.gif')):
                candidates.append([rel,val])
file_paths=set(str(x.relative_to(ROOT)).replace('\\','/') for x in ROOT.rglob('*') if x.is_file())
missing=[]
for code,ref in candidates:
    if ref.startswith('/'):
        full='public'+ref
        if full not in file_paths and full.lstrip('/') not in file_paths:
            missing.append([code,ref])
rare_sizes=[r for r in rows if min(r['w'],r['h']) < 16 or r['w']>3000 or r['h']>3000]
zero=[r for r in rows if r['blank']]
svg_files=[str(p.relative_to(ROOT)) for p in code_files if p.suffix.lower()=='.svg']
other=collections.Counter(p.suffix.lower() for p in ROOT.rglob('*') if p.is_file() and not any(q in EXCLUDE for q in p.relative_to(ROOT).parts))
v={'count_images':len(rows),'directories':{g:len(a) for g,a in groups.items()},'rows':rows,'duplicates_pixel':dups,'errors':errors,'unusual_size':rare_sizes,'blank_alpha':zero,'svg_count':len(svg_files),'svg_examples':svg_files[:40],'refs_missing':list({(p,q) for p,q in missing})[:200],'extension_counts':dict(other),'code_files':len(code_files)}
packed=base64.b64encode(zlib.compress(json.dumps(v,ensure_ascii=False).encode(),9)).decode()
print('AUDIT_JSON='+packed,flush=True)
# Make contact sheets to inspect sprite designs with consistent pixel-friendly scaling
display=[r for r in rows if r['p'].startswith('public/') and r['w']<=3000 and r['h']<=3000]
display.sort(key=lambda r:r['p'])
N=48; COLS=6; CW=180; CH=164
for idx in range(0,len(display),N):
    page=display[idx:idx+N]
    out=Image.new('RGB',(COLS*CW,((len(page)+COLS-1)//COLS)*CH),(237,235,225))
    dr=ImageDraw.Draw(out)
    for j,r in enumerate(page):
        xx=(j%COLS)*CW; yy=(j//COLS)*CH
        dr.rectangle([xx+4,yy+4,xx+CW-5,yy+CH-5],outline=(180,174,164),width=1)
        for cy in range(yy+9,yy+127,14):
            for cx in range(xx+9,xx+CW-9,14):
                if ((cy-yy)//14+(cx-xx)//14)%2:
                    dr.rectangle([cx,cy,cx+13,cy+13],fill=(218,215,210))
        try:
            with Image.open(ROOT/r['p']) as im:
                im=im.convert('RGBA')
                im.thumbnail((155,114),Image.Resampling.NEAREST)
                dst=(xx+(CW-im.width)//2,yy+10+(115-im.height)//2)
                out.paste(im,dst,mask=im.getchannel('A'))
        except:pass
        name=Path(r['p']).name
        dr.text((xx+7,yy+126),name[:25],fill=(18,22,25))
        dr.text((xx+7,yy+142),f"{r['w']}x{r['h']} #{idx+j+1}",fill=(65,66,69))
    temp=io.BytesIO();out.save(temp,format='JPEG',quality=76,optimize=True)
    payload=base64.b64encode(temp.getvalue()).decode()
    print(f'SHEET_{idx//N:02d}='+payload,flush=True)
print(f'SUMMARY images={len(rows)} public={len(display)} pages={(len(display)+N-1)//N} duplicate_groups={len(dups)} missing_refs={len(missing)} errors={len(errors)}',flush=True)
