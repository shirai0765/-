#!/usr/bin/env python3
"""Fetch a bounded official PLATEAU Shibuya 3D Tiles subset; TLS remains verified."""
import argparse, datetime, hashlib, json, math, pathlib, struct, urllib.parse, urllib.request

CATALOG = 'https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets'
ROOT = pathlib.Path(__file__).resolve().parents[1] / 'public/models/real-shibuya'
CENTER = [139.7006, 35.6595]
# Approx. 550 x 550 metres around scramble crossing; complete intersecting tiles retained.
BBOX = [139.69755, 35.65702, 139.70365, 35.66198]

def ecef(lon, lat, h=0):
    lon, lat = map(math.radians, (lon, lat)); n = 6378137 / math.sqrt(1 - .00669437999014 * math.sin(lat)**2)
    return [(n+h)*math.cos(lat)*math.cos(lon), (n+h)*math.cos(lat)*math.sin(lon), (n*(1-.00669437999014)+h)*math.sin(lat)]

def multiply(a,b):
    return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]

IDENTITY=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
def intersects(node, matrix):
    bv=node.get('boundingVolume', {})
    if 'region' in bv:
        w,s,e,n=map(math.degrees,bv['region'][:4]); return not(e<BBOX[0] or w>BBOX[2] or n<BBOX[1] or s>BBOX[3])
    # Conservative ECEF sphere around transformed OBB/sphere; errs toward inclusion.
    value=bv.get('box') or bv.get('sphere')
    if not value: return True
    center=[sum(matrix[k*4+r]*value[k] for k in range(3))+matrix[12+r] for r in range(3)]
    scale=max(math.sqrt(sum(matrix[k*4+r]**2 for r in range(3))) for k in range(3))
    radius=(sum(math.sqrt(sum(value[k+r]**2 for r in range(3))) for k in (3,6,9)) if 'box' in bv else value[3])*scale
    target=ecef(*CENTER,50)
    return math.dist(center,target) <= radius+500

