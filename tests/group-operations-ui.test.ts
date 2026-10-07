import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STOCKS } from '../src/data/stocks';
import { advanceWeek, applyAction, createGame } from '../src/sim/engine';
import { getMarketOperationQuote } from '../src/sim/marketOperations';
import GroupOperationsPanel from '../src/ui/GroupOperationsPanel';
import GroupWeeklyResults from '../src/ui/GroupWeeklyResults';
import { getInvestmentMemo } from '../src/ui/investmentPlanning';

// Wealthy accounting fixtures test UI boundaries, not normal-play reachability.
const sectorStocks = STOCKS.filter(stock => stock.sector === STOCKS[0].sector);
const sector = sectorStocks[0].sector;
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
function matureCompany() {
  let state = createGame('事業計画UI境界', 5401);
  state.cash = 2_000_000_000; state.listed = true; state.reputation = 100;
  state = applyAction(state, { type: 'researchMarketCompany', stockId: sectorStocks[0].id });
  state = applyAction(state, { type: 'acquireMarketCompany', stockId: sectorStocks[0].id, mode: 'autonomous' });
  while (state.week < state.marketAcquisitions!.companies[0].readyWeek) state = advanceWeek(state);
  return state;
}
const visit = (policy: 'growth' | 'stability', id = 'return-1') => ({ id, intent: { kind: 'marketOperation' as const, sector, policy } });

