#!/usr/bin/env python3
"""Build geometry presets from supplier SKU inventories and linked dimensional drawings.

Tables below transcribe the supplier's nominal / maximum dimensions. Duplicate
materials and coatings retain every product code and URL on one geometry preset.
Unsupported shapes and unavailable sizes are reported, never assigned guessed sizes.
"""
import json, re, hashlib, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'src/catalog/data'
BASE='https://gvyntok.com/wp-content/uploads/2024/06/'

def table(diameters, fields, *columns):
    values=[list(map(float,c.split())) for c in [diameters,*columns]]
    assert all(len(c)==len(values[0]) for c in values)
    return {d:dict(zip(fields,[c[i] for c in values[1:]])) for i,d in enumerate(values[0])}

NUTS={
'DIN 934':('hex-nut','050-010-001',table('2 2.5 3 3.5 4 5 6 7 8 10 12 14 16 18 20 22 24 27 30 33 36 39 42 45 48 52 56 60 64 68 72 76 80 85 90 100',['acrossFlats','height'], '4 5 5.5 6 7 8 10 11 13 17 19 22 24 27 30 32 36 41 46 50 55 60 65 70 75 80 85 90 95 100 105 110 115 120 130 145','1.6 2 2.4 2.8 3.2 4 5 5.5 6.5 8 10 11 13 15 16 18 19 22 24 26 29 31 34 36 38 42 45 48 51 54 58 61 64 68 72 80')),
'DIN 439':('thin-nut','050-200-001',table('2 2.5 3 3.5 4 5 6 8 10 12 14 16 18 20 22 24 27 30 33 36 39 42 45 48 52',['acrossFlats','height'],'4 5 5.5 6 7 8 10 13 17 19 22 24 27 30 32 36 41 46 50 55 60 65 70 75 80','1.2 1.6 1.8 2 2.2 2.7 3.2 4 5 6 7 8 9 10 11 12 13.5 15 16.5 18 19.5 21 22.5 24 26')),
'DIN 6334':('coupling-nut','050-570-001',table('5 6 8 10 12 14 16 18 20 22 24 27 30 36 42 48',['acrossFlats','height'],'8 10 13 17 19 22 24 27 30 32 36 41 46 55 65 75','15 18 24 30 36 42 48 54 60 66 72 81 90 108 126 144')),
'DIN 6330':('high-nut','050-581-001',table('6 8 10 12 14 16 18 20 22 24 30 36 42 48',['acrossFlats','height'],'10 13 16 18 21 24 27 30 32 36 46 55 65 75','9 12 15 18 21 24 27 30 33 36 45 54 63 72')),
'DIN 557':('square-nut','050-610-001',table('5 6 8 10 12 16',['acrossFlats','height'],'8 10 13 17 19 24','4 5 6.5 8 10 13')),
'DIN 562':('square-nut','050-590-001',table('1.6 2 2.5 3 3.5 4 5 6 8 10',['acrossFlats','height'],'3.2 4 5 5.5 6 7 8 10 13 17','1 1.2 1.6 1.8 2 2.2 2.7 3.2 4 5')),
'DIN 6923':('flange-nut','050-270-001',table('4 5 6 8 10 12 14 16 20',['acrossFlats','height','flangeDiameter'],'7 8 10 13 15 18 21 24 30','4.8 5 6 8 10 12 14 16 20','10 11.8 14.2 17.9 21.8 26 29.9 34.5 42.8')),
'DIN 985':('nyloc-nut','050-310-001',table('3 4 5 6 7 8 10 12 14 16 18 20 22 24 27 30 33 36 39 42 45 48',['acrossFlats','height','bodyHeight'],'5.5 7 8 10 11 13 17 19 22 24 27 30 32 36 41 46 50 55 60 65 70 75','4 5 5 6 7.5 8 10 12 14 16 18.5 20 22 24 27 30 33 36 39 42 45 48','2.4 2.9 3.2 4 4.7 5.5 6.5 8 9.5 10.5 13 14 15 15 17 19 22 25 27 29 32 36')),
'DIN 982':('nyloc-nut','050-410-001',table('5 6 7 8 10 12 14 16 18 20 22 24',['acrossFlats','height','bodyHeight'],'8 10 11 13 17 19 22 24 27 30 32 36','6.3 8 8.5 9.5 11.5 14 16 18 20 22 25 28','4.4 4.9 6.14 6.44 8.04 10.37 12.1 14.1 15.1 16.9 18.1 20.2')),
'DIN 980':('metal-lock-nut','050-380-001',table('3 4 5 6 7 8 10 12 14 16 18 20 22 24 27 30 33 36 39',['acrossFlats','height'],'5.5 7 8 10 11 13 17 19 22 24 27 30 32 36 41 46 50 55 60','3.7 4.2 5.1 6 7 8 10 12 14 16 18 20 22 24 27 30 33 36 39')),
'DIN 1587':('cap-nut','050-530-001',table('3 4 5 6 8 10 12 14 16 18 20 22 24 30',['acrossFlats','height','bodyHeight'],'5.5 7 8 10 13 17 19 22 24 27 30 34 36 46','6 8 10 12 15 18 22 25 28 32 34 39 42 50','2.6 3.2 4 5 6.5 8 10 11 13 15 16 18 19 25')),
}
WASHERS={
'DIN 125':('washer','060-010-001',table('2 2.5 3 3.5 4 5 6 7 8 10 12 14 16 18 20 22 24 27 30 33 36 39 42 45 48 52 56 60 64 72 80 85 90 95 100 105',['bore','outerDiameter','thickness'],'2.2 2.7 3.2 3.7 4.3 5.3 6.4 7.4 8.4 10.5 13 15 17 19 21 23 25 28 31 34 37 40 43 46 50 54 58 62 66 74 82 87 93 98 104 109','5 6 7 8 9 10 12 14 16 20 24 28 30 34 37 39 44 50 56 60 66 72 78 85 92 98 105 110 115 125 140 145 160 165 175 180','.3 .5 .5 .5 .8 1 1.6 1.6 1.6 2 2.5 2.5 3 3 3 3 4 4 4 5 5 6 7 7 8 8 9 9 9 10 12 12 12 12 14 14')),
'DIN 9021':('washer','060-110-001',table('2.5 3 3.5 4 5 6 7 8 10 12 14 16 18 20 24 27 30 36',['bore','outerDiameter','thickness'],'2.7 3.2 3.7 4.3 5.3 6.4 7.4 8.4 10.5 13 15 17 20 22 26 30 33 39','8 9 11 12 15 18 22 24 30 37 44 50 56 60 72 84 92 110','.8 .8 .8 1 1.2 1.6 2 2 2.5 3 3 3 4 4 5 5 6 8')),
'DIN 440':('washer','060-170-001',table('5 6 8 10 12 16 20 22',['bore','outerDiameter','thickness'],'5.5 6.6 9 11 14 18 22 24','18 22 28 34 44 56 72 80','2 2 3 3 4 5 6 6')),
'DIN 436':('square-washer','060-330-001',table('10 12 16 20 22 24 27 30 33',['bore','outerDiameter','thickness'],'11 13.5 17.5 22 24 26 30 33 36','30 40 50 60 70 80 90 95 100','3 4 5 5 6 6 6 6 6')),
'DIN 6798':('toothed-washer','060-360-001',table('2 2.5 3 3.5 4 5 6 7 8 10 12 14 16 18 20 22 24 27 30',['bore','outerDiameter','thickness'],'2.2 2.7 3.2 3.7 4.3 5.3 6.4 7.4 8.4 10.5 13 15 17 19 21 23 25 28 31','4.5 5.5 6 7 8 10 11 12.5 15 18 20.5 24 26 30 33 36 38 44 48','.3 .4 .4 .5 .5 .6 .7 .8 .8 .9 1 1 1.2 1.4 1.4 1.5 1.5 1.6 1.6')),
}
PINS=table('1 1.5 2 2.5 3 3.5 4 4.5 5 6 8 10 12 13 14 16 18 20 21 25 28 30 32 35',['freeDiameter','wall','chamfer'],'1.2 1.7 2.3 2.8 3.3 3.8 4.4 4.9 5.4 6.4 8.5 10.5 12.5 13.5 14.5 16.5 18.5 20.5 21.5 25.5 28.5 30.5 32.5 35.5','.2 .3 .4 .5 .6 .75 .8 1 1 1.2 1.5 2 2.5 2.5 3 3 3.5 4 4 5 5.5 6 6 7','.25 .35 .45 .5 .6 .7 .75 .9 1 1.3 1.8 2.2 2.2 2.2 2.2 2.2 2.2 3.2 3.2 3.2 3.2 3.2 3.3 3.3')
PITCH=dict(zip([2,2.5,3,4,5,6,8,10,12,14,16,18,20,22,24,27,30,33,36,39,42,45,48,52,56,60],[.4,.45,.5,.7,.8,1,1.25,1.5,1.75,2,2,2.5,2.5,2.5,3,3,3.5,3.5,4,4,4.5,4.5,5,5,5.5,5.5]))
CIRCLIPS=json.loads((DATA/'circlip-dimensions.json').read_text())
STANDARD_REFERENCES={
    'norelem-6796': ('Norelem', 'https://norelem.hu/medias/07303-Datasheet-18394-Conical-spring-washers-DIN-6796-en.pdf?context=bWFzdGVyfHJvb3R8MTU5MDE5fGFwcGxpY2F0aW9uL3BkZnxhR1UyTDJoalppODVNekkxTkRZd016VTNNVFV3THpBM016QXpYMFJoZEdGemFHVmxkRjh4T0RNNU5GOURiMjVwWTJGc1gzTndjbWx1WjE5M1lYTm9aWEp6WDBSSlRsODJOemsyTFMxbGJpNXdaR1l8ODZiMjA5MDhiODRmNWZkOTUyNDEyYjNjNjQxMmMxMzVjOWVhZWI4OGMwMGFhMDIyNjE2YmE0ODkyNmZjZDQyMQ'),
    'washerking-1440': ('WasherKing', 'https://washerking.com/wp-content/uploads/2022/11/DIN-1440.pdf'),
}
# These supplier listings give nominal size and DIN designation without an attached size table.
# Preserve their SKUs and explicitly identify the independent standard-envelope cross-reference.
WASHERS['DIN 6796']=('conical-washer','norelem-6796',table('6 8 10 12 14 16 20',['bore','outerDiameter','thickness','rise'],'6.4 8.4 10.5 13 15 17 21','14 18 23 29 35 39 45','1.5 2 2.5 3 3.5 4 5','.5 .6 .7 .95 1.15 1.25 1.4'))
WASHERS['DIN 1440']=('washer','washerking-1440',table('3 4 5 6 8 10 12 14 16 18 20 22 23 24 25 26 27 28 30 32 33 35 36 40 45 50 55 60 65 70 80 100',['bore','outerDiameter','thickness'],'3 4 5 6 8 10 12 14 16 18 20 22 23 24 25 26 27 28 30 32 33 35 36 40 45 50 55 60 65 70 80 100','6 8 10 12 16 20 25 28 28 30 32 34 36 38 40 40 40 42 45 50 50 52 52 58 62 68 75 80 90 95 110 125','.8 .8 .8 1.6 2 2.5 3 3 3 4 4 4 4 4 4 5 5 5 5 5 5 6 6 6 7 8 9 9 9 10 12 14'))

