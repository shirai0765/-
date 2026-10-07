import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LOTS } from '../src/data/district';
import type { GameState, StoreStyle } from '../src/model';
import { applyAction, createGame } from '../src/sim/engine';
import { getSiteContext } from '../src/sim/siteContext';
import SiteBrowser from '../src/ui/SiteBrowser';
import SiteContextPanel from '../src/ui/SiteContextPanel';
import StoreOpeningPanel from '../src/ui/StoreOpeningPanel';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const opening = (state: GameState, lotId: string, style: StoreStyle) => renderToStaticMarkup(createElement(StoreOpeningPanel, {
  state, lotId, style, onStyleChange: () => undefined, onOpen: () => undefined, onFinance: () => undefined,
}));

describe('location choices from conditions and commitments', () => {
  it('shows site facts and known cash payment for every style, with no outcome oracle even in collapsed details', () => {
    const state = createGame();
    const before = structuredClone(state);
    for (const site of LOTS.filter(lot => lot.available)) {
      for (const style of ['standard', 'premium', 'takeaway'] as const) {
        const rendered = opening(state, site.id, style);
        const after = applyAction(state, { type: 'openStore', lotId: site.id, style });
        expect(rendered).toContain(`data-site-context="${site.id}"`);
        expect(rendered).toContain(`${site.footfall.toLocaleString('ja-JP')}人 / 週`);
        expect(rendered).toContain(yen(state.cash - after.cash));
        expect(rendered).toContain(yen(after.cash));
        expect(rendered).toContain('開業時の設定と費用');
        expect(rendered).not.toMatch(/見込み|予測|全社利益|利益の変化|年間利回り|opening-profit-range|opening-option-profit/);
      }
    }
    expect(state).toEqual(before);
  });

  it('presents nearby stores as the player’s own and labels owned property rent truthfully', () => {
    let state = createGame();
    state.cash = 500_000_000;
    state = applyAction(state, { type: 'openStore', lotId: 'center-01', style: 'standard' });
    state = applyAction(state, { type: 'buyProperty', lotId: 'center-04' });
    const before = structuredClone(state);
    const rendered = renderToStaticMarkup(createElement(SiteContextPanel, { state, lotId: 'center-04' }));
    expect(getSiteContext(state, 'center-04')!.nearbyOwnStores).toBe(1);
    expect(rendered).toContain('近くの自社店舗');
    expect(rendered).toContain('1店');
    expect(rendered).toContain('自社物件・家賃なし');
    expect(rendered).not.toMatch(/競合店舗|ライバル|予測|見込み/);
    expect(state).toEqual(before);
  });

  it('keeps debt and cash danger notices qualitative without hiding contractual failure rules', () => {
    const state = createGame();
    state.cash = 5_000_000;
    state.loans = [{ id: 'danger-fixture', principal: 200_000_000, remaining: 200_000_000, annualRate: .05, weeksLeft: 52, weeklyPayment: 10_000_000 }];
    const rendered = opening(state, 'miyashita-07', 'standard');
    expect(rendered).toContain('借入があります');
    expect(rendered).toContain('週末の支払いで資金が不足するおそれ');
    expect(rendered).toContain('利益がゼロ以下で週を終えると倒産');
    expect(rendered).not.toMatch(/見込み|予測|上限|下限|opening-profit/);
  });

  it('keeps unavailable openings unavailable and invalid site facts absent', () => {
    const state = createGame();
    state.cash = 0;
    const rendered = opening(state, 'center-01', 'standard');
    expect(rendered).toMatch(/disabled=""[^>]*>この場所にカフェを開業/);
    expect(renderToStaticMarkup(createElement(SiteContextPanel, { state, lotId: 'missing' }))).toBe('');
  });

  it('lists every economic site with facts and explicit non-profit sorting choices without mutating the company', () => {
    const state = createGame();
    const before = structuredClone(state);
    const rendered = renderToStaticMarkup(createElement(SiteBrowser, { state, selectedLotId: null, onSelectLot: () => undefined, mapMode: 'game' }));
    const sites = LOTS.filter(lot => lot.available);
    expect((rendered.match(/data-lot-id=/g) ?? []).length).toBe(sites.length);
    for (const lot of sites) {
      expect(rendered).toContain(`data-lot-id="${lot.id}" data-site-footfall="${lot.footfall}" data-site-rent="${getSiteContext(state, lot.id)!.weeklyRent}"`);
    }
    expect(rendered).toContain('人通りが多い順');
    expect(rendered).toContain('現在の店舗家賃が低い順');
    expect(rendered).not.toMatch(/利益|利回り|予測/);
    expect(state).toEqual(before);
  });
});
