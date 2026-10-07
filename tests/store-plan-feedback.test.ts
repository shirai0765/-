import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { advanceWeek, applyAction, createGame, getStoreOperatingInsight } from '../src/sim/engine';
import StoreManagementPanel from '../src/ui/StoreManagementPanel';
import { StorePlanFeedback } from '../src/ui/StorePlanFeedback';
import { StoreOperatingInsightPanel } from '../src/ui/StoreOperatingInsightPanel';

function openedStore() {
  return applyAction(createGame('店舗の設定', 812), { type: 'openStore', lotId: 'center-01', style: 'standard' });
}

/** Future answers deliberately throw: presentation must not inspect them, even for hidden details. */
function withoutForecastAccess(insight: NonNullable<ReturnType<typeof getStoreOperatingInsight>>) {
  const hidden = () => { throw new Error('Unsettled outcome accessed'); };
  for (const key of ['result', 'resultRange']) Object.defineProperty(insight, key, { get: hidden });
  for (const key of ['demand', 'customers', 'unservedDemand', 'unusedCapacity']) Object.defineProperty(insight.flow, key, { get: hidden });
  for (const key of ['ingredients', 'fulfilment']) Object.defineProperty(insight.costs, key, { get: hidden });
  return insight;
}

describe('applied store settings without an outcome oracle', () => {
  it.each([
    { group: 'product', label: '商品・価格' },
    { group: 'people', label: '人員・店長' },
    { group: 'promotion', label: '広告・改装' },
  ] as const)('explains the $group choice without reading any future result', ({ group, label }) => {
    const state = openedStore(), before = structuredClone(state);
    const insight = withoutForecastAccess(getStoreOperatingInsight(state, state.stores[0].id)!);
    const markup = renderToStaticMarkup(createElement(StorePlanFeedback, {
      insight, storeName: state.stores[0].name, reasonsId: 'existing-reasons', group,
    }));
    expect(markup).toContain(`${label}設定の確認`);
    expect(markup).toContain('第1週 · 反映済みの設定');
    expect(markup).toContain('売上・来店者数・利益は営業を終えてから確認できます。');
    expect(markup).toContain('aria-controls="existing-reasons"');
    expect(markup).not.toMatch(/見込み|予測|store-plan-feedback-range/);
    expect(state).toEqual(before);
  });

  it('shows known fixed costs and serving capacity without demand, satisfaction or variable-cost predictions', () => {
    const state = openedStore(), before = structuredClone(state);
    const insight = withoutForecastAccess(getStoreOperatingInsight(state, state.stores[0].id)!);
    const markup = renderToStaticMarkup(createElement(StoreOperatingInsightPanel, { insight, storeName: state.stores[0].name }));
    expect(markup).toContain('1,120');
    expect(markup).toContain('対応枠は今の人員・設備で提供できる量の基準');
    for (const cost of [208000, 110000, 28000, 10000]) expect(markup).toContain(`${cost.toLocaleString('ja-JP')}円／週`);
    expect(markup).not.toMatch(/需要の目安|利益見込み|売上の見込み|満足度の目安|対応の余力|上限を超える需要|店舗費用合計/);
    expect(state).toEqual(before);
  });

  it('keeps manager proposals distinct from unchanged player inputs and actual outcomes', () => {
    const state = openedStore();
    const delegated = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { manager: true } });
    const before = structuredClone(delegated);
    const insight = withoutForecastAccess(getStoreOperatingInsight(delegated, delegated.stores[0].id)!);
    const markup = renderToStaticMarkup(createElement(StoreOperatingInsightPanel, { insight, storeName: delegated.stores[0].name }));
    expect(markup).toContain('今週の店長案');
    expect(markup).toContain('入力値は変更していません');
    expect(markup).toContain(`${insight.effectiveSettings.price.toLocaleString('ja-JP')}円`);
    expect(insight.inputSettings.price).toBe(580);
    expect(markup).toContain('来店者数や利益を確約するものではありません');
    expect(delegated).toEqual(before);
  });

  it('retains the previous settled result after a setting changes, without rewriting company history', () => {
    const state = advanceWeek(openedStore()), before = structuredClone(state);
    const adjusted = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { price: 950 } });
    const markup = renderToStaticMarkup(createElement(StoreManagementPanel, {
      state: adjusted, store: adjusted.stores[0], onAction: () => { throw new Error('Rendering must not apply actions'); },
    }));
    expect(markup).toContain('第1週の営業実績');
    expect(markup).toContain(`${state.lastReport!.storeResults[0].profit.toLocaleString('ja-JP')}円`);
    expect(markup).not.toContain('利益見込み');
    expect(adjusted.lastReport).toEqual(state.lastReport);
    expect(adjusted.history).toEqual(state.history);
    expect(state).toEqual(before);
  });

  it('keeps the fresh store explicitly unsettled and renders nothing for absent insight', () => {
    const state = openedStore();
    const markup = renderToStaticMarkup(createElement(StoreManagementPanel, {
      state, store: state.stores[0], onAction: () => { throw new Error('Rendering must not apply actions'); },
    }));
    expect(markup).toContain('初営業の結果を待っています');
    expect(markup).not.toContain('直近の営業実績');
    expect(renderToStaticMarkup(createElement(StorePlanFeedback, {
      insight: null, storeName: '閉店済み', reasonsId: 'absent', group: 'promotion',
    }))).toBe('');
  });
});
