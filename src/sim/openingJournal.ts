import type { GameState, OpeningRecord, Store, WeeklyReport } from '../model';

export const OPENING_RECORD_LIMIT = 40;

/** Accept already calculated reports: this module must not import the engine. */
export function recordOpening(state: GameState, store: Store, before: WeeklyReport, after: WeeklyReport, cashBefore: number, openingCost: number): GameState {
  const next = structuredClone(state);
  const records = next.openingRecords ?? [];
  const sequence = records.reduce((highest, record) => Math.max(highest, Number(record.id.split('-').at(-1)) || 0), 0) + 1;
  const record: OpeningRecord = {
    id: `opening-${state.week}-${sequence}`, storeId: store.id, lotId: store.lotId, storeName: store.name, style: store.style,
    decisionWeek: state.week, openingCost, cashBefore, cashAfter: state.cash,
    netProfitBefore: before.netProfit, netProfitAfter: after.netProfit, initialStoreProfit: after.storeResults.find(s => s.id === store.id)!.profit, companyStoreCount: state.stores.length,
  };
  next.openingRecords = [...records, record].slice(-OPENING_RECORD_LIMIT);
  return next;
}

/** Close pending records immediately: store ids can recur when reopening in the same week. */
export function closeOpeningRecords(state: GameState, storeId: string): GameState {
  if (!state.openingRecords?.some(r => r.storeId === storeId && !r.result && r.closedWeek === undefined)) return state;
  const next = structuredClone(state);
  for (const record of next.openingRecords!) {
    if (record.storeId === storeId && !record.result && record.closedWeek === undefined) record.closedWeek = state.week;
  }
  return next;
}

/** Attach the first simulated result once. UI must publish it only after the state is saved. */
export function settleOpeningRecords(state: GameState, report: WeeklyReport): GameState {
  if (!state.openingRecords?.some(r => !r.result && r.closedWeek === undefined)) return state;
  const next = structuredClone(state);
  for (const record of next.openingRecords!) {
    if (record.result || record.closedWeek !== undefined || record.decisionWeek > report.week) continue;
    const store = report.storeResults.find(s => s.id === record.storeId);
    if (!store) { record.closedWeek = report.week; continue; }
    record.result = { week: report.week, companyNetProfit: report.netProfit, cashChange: report.cashChange, storeProfit: store.profit, customers: store.customers };
  }
  return next;
}
