import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LOTS } from '../src/data/district';
import type { GameState } from '../src/model';
import { advanceWeek, applyAction, createGame, getSummary, previewWeek } from '../src/sim/engine';
import ProgressionPanel from '../src/ui/ProgressionPanel';

function company(storeCount: number) {
  let state = createGame();
  state.cash = 50_000_000;
  const sites = LOTS.filter(lot => lot.available).sort((a, b) => a.rent - b.rent).slice(0, storeCount);
  for (const site of sites) state = applyAction(state, { type: 'openStore', lotId: site.id, style: 'standard' });
  return state;
}

function markup(state: GameState) {
  return renderToStaticMarkup(createElement(ProgressionPanel, { state, onNavigate: () => undefined }));
}

function requirements(rendered: string) {
  return [...rendered.matchAll(/<li[^>]*data-ipo-requirement="(\d+)"[^>]*data-met="(true|false)"[^>]*>(.*?)<\/li>/g)]
    .map(([, index, met, content]) => ({ index: Number(index), met: met === 'true', content }));
}

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}

describe('manual strategy panel', () => {
  it('shows actual cumulative progress and exact net worth below the IPO threshold', () => {
    const state = company(2);
    state.week = 30;
    state.profitableWeeks = 9;
    state.cash += 19_999_999 - getSummary(state).netWorth;
    state.lastReport = { ...previewWeek(state), week: 29, netProfit: 100_000_000 };
    const before = structuredClone(state);
    const rows = requirements(markup(state));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ met: false, content: expect.stringContaining('店舗数 2 / 3 店') });
    expect(rows[1]).toMatchObject({ met: false, content: expect.stringContaining('累計黒字 9 / 12 週') });
    expect(rows[2]).toMatchObject({ met: false, content: expect.stringContaining('純資産 ¥19,999,999 / ¥20,000,000') });
    expect(state.cash).not.toBe(getSummary(state).netWorth);
    expect(rows.map(row => row.met)).toEqual(getSummary(state).ipoRequirements.map(requirement => requirement.met));
    expect(markup(state)).not.toContain('連続12週');
    expect(state).toEqual(before);
  });

  it('keeps counters above their thresholds visible and marks the exact net worth threshold met', () => {
    const state = company(4);
    state.profitableWeeks = 17;
    state.cash += 20_000_000 - getSummary(state).netWorth;
    const rows = requirements(markup(state));
    expect(rows[0]).toMatchObject({ met: true, content: expect.stringContaining('店舗数 4 / 3 店') });
    expect(rows[1]).toMatchObject({ met: true, content: expect.stringContaining('累計黒字 17 / 12 週') });
    expect(rows[2]).toMatchObject({ met: true, content: expect.stringContaining('純資産 ¥20,000,000 / ¥20,000,000') });
  });

  it.each([
    { profit: 1, sign: '黒字', met: true },
    { profit: 0, sign: '損益ゼロ', met: false },
    { profit: -1, sign: '赤字', met: false },
  ])('shows settled $sign at ¥$profit as the IPO profit criterion', ({ profit, met }) => {
    const state = advanceWeek(company(1));
    // Synthetic sign fixture isolates the latest saved-report requirement.
    state.lastReport = { ...state.lastReport!, netProfit: profit };
    expect(getSummary(state).weeklyProfit).toBeGreaterThan(0);
    const row = requirements(markup(state))[3];
    expect(row.met).toBe(met);
    expect(row.content).toContain(`直近の決算が黒字（第1週）：¥${profit.toLocaleString('ja-JP')}`);
    expect(row.content).not.toContain('基準利益');
    expect(row.content).not.toContain('〜');
  });

  it.each([false, true])('reviews IPO status with eligible=$0 and leaves property optional before IPO', eligible => {
    const state = advanceWeek(company(3));
    state.profitableWeeks = eligible ? 12 : 11;
    expect(getSummary(state).ipoEligible).toBe(eligible);
    const rendered = markup(state);
    const capital = rendered.match(/<section[^>]*data-capital-kind="ipo"[^>]*>(.*?)<\/section>/)?.[1];
    expect(capital).toBeDefined();
    expect(capital).toContain(eligible ? '現在の上場条件を満たしています。' : '未達の条件は下の上場項目で確認できます。');
    expect(capital).toContain('公開条件と資金を確認');
    expect(capital).not.toContain('投資額');
    expect(capital).not.toContain('運転資金');
    expect(rendered).toMatch(/data-roadmap-step="property" class=""[^]*?上場前は任意/);
    expect(rendered).toContain('data-roadmap-step="ipo" class="is-next"');
    expect(state.properties).toHaveLength(0);
    expect(state.stores.every(store => !store.manager)).toBe(true);
  });

  it('labels the investment comparison as optional and indicative for an early company', () => {
    const rendered = markup(company(1));
    const capital = rendered.match(/<section[^>]*data-capital-kind="investment"[^>]*>(.*?)<\/section>/)?.[1];
    expect(capital).toContain('任意の投資例');
    expect(capital).toContain('参考：投資額');
    expect(capital).toContain('現在の手元資金');
    expect(capital).not.toMatch(/運転資金目安|資金目安まで/);
    expect(capital).toContain('投資先を比較');
    expect(rendered).not.toContain('NEXT CAPITAL GOAL');
    expect(rendered).not.toContain('目標まであと');
  });

  it('keeps an unowned property as an investment choice after IPO', () => {
    const state = company(3);
    state.listed = true;
    const rendered = markup(state);
    expect(rendered).toMatch(/data-roadmap-step="property" class=""[^]*?物件投資の選択肢/);
    expect(rendered).not.toContain('上場前は任意');
    expect(rendered).not.toContain('data-capital-kind="ipo"');
  });

  it.each([
    { storeCount: 1, kind: 'investment', tab: 'city' },
    { storeCount: 3, kind: 'ipo', tab: 'finance' },
  ])('only navigates to $tab when the $kind comparison is chosen', ({ storeCount, kind, tab }) => {
    const state = company(storeCount);
    state.profitableWeeks = 12;
    const before = structuredClone(state);
    const onNavigate = vi.fn();
    const tree = ProgressionPanel({ state, onNavigate });
    expect(onNavigate).not.toHaveBeenCalled();
    const capital = elements(tree).find(element => element.props['data-capital-kind'] === kind);
    expect(capital).toBeDefined();
    const button = elements(capital).find(element => element.type === 'button');
    expect(button?.props.type).toBe('button');
    expect(button?.props.onClick).toBeTypeOf('function');
    (button!.props.onClick as () => void)();
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(tab);
    expect(state).toEqual(before);
  });
  it('shows no invented result for an unoperated company and no forecast-derived health or capital figures', () => {
    const state = company(1), before = structuredClone(state);
    const rendered = markup(state);
    const health = rendered.match(/<section[^>]*class="progression-health"[^>]*>(.*?)<\/section>/)?.[1];
    expect(health).toContain('営業実績はまだありません');
    expect(health).toContain(`¥${state.cash.toLocaleString('ja-JP')}`);
    expect(health).not.toMatch(/見込み|持続期間|集中|運転資金|〜/);
    expect(rendered).not.toMatch(/今週の利益見込み|週末の現金見込み|利益見込み幅|運転資金目安/);
    expect(state).toEqual(before);
  });

  it('shows the exact completed week after settings and current cash have changed', () => {
    const settled = advanceWeek(company(1));
    const state = applyAction(settled, { type: 'updateStore', storeId: settled.stores[0].id, changes: { price: 1300, quality: 20, staff: 1 } });
    state.cash += 123456;
    const before = structuredClone(state);
    const rendered = markup(state);
    const health = rendered.match(/<section[^>]*class="progression-health"[^>]*>(.*?)<\/section>/)?.[1];
    expect(health).toContain(`第${settled.lastReport!.week}週の全社純利益`);
    expect(health).toContain(`¥${settled.lastReport!.netProfit.toLocaleString('ja-JP')}`);
    expect(health).toContain(`¥${settled.lastReport!.cashChange.toLocaleString('ja-JP')}`);
    expect(health).toContain(`¥${state.cash.toLocaleString('ja-JP')}`);
    expect(health).not.toContain('営業実績はまだありません');
    expect(state.lastReport).toEqual(settled.lastReport);
    expect(state.history).toEqual(settled.history);
    expect(state).toEqual(before);
  });

});
