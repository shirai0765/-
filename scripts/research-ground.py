#!/usr/bin/env python3
"""Bounded official GSI seamless aerial imagery; raw JPEGs are retained unchanged."""
import argparse,concurrent.futures,datetime,hashlib,json,math,pathlib,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]/'public/models/real-shibuya-ground'
ZOOM=18;CENTER=[139.7006,35.6595];BBOX=[139.6952,35.6552,139.7060,35.6638]
def tile(lon,lat):
 n=2**ZOOM;return math.floor((lon+180)/360*n),math.floor((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
def lon(x):return x/2**ZOOM*360-180
def lat(y):return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/2**ZOOM))))
def fetch(pair):
 x,y=pair;url=f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{ZOOM}/{x}/{y}.jpg'
 with urllib.request.urlopen(url,timeout=30)as response:data=response.read(2*1024*1024)
 if data[:2]!=b'\xff\xd8':raise RuntimeError('Not JPEG: '+url)
 name=f'{ZOOM}-{x}-{y}.jpg';(ROOT/name).write_bytes(data)
 return {'file':name,'url':url,'x':x,'y':y,'boundsLonLat':[lon(x),lat(y+1),lon(x+1),lat(y)],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def main():
 global ZOOM
 parser=argparse.ArgumentParser();parser.add_argument('--zoom',type=int,choices=[17,18],default=18);ZOOM=parser.parse_args().zoom
 ROOT.mkdir(parents=True,exist_ok=True);west,south=tile(BBOX[0],BBOX[1]);east,north=tile(BBOX[2],BBOX[3]);pairs=[(x,y)for y in range(north,south+1)for x in range(west,east+1)]
 if len(pairs)>100:raise RuntimeError('Tile count budget exceeded')
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:tiles=list(pool.map(fetch,pairs))
 manifest={'status':'downloaded','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'国土地理院 シームレス空中写真','attribution':'地理院タイル（シームレス空中写真）を使用','sourceInfo':'https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto','terms':'https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html','zoom':ZOOM,'requestedBboxLonLat':BBOX,'centerLonLat':CENTER,'imageryModified':False,'terrain':'Flat display approximation. Imagery is georeferenced with Web Mercator tile bounds into local ENU; no DEM or geoid correction is claimed.','captureDate':'Varies across source mosaic; publication dataset year is not an imagery capture date.','tiles':tiles,'totalBytes':sum(t['bytes']for t in tiles)}
 (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'tiles':len(tiles),'bytes':manifest['totalBytes']}))
if __name__=='__main__':main()
