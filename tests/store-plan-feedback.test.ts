import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { advanceWeek, applyAction, createGame, getStoreOperatingInsight } from '../src/sim/engine';
import StoreManagementPanel from '../src/ui/StoreManagementPanel';
import { StorePlanFeedback, formatStoreEstimateRange } from '../src/ui/StorePlanFeedback';

function openedStore() {
  return applyAction(createGame('店舗の見込み', 812), { type: 'openStore', lotId: 'center-01', style: 'standard' });
}

describe('compact applied store-plan feedback', () => {
  it.each([
    { group: 'product', label: '商品・価格' },
    { group: 'people', label: '人員・店長' },
    { group: 'promotion', label: '広告・改装' },
  ] as const)('renders the $group context with a bounded store estimate and an explicit detail entry', ({ group, label }) => {
    const state = openedStore();
    const before = structuredClone(state);
    const insight = getStoreOperatingInsight(state, state.stores[0].id);
    const markup = renderToStaticMarkup(createElement(StorePlanFeedback, {
      insight, storeName: state.stores[0].name, reasonsId: 'existing-reasons', group,
    }));
    expect(markup).toContain(`data-feedback-group="${group}"`);
    expect(markup).toContain(`${label}設定の店舗利益見込み`);
    expect(markup).toContain('第1週 · 反映済みの設定');
    expect(markup).toContain('店舗利益見込み／週');
    expect(markup).toContain('37,000〜70,000円');
    expect(markup).toContain('実績は週末に確定。本部費・利息などは含みません。');
    expect(markup).toContain('type="button" aria-controls="existing-reasons"');
    expect(markup).toContain('見込みの理由');
    expect(markup).not.toContain('<details');
    expect(markup).not.toContain('店長案');
    expect(state).toEqual(before);
  });

  it('updates from accepted settings in the current week while leaving the settled result intact', () => {
    const state = advanceWeek(openedStore());
    const before = structuredClone(state);
    const adjusted = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { price: 950 } });
    const render = (company: typeof state) => renderToStaticMarkup(createElement(StorePlanFeedback, {
      insight: getStoreOperatingInsight(company, company.stores[0].id),
      storeName: company.stores[0].name, reasonsId: 'existing-reasons', group: 'product',
    }));
    const initial = render(state);
    const updated = render(adjusted);
    expect(initial).toContain('第2週 · 反映済みの設定');
    expect(updated).toContain('第2週 · 反映済みの設定');
    expect(initial.match(/class="store-plan-feedback-range">([^<]+)/)?.[1])
      .not.toBe(updated.match(/class="store-plan-feedback-range">([^<]+)/)?.[1]);
    expect(adjusted.lastReport).toEqual(state.lastReport);
    expect(adjusted.history).toEqual(state.history);
    expect(adjusted.week).toBe(state.week);
    expect(state).toEqual(before);
  });

  it('identifies an effective manager plan without replacing the player inputs', () => {
    const state = openedStore();
    const delegated = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { manager: true } });
    const before = structuredClone(delegated);
    const insight = getStoreOperatingInsight(delegated, delegated.stores[0].id)!;
    expect(insight.inputSettings.price).toBe(580);
    expect(insight.effectiveSettings.price).toBe(754);
    const markup = renderToStaticMarkup(createElement(StorePlanFeedback, {
      insight, storeName: delegated.stores[0].name, reasonsId: 'existing-reasons', group: 'people',
    }));
    expect(markup).toContain('第1週 · 反映済みの設定からの店長案');
    expect(markup).not.toContain('37,000〜70,000円');
    expect(delegated).toEqual(before);
  });

  it.each([
    { range: { min: -1, max: 1 }, expected: '-1,000〜1,000' },
    { range: { min: -.1, max: 0 }, expected: '-1,000〜0' },
    { range: { min: 0, max: .1 }, expected: '0〜1,000' },
  ])('keeps outward-rounded near-zero bounds visible: $expected', ({ range, expected }) => {
    expect(formatStoreEstimateRange(range, 1000)).toBe(expected);
    const state = openedStore();
    const insight = getStoreOperatingInsight(state, state.stores[0].id)!;
    const markup = renderToStaticMarkup(createElement(StorePlanFeedback, {
      insight: { ...insight, resultRange: { ...insight.resultRange, profit: range } },
      storeName: state.stores[0].name, reasonsId: 'existing-reasons', group: 'product',
    }));
    expect(markup.match(/class="store-plan-feedback-range">([^<]+)/)?.[1]).toBe(`${expected}円`);
  });

  it('does not show stale feedback when the store insight is absent', () => {
    expect(renderToStaticMarkup(createElement(StorePlanFeedback, {
      insight: null, storeName: '閉店済み', reasonsId: 'absent-reasons', group: 'promotion',
    }))).toBe('');
  });

  it('keeps the initial store-purpose chooser free of a permanent forecast', () => {
    const state = openedStore();
    const before = structuredClone(state);
    const markup = renderToStaticMarkup(createElement(StoreManagementPanel, {
      state, store: state.stores[0], onAction: () => { throw new Error('Rendering must not apply actions'); },
    }));
    expect(markup).toContain('data-store-purpose="home"');
    expect(markup).toContain('商品・価格');
    expect(markup).toContain('人員・店長');
    expect(markup).toContain('広告・改装');
    expect(markup).not.toContain('class="store-plan-feedback"');
    expect(state).toEqual(before);
  });
});