presets={}; excluded=[]; imported=[]

def add(row, part, parameters, verified, standard, drawing=None):
    designation=f'{standard} M{row["diameter"]:g}' if row['diameter'] else standard
    if part in ['threaded-rod','spring-pin','cotter-pin']: designation+=f' × {row["length"]:g}'
    key=part+json.dumps(parameters,sort_keys=True)
    if key in presets:
        entry=presets[key]; entry['catalog']['productCodes'].append(row['sku']); entry['catalog']['alternateSourceUrls'].append(row['url'])
    else:
        entry={'partId':part,'id':'gvyntok-'+hashlib.sha256(key.encode()).hexdigest()[:12], 'name':designation, 'description':'Supplier stock dimensions · '+standard, 'parameters':parameters,'catalog':{'designation':designation,'standard':standard,'sourceName':'Gvyntok','sourceUrl':row['url'],'verifiedParameters':verified,'productCodes':[row['sku']],'alternateSourceUrls':[STANDARD_REFERENCES[drawing][1] if drawing in STANDARD_REFERENCES else BASE+drawing+'.pdf'] if drawing else []}}
        if drawing in STANDARD_REFERENCES:
            entry['description']=f'Gvyntok nominal stock size; DIN envelope dimensions cross-referenced to {STANDARD_REFERENCES[drawing][0]}. Supplier tolerances are not asserted.'
        presets[key]=entry
    imported.append(row['sku'])

