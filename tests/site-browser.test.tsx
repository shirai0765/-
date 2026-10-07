import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DISTRICTS, LOTS } from '../src/data/district';
import type { GameState } from '../src/model';
import { applyAction, createGame } from '../src/sim/engine';
import SiteBrowser from '../src/ui/SiteBrowser';

// Select local filter values for CPU presentation checks. Simulation stays real.
// The setter spies let us check explicit reset/navigation without a DOM or GPU.
const filters = vi.hoisted(() => ({ index: 0, values: [] as unknown[], setters: [] as ReturnType<typeof vi.fn>[] }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => {
    const index = filters.index++, setter = vi.fn();
    filters.setters[index] = setter;
    return [filters.values[index] ?? initial, setter];
  } };
});

const sites = LOTS.filter(lot => lot.available);
const ids = (html: string) => [...html.matchAll(/data-lot-id="([^"]+)"/g)].map(match => match[1]);

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}

function render(state: GameState, values: unknown[] = [], onSelectLot = vi.fn(), mapMode: 'game' | 'real' = 'game') {
  filters.index = 0;
  filters.values = values;
  filters.setters = [];
  const tree = SiteBrowser({ state, selectedLotId: null, onSelectLot, mapMode });
  return { tree, html: renderToStaticMarkup(tree), onSelectLot };
}

function ownedCompany() {
  let state = createGame('検索する会社', 980);
  state.cash = 500_000_000;
  state = applyAction(state, { type: 'openStore', lotId: 'center-01', style: 'standard' });
  state = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { name: 'Cafe ZERO' } });
  state = applyAction(state, { type: 'buyProperty', lotId: 'center-01' });
  return applyAction(state, { type: 'buyProperty', lotId: 'dogenzaka-01' });
}

beforeEach(() => { filters.index = 0; filters.values = []; filters.setters = []; });

describe('expanded sites remain easy to find without changing the company', () => {
  it('lists every economic site once and truly groups the separate data batches by district', () => {
    const state = createGame(), before = structuredClone(state);
    const { html } = render(state);
    const expected = Object.keys(DISTRICTS).flatMap(district => sites.filter(lot => lot.district === district).map(lot => lot.id));
    expect(ids(html)).toEqual(expected);
    expect(new Set(ids(html)).size).toBe(sites.length);
    expect(html).toContain(`表示 ${sites.length} / 全${sites.length}区画`);
    expect(html).not.toContain('物件購入価格');
    expect(html).not.toMatch(/利益|利回り|予測|見込み/);
    expect(state).toEqual(before);
  });

  it('combines district and status with partial property or normalized store-name search', () => {
    const state = ownedCompany(), before = structuredClone(state);
    const byStore = render(state, ['store', 'center', 'district', '  ｃａｆｅ　zero  ']);
    expect(ids(byStore.html)).toEqual(['center-01']);
    expect(byStore.html).toContain('Cafe ZERO');
    expect(byStore.html).toContain('is-store');
    expect(byStore.html).toContain('店舗営業中・物件保有');
    const query = '宇田川';
    expect(ids(render(state, ['all', 'all', 'district', query]).html).sort()).toEqual(sites.filter(lot => lot.name.includes(query)).map(lot => lot.id).sort());
    expect(ids(render(state, ['available', 'dogenzaka', 'district']).html)).toContain('dogenzaka-01');
    expect(ids(render(state, ['available', 'center', 'district']).html)).not.toContain('center-01');
    expect(state).toEqual(before);
  });

  it.each([
    { values: ['property', 'dogenzaka', 'district', '絶対にない物件名'], label: '条件を解除する' },
    { values: ['store', 'center', 'district', 'Cafe'], label: '全区画を表示' },
  ])('explicitly clears name, district and state filters through $label', ({ values, label }) => {
    const state = ownedCompany(), before = structuredClone(state);
    const { tree, html, onSelectLot } = render(state, values);
    const reset = elements(tree).find(element => element.type === 'button' && element.props.children === label)!;
    expect(reset).toBeDefined();
    if (label === '条件を解除する') {
      expect(ids(html)).toHaveLength(0);
      expect(html).toContain('この条件に合う区画はありません');
      expect(html).not.toContain('全区画を表示');
    }
    expect(filters.setters.every(setter => setter.mock.calls.length === 0)).toBe(true);
    (reset.props.onClick as () => void)();
    expect(filters.setters[0]).toHaveBeenCalledExactlyOnceWith('all');
    expect(filters.setters[1]).toHaveBeenCalledExactlyOnceWith('all');
    expect(filters.setters[3]).toHaveBeenCalledExactlyOnceWith('');
    expect(filters.setters[2]).not.toHaveBeenCalled();
    expect(onSelectLot).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });

  it('sorts by known purchase price and shows that price only in the purchase comparison', () => {
    const state = ownedCompany(), before = structuredClone(state);
    const { html } = render(state, ['all', 'all', 'purchase']);
    expect(ids(html)).toEqual([...sites].sort((a, b) => a.purchasePrice - b.purchasePrice).map(lot => lot.id));
    expect(html).toContain('物件の購入価格が低い順');
    const ownedRow = html.match(/<button[^>]*data-lot-id="dogenzaka-01"[^>]*>(.*?)<\/button>/)?.[1];
    expect(ownedRow).toContain('自社物件・店舗家賃なし');
    expect(ownedRow).toContain('is-property');
    expect(ownedRow).not.toContain('物件購入価格');
    const unowned = sites.find(lot => !state.properties.some(property => property.lotId === lot.id))!;
    expect(html).toContain(`物件購入価格 ¥${unowned.purchasePrice.toLocaleString('ja-JP')}`);
    expect(render(state, ['all', 'all', 'rent']).html).not.toContain('物件購入価格');
    expect(state).toEqual(before);
  });

  it('routes an outer candidate by its exact id and keeps real-map support separate from the full list', () => {
    const state = createGame(), before = structuredClone(state);
    const { tree, html, onSelectLot } = render(state, [], vi.fn(), 'real');
    const target = sites.at(-1)!;
    const button = elements(tree).find(element => element.props['data-lot-id'] === target.id)!;
    expect(button).toBeDefined();
    expect(ids(html)).toHaveLength(sites.length);
    expect(html).toContain(`実測表示は4地点に対応。全${sites.length}区画の経営操作ができます`);
    expect(onSelectLot).not.toHaveBeenCalled();
    (button.props.onClick as () => void)();
    expect(onSelectLot).toHaveBeenCalledExactlyOnceWith(target.id);
    expect(state).toEqual(before);
  });
});
