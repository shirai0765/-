import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LOTS } from '../src/data/district';
import { subscribeCityAudioCues } from '../src/audio/CityAudioCues';
import { applyAction, createGame, operatingConditions } from '../src/sim/engine';
import { getStoreOpeningPlans } from '../src/sim/storePlanning';
import type { GameState, StoreStyle } from '../src/model';
import PropertyScenePanel from '../src/ui/PropertyScenePanel';
import StoreOpeningPanel from '../src/ui/StoreOpeningPanel';

const lotId = 'dogenzaka-13';
const lot = LOTS.find(candidate => candidate.id === lotId)!;
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Record<string, unknown>>(child)
    ? [child, ...elements(child.props.children as ReactNode)] : []);
}

function propertyScene(state: GameState, options: { disabled?: boolean; mapMode?: 'game' | 'real' } = {}) {
  const callbacks = { onViewSite: vi.fn(), onBuyProperty: vi.fn(), onUpgradeProperty: vi.fn(), onBank: vi.fn() };
  const tree = PropertyScenePanel({ state, lotId, mapMode: options.mapMode ?? 'game', disabled: options.disabled, children: 'Existing store controls', ...callbacks });
  const button = (className: string) => elements(tree).find(element => element.type === 'button' && String(element.props.className).split(' ').includes(className))!;
  return { tree, html: renderToStaticMarkup(tree), callbacks, button };
}

function opening(state: GameState, style: StoreStyle = 'standard', disabled = false) {
  const callbacks = { onStyleChange: vi.fn(), onOpen: vi.fn(), onFinance: vi.fn() };
  const html = renderToStaticMarkup(createElement(StoreOpeningPanel, { state, lotId, style, disabled, ...callbacks }));
  return { html, callbacks };
}

describe('illustrated property screens keep real commitments and explicit actions', () => {
  it('shows actual plan payments for all three styles without making or forecasting a sale', () => {
    const state = createGame(), before = structuredClone(state);
    const cues = vi.fn(), unsubscribe = subscribeCityAudioCues(cues);
    try {
      for (const style of ['standard', 'premium', 'takeaway'] as const) {
        const plan = getStoreOpeningPlans(state, lotId).find(candidate => candidate.style === style)!;
        const { html, callbacks } = opening(state, style);
        expect(html).toContain(yen(plan.openingCost!));
        expect(html).toContain(yen(plan.cashAfter!));
        expect(html).toContain('支払い後の手元資金');
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
        expect(html).not.toMatch(/予測|見込み|全社利益|年間利回り/);
        for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
      }
      expect(cues).not.toHaveBeenCalled();
      expect(state).toEqual(before);
    } finally { unsubscribe(); }
  });

  it('shows actual funds and shortage, and blocks mutations for low cash, busy or ended companies', () => {
    const state = createGame();
    state.cash = 123;
    const plan = getStoreOpeningPlans(state, lotId)[0];
    const { html } = opening(state);
    expect(html).toContain('現在の手元資金');
    expect(html).toContain(yen(state.cash));
    expect(html).toContain(`開業資金が${yen(plan.openingCost! - state.cash)}不足しています。`);
    expect(html).not.toContain('支払い後の手元資金');
    expect(html).toMatch(/opening-launch[^>]*disabled=""/);
    const scene = propertyScene(state);
    expect(scene.button('property-scene-buy').props.disabled).toBe(true);
    expect(scene.html).toContain(`購入資金が${yen(lot.purchasePrice - state.cash)}不足しています。`);

    const funded = createGame();
    funded.cash = 500_000_000;
    expect(propertyScene(funded, { disabled: true }).button('property-scene-buy').props.disabled).toBe(true);
    funded.gameOver = true;
    expect(propertyScene(funded).button('property-scene-buy').props.disabled).toBe(true);
    expect(opening(funded).html).toMatch(/opening-launch[^>]*disabled=""/);
  });

  it('uses current ownership and rent, and passes each explicit callback through without automatic camera action', () => {
    let state = createGame();
    state.cash = 500_000_000;
    const before = structuredClone(state), scene = propertyScene(state, { mapMode: 'real' });
    for (const callback of Object.values(scene.callbacks)) expect(callback).not.toHaveBeenCalled();
    expect(scene.html).toContain('実際の募集物件ではありません');
    (scene.button('property-scene-view').props.onClick as () => void)();
    (scene.button('property-scene-buy').props.onClick as () => void)();
    expect(scene.callbacks.onViewSite).toHaveBeenCalledExactlyOnceWith();
    expect(scene.callbacks.onBuyProperty).toHaveBeenCalledExactlyOnceWith();
    expect(state).toEqual(before);

    state = applyAction(state, { type: 'buyProperty', lotId });
    expect(opening(state).html).toContain('自社物件・家賃なし');
    expect(propertyScene(state).html).not.toContain('物件を購入する');
    state = applyAction(state, { type: 'openStore', lotId, style: 'standard' });
    const owned = propertyScene(state);
    expect(owned.html).toContain('自社店舗の家賃を節約 / 週');
    expect(owned.html).toContain(yen(lot.rent * operatingConditions(state).rents));
    expect(owned.html).not.toContain('街でこの建物を見る');
    for (let level = 1; level < 5; level++) state = applyAction(state, { type: 'upgradeProperty', propertyId: state.properties[0].id });
    const maxed = propertyScene(state);
    expect(maxed.html).toContain('改修は最大レベルです');
    expect(maxed.button('property-scene-upgrade').props.disabled).toBe(true);
  });
});
