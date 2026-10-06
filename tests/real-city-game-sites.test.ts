import { describe, expect, it } from 'vitest';
import { LOTS } from '../src/data/district';
import { createGame, applyAction, previewWeek, getSummary } from '../src/sim/engine';
import { createEnvelope, decodeEnvelope } from '../src/persistence';
import { getRealCitySites, hasRealCityAnchor, REAL_CITY_ANCHORS } from '../src/realcity/gameSites';

const sourceRoot = new URL('../public/models/real-shibuya/', import.meta.url);
// Only this source-evidence test needs Node I/O; the browser project has no Node types.
async function readSource(path: string) {
  const fs = await import('node:' + 'fs') as { readFileSync(url: URL): Uint8Array };
  return new Uint8Array(fs.readFileSync(new URL(path, sourceRoot)));
}
const fixture = () => ({ ...createGame('表示対応の検査', 812), cash: 1_000_000_000 });
const site = (s: ReturnType<typeof createGame>, lotId: string) => getRealCitySites(s, lotId).find(p => p.lotId === lotId)!;
function freezeDeep(value: object) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
}

describe('display-only real-city game sites', () => {
  it('maps one explicit site in each district without reducing the 32 economic lots', () => {
    const available = LOTS.filter(l => l.available);
    expect(available).toHaveLength(32);
    expect(REAL_CITY_ANCHORS.map(a => a.lotId)).toEqual(['center-01', 'dogenzaka-01', 'miyashita-01', 'sakuragaoka-01']);
    expect(new Set(REAL_CITY_ANCHORS.map(a => a.lotId)).size).toBe(4);
    expect(new Set(REAL_CITY_ANCHORS.map(a => LOTS.find(l => l.id === a.lotId)!.district)).size).toBe(4);
    expect(available.filter(l => hasRealCityAnchor(l.id))).toHaveLength(4);
    expect(available.filter(l => !hasRealCityAnchor(l.id))).toHaveLength(28);
    expect(hasRealCityAnchor('missing')).toBe(false);
    expect(hasRealCityAnchor(LOTS.find(l => !l.available)!.id)).toBe(false);
  });

  it.each(['center-01', 'dogenzaka-01', 'miyashita-01', 'sakuragaoka-01'])('derives all four ownership states and fictional labels for %s', lotId => {
    let s = fixture();
    expect(site(s, lotId)).toMatchObject({ status: 'empty', selected: true, label: LOTS.find(l => l.id === lotId)!.name });
    s = applyAction(s, { type: 'openStore', lotId, style: 'standard', name: '自分で付けた店名' });
    expect(site(s, lotId)).toMatchObject({ status: 'store', label: '自分で付けた店名' });
    s = applyAction(s, { type: 'buyProperty', lotId });
    expect(site(s, lotId).status).toBe('both');
    s = applyAction(s, { type: 'closeStore', storeId: s.stores[0].id });
    expect(site(s, lotId)).toMatchObject({ status: 'property', label: LOTS.find(l => l.id === lotId)!.name });
    s = applyAction(s, { type: 'sellProperty', propertyId: s.properties[0].id });
    expect(site(s, lotId).status).toBe('empty');
  });

  it('does not move unsupported stores or properties onto the four displayed anchors', () => {
    let s = fixture();
    s = applyAction(s, { type: 'openStore', lotId: 'center-02', style: 'takeaway', name: '未配置の店舗' });
    s = applyAction(s, { type: 'buyProperty', lotId: 'sakuragaoka-06' });
    const sites = getRealCitySites(s, 'center-02');
    expect(sites).toHaveLength(4);
    expect(sites.every(p => p.status === 'empty' && !p.selected)).toBe(true);
    expect(s.stores[0].lotId).toBe('center-02');
    expect(s.properties[0].lotId).toBe('sakuragaoka-06');
    expect(LOTS.filter(l => l.available)).toHaveLength(32);
  });

  it('keeps selection independent from ownership and returns detached view data', () => {
    const s = createGame(), first = getRealCitySites(s, 'center-01'), second = getRealCitySites(s, null);
    expect(first.filter(p => p.selected).map(p => p.lotId)).toEqual(['center-01']);
    expect(second.every(p => !p.selected)).toBe(true);
    expect(first[0].position).not.toBe(second[0].position);
    expect(first[0].view?.position).not.toBe(second[0].view?.position);
    const original = structuredClone(second);
    Object.assign(first[0], { label: '返却値の変更', status: 'both' });
    Object.assign(first[0].position, { 0: 1e8 });
    if (first[0].view) Object.assign(first[0].view.target, { 0: 1e8 });
    expect(getRealCitySites(s, null)).toEqual(original);
  });

  it('preserves frozen old state, economic coordinates, predictions and save payloads', async () => {
    const s = applyAction(createGame(), { type: 'openStore', lotId: 'center-01', style: 'standard' });
    const before = JSON.stringify(s), coordinates = JSON.stringify(LOTS), report = previewWeek(s), summary = getSummary(s), envelope = await createEnvelope(s);
    freezeDeep(s);
    getRealCitySites(s, 'center-01');
    getRealCitySites(s, null);
    expect(JSON.stringify(s)).toBe(before);
    expect(JSON.stringify(LOTS)).toBe(coordinates);
    expect(previewWeek(s)).toEqual(report);
    expect(getSummary(s)).toEqual(summary);
    const after = await createEnvelope(s);
    expect(after.payload).toBe(envelope.payload);
    expect(after.checksum).toBe(envelope.checksum);
    expect(after.schema).toBe(1);
    expect(await decodeEnvelope(after)).toEqual(s);
    expect(s).not.toHaveProperty('realCity');
  });

  it('binds each anchor to the actual acquired tile hash and exact batch/gml identifier', async () => {
    const decoder = new TextDecoder();
    const manifest = JSON.parse(decoder.decode(await readSource('manifest.json')));
    for (const anchor of REAL_CITY_ANCHORS) {
      const bytes = await readSource(anchor.tileUri), header = new DataView(bytes.buffer);
      expect(decoder.decode(bytes.subarray(0, 4))).toBe('b3dm');
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      expect(Array.from(digest, b => b.toString(16).padStart(2, '0')).join('')).toBe(anchor.sourceSha256);
      expect(manifest.receipts.some((r: { sha256: string }) => r.sha256 === anchor.sourceSha256)).toBe(true);
      const offset = 28 + header.getUint32(12, true) + header.getUint32(16, true);
      const table = JSON.parse(decoder.decode(bytes.subarray(offset, offset + header.getUint32(20, true))));
      expect(table.gml_id[anchor.batchId]).toBe(anchor.gmlId);
      expect(anchor.coordinateSystem).toBe('real-shibuya-2025-v1');
      const point = site(createGame(), anchor.lotId).position;
      expect(point.every(Number.isFinite)).toBe(true);
      expect(point[0]).toBeGreaterThanOrEqual(anchor.buildingBounds.min[0]);
      expect(point[0]).toBeLessThanOrEqual(anchor.buildingBounds.max[0]);
      expect(point[2]).toBeGreaterThanOrEqual(anchor.buildingBounds.min[2]);
      expect(point[2]).toBeLessThanOrEqual(anchor.buildingBounds.max[2]);
      expect(point[1]).toBeGreaterThan(anchor.buildingBounds.max[1]);
      expect(anchor.view.position.every(Number.isFinite)).toBe(true);
      expect(anchor.view.position[1]).toBeGreaterThan(anchor.buildingBounds.max[1]);
    }
  });
});
