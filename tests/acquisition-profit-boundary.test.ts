import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STOCKS } from '../src/data/stocks';
import { applyAction, createGame } from '../src/sim/engine';
import { getMarketAcquisitionTargets } from '../src/sim/marketAcquisitions';
import { getAcquisitionComparison, previewAcquisitionComparison } from '../src/sim/acquisitionComparison';
import MarketAcquisitionComparison, { type AcquisitionComparisonRow } from '../src/ui/MarketAcquisitionComparison';

// A funded UI fixture, not evidence that a new company can afford the acquisition.
function company(price = 950) {
  let state = createGame('Investment presentation boundary', 7);
  state.cash = 2_000_000_000; state.listed = true; state.reputation = 100;
  state = applyAction(state, { type: 'openStore', lotId: 'center-01', style: 'standard' });
  state = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { price, quality: 85, staff: 4, marketing: 0 } });
  state = applyAction(state, { type: 'buyStock', stockId: STOCKS[0].id, shares: 1000 });
  return applyAction(state, { type: 'researchMarketCompany', stockId: STOCKS[0].id });
}
const rowFor = (state: ReturnType<typeof company>): AcquisitionComparisonRow => {
  const target = getMarketAcquisitionTargets(state).find(target => target.stockId === STOCKS[0].id)!;
  return { ...getAcquisitionComparison(state, target, 'autonomous'), forecast: previewAcquisitionComparison(state, target, 'autonomous') };
};
const render = (row: AcquisitionComparisonRow, cash: number) => renderToStaticMarkup(createElement(MarketAcquisitionComparison, {
  comparisons: [row], cash, onClear: () => undefined, onRemove: () => undefined,
  onModeChange: () => undefined, onOpenDetails: () => undefined,
}));
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

describe('acquisition estimates stay within the acquired business', () => {
  it('keeps asset estimates and known transfers identical when only the unserved cafe plan changes', () => {
    const first = company(950), second = company(1050), before = structuredClone(first);
    const a = rowFor(first), b = rowFor(second);
    expect(a.forecast!.outlook.netProfit).not.toEqual(b.forecast!.outlook.netProfit);
    expect(a.forecast!.debtFailure).toBe(b.forecast!.debtFailure);
    expect(a.forecast!.cashFailure).toBe(b.forecast!.cashFailure);
    const markup = render(a, first.cash);
    expect(markup).toBe(render(b, second.cash));
    expect(markup).toContain(yen(a.choice.weeklyProfitRange.min));
    expect(markup).toContain(yen(a.choice.weeklyProfitRange.max));
    expect(markup).toContain(`取得直後の現金：${yen(a.forecast!.cashAfter)}`);
    expect(a.forecast!.lostDividends).toBeGreaterThan(0);
    expect(markup).toContain(`取得で終了する株式配当：${yen(a.forecast!.lostDividends)}`);
    expect(markup).not.toMatch(/全社の今週利益幅|取得しない場合の利益幅|週末の現金の幅/);
    expect(first).toEqual(before);
  });

  it('retains qualitative debt and cash warnings without publishing forecast amounts', () => {
    const state = company(), row = rowFor(state);
    row.forecast = { ...row.forecast!, debtFailure: true, cashFailure: true };
    const markup = render(row, state.cash);
    expect(markup).toContain('借入中の収支にリスクがあります');
    expect(markup).toContain('取得後の支払いに備える資金が不足するおそれ');
    expect(markup).toContain('取得後の取消・運営方式の変更・通常売却はできません');
    expect(markup).not.toContain('見込み幅の下限');
  });

  it('keeps acquisition eligibility separate from an asset earnings estimate', () => {
    const state = company(), poor = { ...state, cash: 0 }, row = rowFor(poor);
    expect(row.ready).toBe(false); expect(row.forecast).toBeNull();
    const markup = render(row, poor.cash);
    expect(markup).toContain('取得条件を確認してください');
    expect(markup).toContain('取得資金が不足しています');
    expect(markup).toContain(yen(row.choice.weeklyProfitRange.min));
  });
});
