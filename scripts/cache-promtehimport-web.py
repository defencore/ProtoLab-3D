#!/usr/bin/env python3
"""Cache exact supplier product tables from saved browser/search text when direct HTTP is unavailable.

Input is a text export from the public supplier pages, not a generated description.
Only enumerated Ukrainian product URLs and explicit dimensional rows are accepted.
"""
import argparse, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path

def parse(text, members):
 by_id = {re.search(r'-o(\d+)/?$', url).group(1):url for url in members if re.search(r'-o(\d+)/?$', url)}
 for section in re.split(r'\n-{20,}\n', text):
  urls = re.findall(r'https://promtehimport\.com\.ua/(?:ru/)?offer/[^\s)"<>]+', section)
  product_ids={match.group(1) for url in urls if (match:=re.search(r'-o(\d+)/?$',url))}
  # A multi-result search export is not a product page; never combine its tables.
  if len(product_ids)!=1: continue
  source_url = next((url for url in urls if re.search(r'-o(\d+)/?$', url) and re.search(r'-o(\d+)/?$', url).group(1) in by_id), None)
  url = by_id[re.search(r'-o(\d+)/?$',source_url).group(1)] if source_url else None
  if not url or 'Cache miss' in section[:500]: continue
  section = re.sub(r'cite[^†]+†([^]+)', r'\1', section)
  section = re.sub(r'cite[^]+', '', section)
  section = re.sub(r'L\d+: ?', '', section)
  lines = [line.strip() for line in section.splitlines() if line.strip()]
  title = next((line.lstrip('# ').strip() for line in lines if line.startswith('# ')), '')
  if not title:
   title = re.sub(r'^\u041a\u0443\u043f\u0438\u0442\u0438\s+|^\u041a\u0443\u043f\u0438\u0442\u044c\s+|\s+[\u0437\u0441] \u0434\u043e\u0441\u0442\u0430\u0432\u043a.*$', '', lines[0])
  rows = []
  for line in lines:
   if '|' in line:
    cells = [cell.strip() for cell in line.strip('|').split('|')]
    if len(cells) >= 2 and re.search(r'\d', ''.join(cells[1:])): rows.append(cells)
  assigned_rows=[]
  for i, line in enumerate(lines):
   assigned=re.match(r'^(d|D|B|C|Fw|T)\s*=\s*(\d+(?:[.,]\d+)?)\s*(?:mm|\u043c\u043c)',line)
   if assigned:assigned_rows.append([assigned.group(1),assigned.group(2)+' mm'])
   if i+1>=len(lines):continue
   if re.match(r'^[a-zA-Z][a-zA-Z0-9_{}]*$', line):
    at=i+1;symbol=line
    if at+1<len(lines) and re.match(r'^[a-zA-Z0-9]{1,3}$',lines[at]) and re.match(r'^(?:\d+(?:[.,]\d+)?(?:\s*(?:mm|\u043c\u043c))?|M\s*\d.*)$',lines[at+1]):symbol+=lines[at];at+=1
    if at<len(lines) and re.match(r'^\d+(?:[.,]\d+)?$',lines[at]) and at+1<len(lines) and lines[at+1] in ('mm','\u043c\u043c'): rows.append([symbol,lines[at]+' '+lines[at+1]])
    elif at<len(lines) and re.match(r'^(?:\d+(?:[.,]\d+)?\s*(mm|\u043c\u043c)|M\s*\d[^\n]*)$',lines[at]):rows.append([symbol,lines[at]])
   if re.search(r'\u0434\u0456\u0430\u043c\u0435\u0442\u0440|\u0448\u0438\u0440\u0438\u043d\u0430|\u0432\u0438\u0441\u043e\u0442\u0430|\u0434\u043e\u0432\u0436\u0438\u043d\u0430|\u043e\u0442\u0432\u043e\u0440\u0430\u043c\u0438|\u043e\u0442\u0432\u043e\u0440\u0456\u0432',line,re.I) and re.match(r'^\d+(?:[.,]\d+)?(?:\s*(?:mm|\u043c\u043c))?$',lines[i+1],re.I):rows.append([line,lines[i+1]])
  symbols={row[0] for row in rows}
  rows.extend(row for row in assigned_rows if row[0] not in symbols)
  numeric = [row for row in rows if re.search(r'\d', row[1])]
  if len(numeric)<3: continue
  brand = re.search(r'(?:\u0412\u0438\u0440\u043e\u0431\u043d\u0438\u043a|\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c):\s*([^\n]+)', section)
  if not brand: brand = re.search(r'\u0411\u0440\u0435\u043d\u0434\s*\|\s*([^\n|]+)', section)
  if not brand: brand = re.search(r'\u0411\u0440\u0435\u043d\u0434\s*\n+\s*([^\n]+)', section)
  yield {'url':url,'sourceUrl':source_url,'name':title,'manufacturer':brand.group(1).strip() if brand else '', 'tables':rows,'description':'','checkedAt':datetime.now(timezone.utc).date().isoformat(),'retrieval':'public-web-cache'}

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('input',nargs='+',type=Path)
 parser.add_argument('--inventory',type=Path,default=Path('data/promtehimport-inventory.json'))
 parser.add_argument('--cache',type=Path,default=Path('/tmp/protolab-full-promtehimport-cache/products'))
 args=parser.parse_args()
 inventory=json.loads(args.inventory.read_text());members={url for category in inventory['categories'].values() for url in category['productUrls']}
 args.cache.mkdir(parents=True,exist_ok=True)
 added=[]
 for path in args.input:
  for product in parse(path.read_text(),members):
   target=args.cache/(hashlib.sha256(product['url'].encode()).hexdigest()[:24]+'.json')
   if target.exists():continue
   target.write_text(json.dumps(product,ensure_ascii=True,separators=(',',':')));added.append(product['url'])
 print(json.dumps({'added':len(added),'urls':added}))

if __name__=='__main__':main()
