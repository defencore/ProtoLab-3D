#!/usr/bin/env python3
"""Inventory every public supplier category page and cache product dimension tables.

Run: python3 scripts/import-promtehimport.py --workers 6
The importer is resumable. It never substitutes category filter values for dimensions.
Only parsed text and numeric evidence are cached; product images are not downloaded.
"""
from __future__ import annotations
import argparse, concurrent.futures, gzip, hashlib, html, itertools, json, re, threading, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE = 'https://promtehimport.com.ua'
CATEGORIES = {
 'c34': 'radialni-odnoryadni-pidshipniki-c34',
 'c35': 'samovstanovlyuvalni-dvoryadni-kulkovi-pidshipniki-c35',
 'c36': 'radialno-uporni-kulkovi-pidshipniki-c36',
 'c37': 'korpusni-pidshipnikovi-vuzli-c37',
 'c38': 'uporni-kulkovi-pidshipniki-c38',
 'c39': 'rolikovi-konichni-pidshipniki-c39',
 'c40': 'pidshipniki-scho-zakriplyuyutsya-dlya-korpusiv-c40',
 'c42': 'rolikovi-sferichni-pidshipniki-c42',
 'c43': 'rolikovi-cilindrichni-pidshipniki-c43',
 'c44': 'golchasti-pidshipniki-c44',
 'c45': 'obginni-mufti-c45',
 'c46': 'uporni-rolikovi-pidshipniki-c46',
 'c47': 'liniyini-pidshipniki-c47',
 'c48': 'kombinovani-pidshipniki-c48',
 'c49': 'sharnirni-golovki-nakonechniki-shtokiv-c49',
 'c50': 'pidshipniki-kovzannya-c50',
 'c51': 'radialni-dvoryadni-kulkovi-pidshipniki-c51',
 'c52': 'zakriplyuvalni-vtulki-c52',
 'c54': 'salniki-c54',
}

def clean(value):
 return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', value)).split())

def source_features(description):
 result={}
 text=description.lower()
 if re.search(r'\u043a\u0443\u043b\u044c\u043a\u043e\u0432[\u0430-\u044f\u0456\u0457\u0454\s,]*\u043e\u0434\u043d\u043e\u0440\u044f\u0434|\u043a\u0443\u043b\u044c\u043a\u043e\u0432[\u0430-\u044f\u0456\u0457\u0454\s,]*\u0440\u0430\u0434\u0456\u0430\u043b\u044c\u043d[\u0430-\u044f\u0456\u0457\u0454\s,]*\u043e\u0434\u043d\u043e\u0440\u044f\u0434|\u043a\u0443\u043b\u044c\u043a\u043e\u0432[\u0430-\u044f\u0456\u0457\u0454\s,]*\u0440\u0430\u0434\u0456\u0430\u043b\u044c\u043d[\u0430-\u044f\u0456\u0457\u0454\s,]*\u043e\u0434\u043d\u043e\u0440\u044f\u0434',text):result['type']='single-row ball'
 seal=re.search(r'\u0443\u0449\u0456\u043b\u044c\u043d\u044e\u0432\u0430\u0447 \u043f\u0456\u0434\u0448\u0438\u043f\u043d\u0438\u043a\u0430:\s*([^:]+?)(?=\u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0456\u0439|\u0437\u043e\u0432\u043d\u0456\u0448\u043d\u0456\u0439|\u0448\u0438\u0440\u0438\u043d\u0430|\u0430\u043d\u0430\u043b\u043e\u0433\u0438|\u0442\u0435\u0445\u043d\u0456\u0447\u043d\u0456|$)',text)
 implicit=re.search(r'\u0443\u0449\u0456\u043b\u044c\u043d\u0435\u043d[^.]{0,100}(?:\u0433\u0443\u043c\u0438|\u043a\u0430\u0443\u0447\u0443\u043a|\u043f\u043b\u0430\u0441\u0442\u043c\u0430\u0441)[^.]{0,25}',text)
 label=seal.group(1).strip() if seal else (implicit.group(0) if implicit else '')
 if re.search(r'\u043a\u0430\u0443\u0447\u0443\u043a|\u0433\u0443\u043c\u0438|\u0433\u0443\u043c\u043e\u0432|\u0440\u0435\u0437\u0438\u043d|\u043f\u043b\u0430\u0441\u0442\u043c\u0430\u0441',label):result['closure']='rubber-one' if re.search(r'\u043e\u0434\u043d\u043e\u0441\u0442\u043e\u0440\u043e\u043d|\u043e\u0434\u043d\u043e\u0431\u0456\u0447',label) else 'rubber'
 elif re.search(r'\u043c\u0435\u0442\u0430\u043b|\u0437\u0430\u0445\u0438\u0441\u043d[\u0430-\u044f\u0456\u0457\u0454]* \u0448\u0430\u0439\u0431',label):result['closure']='metal-one' if re.search(r'\u043e\u0434\u043d\u043e\u0441\u0442\u043e\u0440\u043e\u043d|\u043e\u0434\u043d\u043e\u0431\u0456\u0447',label) else 'metal'
 elif seal and re.search(r'\u0432\u0456\u0434\u043a\u0440\u0438\u0442',label):result['closure']='open'
 return result