class Fetcher:
    def __init__(self, limit): self.limit=limit; self.total=0; self.receipts=[]; self.seen={}
    def read(self,url):
        req=urllib.request.Request(url,headers={'User-Agent':'ShibuyaGroupPrototype/0.1 (PLATEAU research)'})
        with urllib.request.urlopen(req,timeout=45) as r:
            size=int(r.headers.get('Content-Length',0))
            if self.total+size>self.limit: raise RuntimeError('Download budget exceeded; no complete tileset published')
            data=r.read(self.limit-self.total+1)
        self.total+=len(data)
        if self.total>self.limit: raise RuntimeError('Download budget exceeded')
        self.receipts.append({'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        return data
    def content(self,url,matrix):
        if url in self.seen:return self.seen[url]
        ext=pathlib.PurePosixPath(urllib.parse.urlparse(url).path).suffix.lower()
        data=self.read(url); name=hashlib.sha256(url.encode()).hexdigest()[:20]+ext
        if ext=='.json':
            doc=json.loads(data)
            if 'root' not in doc: raise RuntimeError('Unsupported non-tileset external JSON')
            root=self.tile(doc['root'],url,matrix)
            if root is None:return None
            doc['root']=root; data=json.dumps(doc).encode()
        elif ext not in ('.b3dm','.glb','.pnts','.i3dm'):
            raise RuntimeError('Unsupported external tile format: '+ext)
        (ROOT/name).write_bytes(data);self.seen[url]=name;return name
    def tile(self,node,base,parent):
        matrix=multiply(parent,node.get('transform',IDENTITY))
        if not intersects(node,matrix):return None
        result={k:v for k,v in node.items() if k not in ('children','content','contents')}
        children=[x for c in node.get('children',[]) if (x:=self.tile(c,base,matrix)) is not None]
        if children:result['children']=children
        contents=node.get('contents', [node['content']] if 'content' in node else [])
        retained=[]
        for content in contents:
            uri=content.get('uri',content.get('url'))
            if not uri:continue
            local=self.content(urllib.parse.urljoin(base,uri),matrix)
            if local:retained.append({**{k:v for k,v in content.items() if k not in ('uri','url')},'uri':local})
        if len(retained)==1:result['content']=retained[0]
        elif retained:result['contents']=retained
        return result if children or retained else None

def validate_local():
    """Inspect the actual downloaded binary container and embedded resource references."""
    tiles=json.loads((ROOT/'tileset.json').read_text()); leaves=[]; resources=[]
    def walk(node):
        content=node.get('content',{}); uri=content.get('uri')
        if uri:
            if not (ROOT/uri).is_file(): raise RuntimeError('Missing local tile '+uri)
            resources.append(uri)
            if not node.get('children'): leaves.append(uri)
        for child in node.get('children',[]): walk(child)
    walk(tiles['root']); images=triangles=0; extensions=set(); names=set(); external=[]
    for uri in set(resources):
        data=(ROOT/uri).read_bytes()
        if data[:4]!=b'b3dm':raise RuntimeError('Validation currently supports b3dm only')
        header=struct.unpack_from('<7I',data); offset=28+sum(header[3:]); length=struct.unpack_from('<I',data,offset+12)[0]
        doc=json.loads(data[offset+20:offset+20+length]);extensions.update(doc.get('extensionsUsed',[]));images+=len(doc.get('images',[]))
        for kind in ('buffers','images'):
            external.extend(item['uri'] for item in doc.get(kind,[]) if item.get('uri') and not item['uri'].startswith('data:'))
        for mesh in doc.get('meshes',[]):
            for primitive in mesh['primitives']:
                if 'indices' in primitive:triangles+=doc['accessors'][primitive['indices']]['count']//3
        start=28+header[3]+header[4];batch=json.loads(data[start:start+header[5]].decode().strip() or '{}');names.update(n for n in batch.get('gml:name',[]) if n)
    if external:raise RuntimeError('Unresolved GLB external references: '+str(external))
    return {'b3dmCount':len(set(resources)),'leafTileCount':len(leaves),'embeddedImageCount':images,'allLodTriangles':triangles,'extensions':sorted(extensions),'externalReferences':external,'namedBuildings':sorted(names),'viewerIntegration':'Separate real-shibuya.html; compressed gameplay map is unchanged','verification':'Container and reference audit; browser coordinate/texture verification recorded separately'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--max-mb',type=int,default=80);parser.add_argument('--tileset-url');args=parser.parse_args()
    ROOT.mkdir(parents=True,exist_ok=True);fetch=Fetcher(args.max_mb*1024*1024)
    manifest={'status':'pending','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'centerLonLat':CENTER,'requestedBboxLonLat':BBOX,'sourceCatalog':CATALOG,'attribution':'国土交通省 Project PLATEAU','license':'Verify selected dataset license at its official G空間情報センター resource before distribution','coordinateSystem':'3D Tiles ECEF EPSG:4978; preserve hierarchy transforms. Region bounds are WGS84 radians. Translate/rotate to local ENU for gameplay.','scope':'Complete tiles intersecting requested bounds; not clipped individual buildings. Dataset year is survey publication vintage, not live scenery.'}
    try:
        if args.tileset_url:
            url=args.tileset_url;manifest['dataset']={'url':url,'year':'unverified'}
        else:
            catalog=json.loads(fetch.read(CATALOG));datasets=catalog if isinstance(catalog,list) else catalog.get('datasets',[])
            candidates=[d for d in datasets if d.get('type_en')=='bldg' and d.get('format')=='3D Tiles' and ('13113' in str(d.get('city_code','')) or '13113' in str(d.get('ward_code','')) or '渋谷' in d.get('name',''))]
            if not candidates:raise RuntimeError('No Shibuya building dataset in catalog')
            candidates.sort(key=lambda d:(bool(d.get('texture')),float(d.get('lod') or 0),int(d.get('year') or 0)),reverse=True)
            (ROOT/'catalog-candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2));manifest['dataset']=candidates[0];url=candidates[0]['url']
        local=fetch.content(url,IDENTITY)
        if not local:raise RuntimeError('No intersecting tiles found')
        (ROOT/'tileset.json').write_bytes((ROOT/local).read_bytes());manifest.update(status='downloaded',entrypoint='tileset.json',validation=validate_local())
    except Exception as error:
        manifest.update(status='blocked',error=str(error));print(str(error))
    manifest.update(totalBytes=fetch.total,receipts=fetch.receipts)
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':manifest['status'],'bytes':fetch.total,'files':len(fetch.receipts)}))
    return 0 if manifest['status']=='downloaded' else 1

if __name__=='__main__':raise SystemExit(main())