for section in ['gajki','shajby-koltsa','shpilki','shplinty-i-strubtsiny']:
    data=json.loads((DATA/f'gvyntok-{section}.json').read_text())
    cats={c['url']:c for c in data['categories']}
    for row in data['products']:
        d=row['diameter']; st=row['standard']; c=cats[row['categoryUrl']]
        if section == 'shpilki' and row['pitch'] and row['pitch'] >= 100 and row['length'] < 10:
            row['pitch'], row['length'] = row['length'], row['pitch']
        if not st:
            match=re.search(r'DIN\s*(\d+)',row['sourceTitle']); st='DIN '+match.group(1) if match else None
        if section=='shajby-koltsa' and row['categoryUrl'].endswith('/shajba-latunnaya/'):
            st='DIN 125'
        parameters=None
        if section=='gajki' and st in NUTS and d in NUTS[st][2]:
            part,drawing,t=NUTS[st];parameters={'bore':d,**t[d]};verified=list(parameters)
            if part=='flange-nut':parameters['flangeThickness']=round(parameters['height']*.18,4)
            add(row,part,parameters,verified,st,drawing)
        elif section=='shajby-koltsa' and st in WASHERS and d in WASHERS[st][2]:
            part,drawing,t=WASHERS[st];parameters={**t[d]};verified=list(parameters)
            if part=='toothed-washer':parameters.update(teeth=12,toothDepth=round((parameters['outerDiameter']-parameters['bore'])*.2,4))
            add(row,part,parameters,verified,st,drawing)
        elif st=='DIN 7603' and row['pitch'] and row['length']:
            parameters={'bore':d,'outerDiameter':row['pitch'],'thickness':row['length']};add(row,'washer',parameters,list(parameters),st)
        elif section=='shpilki' and d in PITCH and row['length']:
            parameters={'diameter':d,'length':row['length'],'pitch':row['pitch'] or PITCH[d],'handedness':'left' if 'levoj' in row['categoryUrl'] else 'right','threadMode':'envelope'}
            add(row,'threaded-rod',parameters,['diameter','length','handedness'],st or 'DIN 975')
        elif st in ['DIN 471','DIN 472']:
            mounting='external' if st=='DIN 471' else 'internal'
            t=CIRCLIPS[mounting].get(str(d))
            if t and 'd3' in t and 's' in t:
                band=t.get('b',t.get('~b')); offset=band*.3
                hole=t.get('d5 min', max(.4,t.get('a',2)*.35))
                ear=t.get('a',max(hole*1.8,band*1.2))
                inner=t['d3'] if mounting=='external' else t['d3']-2*(band-offset)
                outer=t['d3'] if mounting=='internal' else t['d3']+2*(band-offset)
                center=outer/2-(outer-inner)*.15 if mounting=='external' else inner/2+(outer-inner)*.15
                gap=max(26,math.degrees(math.asin(min(.95,(ear/2+.16)/center)))*2+3)
                parameters={'mounting':mounting,'outerDiameter':round(outer,5),'innerDiameter':round(inner,5),'thickness':t['s'],'eccentricity':round(offset,5),'earDiameter':ear,'holeDiameter':hole,'gapAngle':round(gap,3)}
                verified=['thickness','innerDiameter' if mounting=='external' else 'outerDiameter']
                if mounting=='internal':verified.append('holeDiameter')
                add(row,'retaining-ring',parameters,verified,st,'060-440-001' if mounting=='external' else '060-450-001')
        elif st=='DIN 1481' and d in PINS and row['length']:
            t=PINS[d];parameters={'diameter':d,'length':row['length'],'oversize':round(t['freeDiameter']-d,4),'wall':t['wall'],'chamfer':t['chamfer'],'slotAngle':32,'installedSlotAngle':8}
            add(row,'spring-pin',parameters,['diameter','length','oversize','wall','chamfer'],st,'080-080-001')
        if parameters is None:excluded.append({'sku':row['sku'],'standard':st,'sourceUrl':row['url'],'category':c['sourceTitle'],'reason':'Unsupported shape or dimensions unavailable in the reviewed drawing.'})

output={}
for entry in presets.values():output.setdefault(entry.pop('partId'),[]).append(entry)
folder=ROOT/'src/catalog/generated';folder.mkdir(exist_ok=True)
(folder/'gvyntok-hardware-presets.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
report={'importedProductRows':len(imported),'geometryPresets':len(presets),'byPart':{k:len(v) for k,v in output.items()},'excludedProducts':excluded}
(DATA/'gvyntok-hardware-mapping-coverage.json').write_text(json.dumps(report,ensure_ascii=True,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='excludedProducts'},indent=2));print('Excluded',len(excluded))