def atomic_json(path, value):
 path.parent.mkdir(parents=True, exist_ok=True)
 temporary = path.with_suffix(path.suffix + '.tmp')
 temporary.write_text(json.dumps(value, ensure_ascii=True, separators=(',', ':')))
 temporary.replace(path)

def fetch(url, retries=3):
 for attempt in range(retries):
  try:
   request = Request(url, headers={'User-Agent': 'ProtoLab-Catalog-Importer/1.0 (public dimensional catalog; no images)', 'Accept-Encoding': 'gzip'})
   with urlopen(request, timeout=15) as response:
    content = response.read()
    if response.headers.get('Content-Encoding') == 'gzip': content = gzip.decompress(content)
    return content.decode('utf-8'), response.url
  except Exception as error:
   if attempt + 1 == retries: raise
   delay = 2 ** attempt
   if isinstance(error, HTTPError) and error.code in (429, 503): delay = max(10, delay)
   time.sleep(delay)

def parse_category(source, url):
 links = sorted(set(re.findall(r'href=["\'](/offer/[^"\']+)["\']', source)))
 pages = [int(value) for value in re.findall(r'pageNumber(?:=|%3D)(\d+)', source)]
 counts = re.findall(r'\u0422\u043e\u0432\u0430\u0440\u0456\u0432:\s*(?:<[^>]+>\s*)*(\d[\d\s]*)', source)
 return {'url': url, 'pages': max(pages or [1]), 'reportedCount': max((int(re.sub(r'\s','',count)) for count in counts), default=None), 'products': links}

def parse_product(source, url):
 payloads = re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', source, re.S)
 product = None
 for payload in payloads:
  try:
   value = json.loads(payload)
   if isinstance(value, dict) and value.get('@type') == 'Product': product = value; break
  except ValueError: continue
 if product is None: raise ValueError('No Product structured record')
 rows = []
 for row in re.findall(r'<tr[^>]*>(.*?)</tr>', source, re.S):
  cells = [clean(cell) for cell in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)]
  if len(cells) >= 2 and any(cells): rows.append(cells)
 brand = product.get('brand') or {}
 return {'url': url, 'name': clean(product.get('name', '')), 'manufacturer': clean(brand.get('name', '')) if isinstance(brand,dict) else clean(str(brand)), 'features':source_features(clean(product.get('description',''))), 'tables': rows, 'checkedAt': datetime.now(timezone.utc).date().isoformat()}

