import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { advanceWeek, applyAction, createGame } from '../src/sim/engine';
import WeeklyReviewScreen from '../src/ui/WeeklyReviewScreen';
import WeeklyResults, { recordedSettlement, WeeklySettlementSummary } from '../src/ui/WeeklyResults';

const settledGame = () => advanceWeek(applyAction(createGame('週末の会社', 961), { type: 'openStore', lotId: 'center-01', style: 'standard' }));
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

describe('a weekly review reads the completed settlement', () => {
  it('keeps profit and cash tied to the saved week after later spending', () => {
    const settled = settledGame();
    const report = settled.lastReport!;
    const cash = settled.history.find(point => point.week === report.week)!.cash;
    const later = { ...settled, cash: 17, stockPrices: {} };
    const before = structuredClone(later);
    const recorded = recordedSettlement(later)!;
    expect(recorded).toMatchObject({ profit: report.netProfit, cashChange: report.cashChange, cash });
    const markup = renderToStaticMarkup(createElement(WeeklyReviewScreen, { state: later, onClose: () => undefined }));
    expect(markup).toContain(`aria-label="全社純利益 ${yen(report.netProfit)}"`);
    expect(markup).toContain(`aria-label="${yen(cash)}"`);
    expect(markup).toContain('data-cash-complete="true"');
    expect(markup).not.toContain('¥17');
    expect(later).toEqual(before);
  });

  it('does not inspect current cash or saved opening forecasts for the summary', () => {
    const state = settledGame();
    Object.defineProperty(state, 'cash', { get: () => { throw new Error('Current cash is not the settlement'); } });
    for (const field of ['initialStoreProfit', 'netProfitBefore', 'netProfitAfter']) {
      Object.defineProperty(state.openingRecords![0], field, { get: () => { throw new Error('A forecast is not a result'); } });
    }
    const summary = renderToStaticMarkup(createElement(WeeklySettlementSummary, { state }));
    const screen = renderToStaticMarkup(createElement(WeeklyReviewScreen, { state, onClose: () => undefined }));
    expect(summary).toContain('今週の全社純利益');
    expect(screen).toContain('data-weekly-review-phase="summary"');
    expect(screen).not.toMatch(/見込み|予測/);
  });

  it('shows a missing historic cash row honestly without substituting current cash', () => {
    const state = settledGame();
    const legacy = { ...state, cash: 424242, history: [] };
    expect(recordedSettlement(legacy)).toMatchObject({ cash: null, profitDifference: null });
    const markup = renderToStaticMarkup(createElement(WeeklySettlementSummary, { state: legacy }));
    expect(markup).toContain('記録なし');
    expect(markup).not.toContain('424,242');
  });

  it('opens with one concise next action and offers an immediate exit', () => {
    const state = settledGame();
    const markup = renderToStaticMarkup(createElement(WeeklyReviewScreen, { state, onClose: () => undefined }));
    expect(markup).toContain('<dialog');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('第1週の営業結果');
    expect(markup).toContain('第1週の営業が終了し、第2週になりました');
    expect(markup).toContain('今週の街のニュースへ');
    expect(markup).toContain('街に戻る');
    expect(markup).toContain('店舗・収支の詳しい記録');
    expect(markup).not.toContain('weekly-store-list');
    expect(markup).not.toContain('weekly-news-card');
    expect(markup).not.toContain('disabled');
  });

  it('retains the settled expense details without repeating the summary', () => {
    const state = settledGame();
    const before = structuredClone(state);
    const markup = renderToStaticMarkup(createElement(WeeklyResults, { state, mode: 'details' }));
    expect(markup).toContain('出店時の支払い');
    expect(markup).toContain('店舗ごとの実績');
    for (const value of Object.values(state.lastReport!.storeAccounts![0].costs)) expect(markup).toContain(`${value.toLocaleString('ja-JP')}円`);
    expect(markup).not.toContain('weekly-results-company');
    expect(state).toEqual(before);
  });

  it('keeps negative results visible and closes an ended company without promising a new week', () => {
    const state = settledGame();
    state.lastReport = { ...state.lastReport!, netProfit: -70000, cashChange: -80000 };
    state.gameOver = true;
    state.gameOverReason = '手元資金が不足しました。';
    const markup = renderToStaticMarkup(createElement(WeeklyReviewScreen, { state, onClose: () => undefined }));
    expect(markup).toContain('class="negative" aria-label="全社純利益 ¥-70,000"');
    expect(markup).toContain('経営終了');
    expect(markup).toContain('結果を閉じる');
    expect(markup).not.toContain('次の経営へ');
    expect(markup).not.toContain('第2週になりました');
  });

  it('has no review content before a settlement exists', () => {
    const state = createGame('営業前', 963);
    expect(recordedSettlement(state)).toBeNull();
    expect(renderToStaticMarkup(createElement(WeeklyReviewScreen, { state, onClose: () => undefined }))).toBe('');
  });
});