describe('sector program planning and settled feedback', () => {
  it('defaults to retaining operations and does not start or advance anything while rendering', () => {
    const state = matureCompany(), before = structuredClone(state);
    let calls = 0;
    const markup = renderToStaticMarkup(createElement(GroupOperationsPanel, { state, initialSector: sector, onAction: () => { calls++; } }));
    expect(markup).toContain('data-operation-policy="retain" aria-pressed="true"');
    expect(markup).toContain('追加の計画費用を使わず、今の運営を続けます');
    expect(markup).not.toContain('26週の計画を始める');
    expect(markup).not.toContain('data-operation-upfront');
    expect(calls).toBe(0);
    expect(state).toEqual(before);
  });

  it('returns to the chosen plan, separates recurring reserve from the initial charge, and states the term before committing', () => {
    const state = matureCompany(), before = structuredClone(state);
    const quote = getMarketOperationQuote(state, sector, 'growth');
    let calls = 0;
    const markup = renderToStaticMarkup(createElement(GroupOperationsPanel, { state, onAction: () => { calls++; }, investmentVisit: visit('growth') }));
    expect(markup).toContain('data-operation-policy="growth" aria-pressed="true"');
    expect(markup).toContain(`data-operation-upfront="${quote.upfrontCost}"`);
    expect(markup).toContain(`data-operation-weekly-cost="${quote.weeklyCost}"`);
    expect(markup).toContain(`data-operation-reserve="${quote.reserveRequired}"`);
    expect(quote.reserveRequired).toBeGreaterThan(quote.upfrontCost);
    expect(markup).toContain(`第${state.week + 26}週から通常運営へ戻り、自動更新しません`);
    expect(markup).toContain('途中では終了できません');
    expect(markup).toContain('配当・借入返済・他事業の現金変動は含みません');
    expect(markup).toContain('開始前の支払と収支を確認');
    expect(markup).not.toContain('26週の計画を始める');
    expect(calls).toBe(0);
    expect(state).toEqual(before);
  });

  it('keeps the sector plan and known payment independent of an unserved cafe price change', () => {
    let state = matureCompany();
    state = applyAction(state, { type: 'openStore', lotId: 'center-01', style: 'standard' });
    const first = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { price: 950, quality: 85, staff: 4, marketing: 0 } });
    const second = applyAction(first, { type: 'updateStore', storeId: first.stores[0].id, changes: { price: 1050 } });
    const render = (company: typeof state) => renderToStaticMarkup(createElement(GroupOperationsPanel, { state: company, onAction: () => undefined, investmentVisit: visit('growth') }));
    const quote = getMarketOperationQuote(first, sector, 'growth'), markup = render(first);
    expect(markup).toBe(render(second));
    expect(markup).toContain('現状維持と比べた事業内の資金効果 / 26週');
    expect(markup).toContain(yen(Math.floor(quote.netContributionRange.min / 1000) * 1000));
    expect(markup).toContain(yen(Math.ceil(quote.netContributionRange.max / 1000) * 1000));
    expect(markup).toContain('支払直後の現金');
    expect(markup).toContain(yen(first.cash - quote.upfrontCost));
    expect(markup).not.toMatch(/利益幅・利息後|週末の現金幅|今週の会社/);
  });

  it('keeps funding plans available without cash while matching only the action’s initial charge', () => {
    const state = matureCompany();
    const poor = { ...state, cash: 0 }, before = structuredClone(poor);
    const growth = getInvestmentMemo(poor, visit('growth'))!;
    const quote = getMarketOperationQuote(poor, sector, 'growth');
    expect(growth.spending).toBe(quote.upfrontCost + 26 * quote.weeklyCost);
    expect(growth.label).toContain('初回支払＋26週の運営費の確保額');
    expect(growth.returnLabel).toBe('この事業計画に戻る');
    expect(() => applyAction(poor, { type: 'startMarketOperation', sector, policy: 'growth' })).toThrow('資金');
    const started = applyAction(state, { type: 'startMarketOperation', sector, policy: 'growth' });
    expect(state.cash - started.cash).toBe(quote.upfrontCost);
    expect(getInvestmentMemo(started, visit('stability'))).toBeNull();
    const stability = getInvestmentMemo(state, visit('stability'))!;
    expect(stability.spending).toBe(getMarketOperationQuote(state, sector, 'stability').upfrontCost);
    expect(stability.id).not.toBe(growth.id);
    expect(poor).toEqual(before);
  });

  it('revalidates a same-ID funding plan when a new company becomes eligible and blocks return-to-start during an active plan', () => {
    expect(sectorStocks.length).toBeGreaterThan(1);
    let state = matureCompany();
    const original = getInvestmentMemo(state, visit('growth'))!;
    state = applyAction(state, { type: 'researchMarketCompany', stockId: sectorStocks[1].id });
    state = applyAction(state, { type: 'acquireMarketCompany', stockId: sectorStocks[1].id, mode: 'autonomous' });
    const readyWeek = state.marketAcquisitions!.companies.find(company => company.stockId === sectorStocks[1].id)!.readyWeek;
    while (state.week < readyWeek) state = advanceWeek(state);
    const current = getInvestmentMemo(state, visit('growth', 'return-2'))!;
    expect(current.id).toBe(original.id);
    expect(current.spending).toBeGreaterThan(original.spending);
    const started = applyAction(state, { type: 'startMarketOperation', sector, policy: 'stability' });
    const markup = renderToStaticMarkup(createElement(GroupOperationsPanel, { state: started, onAction: () => undefined, investmentVisit: visit('growth', 'return-3') }));
    expect(markup).toContain('進行中の事業計画');
    expect(markup).toContain('0 / 26週');
    expect(markup).not.toContain('data-operation-policy="growth"');
    expect(markup).not.toContain('26週の計画を始める');
  });

  it('warns when recurring costs lack a reserve without confusing it with action eligibility', () => {
    const state = matureCompany(), quote = getMarketOperationQuote(state, sector, 'growth');
    const upfrontOnly = { ...state, cash: quote.upfrontCost };
    expect(getMarketOperationQuote(upfrontOnly, sector, 'growth').canStart).toBe(true);
    const markup = renderToStaticMarkup(createElement(GroupOperationsPanel, { state: upfrontOnly, onAction: () => undefined, investmentVisit: visit('growth') }));
    expect(markup).toContain(`全期間の運営費を確保するには、現金が ${yen(quote.totalWeeklyCost)} 不足`);
    expect(markup).toContain('支払直後の現金');
    expect(markup).toContain('開始前の支払と収支を確認');
  });

  it('renders a collapsed recorded weekly result identically after unrelated current-state changes', () => {
    const started = applyAction(matureCompany(), { type: 'startMarketOperation', sector, policy: 'growth' });
    const settled = advanceWeek(started);
    const render = (state: typeof settled) => renderToStaticMarkup(createElement(GroupWeeklyResults, { state, onManageSector: () => undefined }));
    const markup = render(settled);
    expect(markup).toContain(`data-market-operation-result="${sector}"`);
    expect(markup).toContain('1 / 26週');
    expect(markup).toContain('運営費込み');
    expect(markup).toContain('今週の利益から再び引きません');
    expect(markup).toContain('この業種を確認');
    expect(markup).not.toContain('<details open');
    const changed = { ...settled, week: settled.week + 10, marketOperations: undefined, marketAcquisitions: undefined, cash: 123 };
    expect(render(changed)).toBe(markup);
    expect(render({ ...settled, lastReport: { ...settled.lastReport!, marketOperation: undefined } })).toBe('');
    expect(render({ ...settled, lastReport: { ...settled.lastReport!, marketOperation: { ...settled.lastReport!.marketOperation!, week: settled.lastReport!.week + 1 } } })).toBe('');
  });
});