def main():
 parser = argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--cache', type=Path, default=Path('/tmp/protolab-full-promtehimport-cache'))
 parser.add_argument('--output', type=Path, default=Path('data/promtehimport-inventory.json'))
 parser.add_argument('--workers', type=int, default=2)
 parser.add_argument('--request-delay', type=float, default=1.0)
 parser.add_argument('--refresh-categories', action='store_true')
 parser.add_argument('--refresh-web-cache', action='store_true', help='Replace public search-cache excerpts with complete live product tables')
 parser.add_argument('--inventory-only', action='store_true')
 parser.add_argument('--max-consecutive-failures', type=int, default=6)
 parser.add_argument('--cache-only', action='store_true')
 args = parser.parse_args()
 previous=json.loads(args.output.read_text()) if args.output.exists() else {}
 args.cache.mkdir(parents=True,exist_ok=True)
 workers = max(1,min(args.workers,8))
 lock=threading.Lock(); errors=[]
 def cached(kind,url,parse,refresh=False):
  key=hashlib.sha256(url.encode()).hexdigest()[:24]
  path=args.cache/kind/(key+'.json')
  if path.exists() and not refresh: return json.loads(path.read_text())
  source, final_url = fetch(url)
  data=parse(source,final_url)
  if kind=='products' and final_url!=url:data={**data,'url':url,'sourceUrl':final_url}
  atomic_json(path,data)
  time.sleep(max(0,args.request_delay))
  return data
 def category(task):
  code,page=task;url=f'{BASE}/{CATEGORIES[code]}/'+(f'?pageNumber={page}' if page>1 else '')
  try:return code,page,cached('categories',url,parse_category,args.refresh_categories)
  except Exception as error:return code,page,{'url':url,'error':str(error),'products':[],'pages':page}
 categories={};members={}
 if len(previous.get('categories',{}))==len(CATEGORIES) and not args.refresh_categories:
  categories=previous['categories']
  print(json.dumps({'phase':'cached-inventory','categories':len(categories),'pages':sum(category['pages'] for category in categories.values())}),flush=True)
 else:
  with concurrent.futures.ThreadPoolExecutor(workers) as pool:
   first=list(pool.map(category,[(code,1) for code in CATEGORIES]))
   for code,page,result in first:
    categories[code]={'url':f'{BASE}/{CATEGORIES[code]}/','reportedCount':result.get('reportedCount') or None,'pages':result['pages'],'fetchedPages':[],'failedPages':[],'productUrls':[]}
   remaining=[(code,page) for code in CATEGORIES for page in range(2,categories[code]['pages']+1)]
   print(json.dumps({'phase':'categories','categories':len(CATEGORIES),'pages':len(remaining)+19,'reportedProducts':sum(c['reportedCount'] or 0 for c in categories.values()) or None}),flush=True)
   def accept(code,page,result):
    entry=categories[code]
    if result.get('error'):entry['failedPages'].append({'page':page,'error':result['error']})
    else:entry['fetchedPages'].append(page)
    entry['productUrls'].extend(BASE+path for path in result['products'])
   for task in first:accept(*task)
   for i,result in enumerate(pool.map(category,remaining),1):
    accept(*result)
    if i%50==0:print(json.dumps({'phase':'categories','fetched':i+19,'total':len(remaining)+19}),flush=True)
 for code,entry in categories.items():
  if not entry['productUrls'] and code in previous.get('categories',{}):
   failure=entry['failedPages'];categories[code]=entry={**previous['categories'][code],'refreshFailures':failure}
  entry['productUrls']=sorted(set(entry['productUrls']))
  for url in entry['productUrls']:members.setdefault(url,[]).append(code)
 products={url:{**product,'categories':members[url]} for url,product in previous.get('products',{}).items() if url in members}
 for url in members:
  key=hashlib.sha256(url.encode()).hexdigest()[:24]
  cache_path=args.cache/'products'/(key+'.json')
  if cache_path.exists():
   data=json.loads(cache_path.read_text())
   if data.get('url')!=url:data={**data,'sourceUrl':data['url'],'url':url}
   products[url]={'categories':members[url],**data}
 for product in products.values():
  if product.get('description'):product['features']=source_features(product['description'])
  product.pop('description',None)
 manifest={'source':BASE,'snapshotDate':datetime.now(timezone.utc).date().isoformat(),'categories':categories,'uniqueProductCount':len(members),'products':products,'status':'inventory-complete' if args.inventory_only else 'fetching-products'}
 atomic_json(args.output,manifest)
 print(json.dumps({'phase':'inventory','uniqueProducts':len(members),'categories':{code:{'count':len(c['productUrls']),'pages':c['pages'],'failedPages':len(c['failedPages'])} for code,c in categories.items()}}),flush=True)
 if args.inventory_only or args.cache_only:
  manifest['status']=previous.get('status','inventory-complete') if args.cache_only else 'inventory-complete'
  atomic_json(args.output,manifest)
  return
 def product(url):
  try:
   refresh=args.refresh_web_cache and products.get(url,{}).get('retrieval')=='public-web-cache'
   data=cached('products',url,parse_product,refresh);return url,{'categories':members[url],**data}
  except Exception as error:return url,{'url':url,'categories':members[url],'error':str(error)}
 ordered=list(dict.fromkeys(url for row in itertools.zip_longest(*(c['productUrls'] for c in categories.values())) for url in row if url and (url not in products or products[url].get('error') or (args.refresh_web_cache and products[url].get('retrieval')=='public-web-cache'))))
 stopped=False;consecutive=0
 pool=concurrent.futures.ThreadPoolExecutor(workers)
 futures={pool.submit(product,url):url for url in ordered}
 try:
  for future in concurrent.futures.as_completed(futures):
   url,data=future.result();products[url]=data
   consecutive=consecutive+1 if data.get('error') else 0
   i=len(products)
   if i%25==0 or data.get('error'):
    atomic_json(args.output,manifest)
    print(json.dumps({'phase':'products','fetched':i,'total':len(members),'failed':sum('error' in p for p in products.values())}),flush=True)
   if consecutive>=args.max_consecutive_failures:
    stopped=True
    print(json.dumps({'phase':'connection-paused','consecutiveFailures':consecutive,'resume':'Run the same command again; successful products remain cached.'}),flush=True)
    for pending in futures:pending.cancel()
    break
 finally:pool.shutdown(wait=True,cancel_futures=True)
 manifest['status']='connection-paused' if stopped else 'source-fetch-complete';atomic_json(args.output,manifest)
 print(json.dumps({'phase':'complete','uniqueProducts':len(members),'fetchedProducts':len(products),'failedProducts':sum('error' in p for p in products.values()),'failedCategoryPages':sum(len(c['failedPages']) for c in categories.values())}),flush=True)

if __name__=='__main__':main()
