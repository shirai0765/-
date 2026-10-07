import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { advanceWeek, applyAction, createGame } from '../src/sim/engine';
import { createEnvelope, decodeEnvelope } from '../src/persistence';
import OpeningResults from '../src/ui/OpeningResults';
import WeeklyResults from '../src/ui/WeeklyResults';

const opened = () => applyAction(createGame('確定実績の会社', 812), { type: 'openStore', lotId: 'center-01', style: 'standard' });
const renderJournal = (state: ReturnType<typeof opened>) => renderToStaticMarkup(createElement(OpeningResults, { state, mode: 'history' }));

describe('opening receipts expose paid costs and settled outcomes only', () => {
  it('does not inspect saved historical forecast fields for a pending or settled opening', () => {
    for (const state of [opened(), advanceWeek(opened())]) {
      const record = state.openingRecords![0];
      for (const key of ['initialStoreProfit', 'netProfitBefore', 'netProfitAfter']) {
        Object.defineProperty(record, key, { get: () => { throw new Error('Forecast is not a receipt'); } });
      }
      const markup = renderJournal(state);
      expect(markup).toContain('¥3,600,000');
      expect(markup).toContain('¥8,400,000');
      expect(markup).not.toMatch(/見込み|予測/);
      if (!state.lastReport) {
        expect(markup).toContain('初決算前');
        expect(markup).not.toContain('初決算の店舗利益');
      } else {
        const report = renderToStaticMarkup(createElement(WeeklyResults, { state }));
        expect(report).toContain('出店時の支払い');
        expect(report).not.toContain('基準見込み');
      }
    }
  });

  it('renders exact first settlement and recorded expense ledger after later setting changes', () => {
    const settled = advanceWeek(opened()), before = structuredClone(settled);
    const state = applyAction(settled, { type: 'updateStore', storeId: settled.stores[0].id, changes: { price: 1200, staff: 1, quality: 20, marketing: 0 } });
    const journal = renderJournal(state);
    const first = settled.openingRecords![0].result!;
    expect(journal).toContain(`¥${first.storeProfit.toLocaleString('ja-JP')}`);
    expect(journal).toContain(`${first.customers.toLocaleString('ja-JP')} <span>人</span>`);
    const report = renderToStaticMarkup(createElement(WeeklyResults, { state }));
    const account = settled.lastReport!.storeAccounts![0];
    for (const value of Object.values(account.costs)) expect(report).toContain(`${value.toLocaleString('ja-JP')}円`);
    expect(state.lastReport).toEqual(settled.lastReport);
    expect(state.history).toEqual(settled.history);
    expect(state.openingRecords).toEqual(settled.openingRecords);
    expect(settled).toEqual(before);
  });

  it('round trips existing v1 history and optional missing legacy records without migration', async () => {
    for (const withRecords of [true, false]) {
      const original = advanceWeek(opened());
      if (!withRecords) { delete original.openingRecords; delete original.lastReport!.storeAccounts; }
      const decoded = await decodeEnvelope(await createEnvelope(original));
      const before = structuredClone(decoded);
      renderJournal(decoded);
      const markup = renderToStaticMarkup(createElement(WeeklyResults, { state: decoded }));
      if (!withRecords) expect(markup).toContain('この週の費用内訳は記録されていません');
      expect(decoded).toEqual(before);
      expect(await decodeEnvelope(await createEnvelope(decoded))).toEqual(original);
    }
  });
});
