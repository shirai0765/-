import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyAction, createGame, getSummary } from '../src/sim/engine';
import { createEnvelope, decodeEnvelope, deleteSave, loadGame, saveGame, validateGame } from '../src/persistence';

beforeEach(async () => { await loadGame(); await deleteSave(); });

describe('loan contract identity', () => {
  it('keeps same-week borrowing after repayment saveable and repays only the selected contract', async () => {
    const initial = createGame('借入IDの再利用', 42);
    const borrow = { type: 'borrow' as const, amount: 1_000_000, weeks: 52 };
    let state = applyAction(initial, borrow);
    const firstId = state.loans[0].id;
    state = applyAction(state, borrow);
    const second = structuredClone(state.loans[1]);
    state = applyAction(state, { type: 'repayLoan', loanId: firstId });
    state = applyAction(state, borrow);

    expect(state.loans[0]).toEqual(second);
    expect(new Set(state.loans.map(loan => loan.id)).size).toBe(2);
    expect(state.cash).toBe(initial.cash + 2_000_000);
    expect(getSummary(state).debt).toBe(2_000_000);
    expect(state.loans[1]).toEqual({ ...second, id: state.loans[1].id });
    expect(validateGame(state)).toEqual(state);
    expect(await decodeEnvelope(await createEnvelope(state))).toEqual(state);
    await saveGame(state);
    expect(await loadGame()).toEqual(state);

    const replacement = structuredClone(state.loans[1]);
    state = applyAction(state, { type: 'repayLoan', loanId: second.id });
    expect(state.loans).toEqual([replacement]);
    expect(state.cash).toBe(initial.cash + 1_000_000);
    expect(getSummary(state).debt).toBe(1_000_000);
    await saveGame(state);
    expect(await loadGame()).toEqual(state);
    state = applyAction(state, { type: 'repayLoan', loanId: replacement.id });
    expect(state.loans).toEqual([]);
    expect(state.cash).toBe(initial.cash);
  });

  it('preserves version-one loan IDs and skips every occupied collision suffix', async () => {
    const borrow = { type: 'borrow' as const, amount: 1_000_000, weeks: 52 };
    let state = applyAction(applyAction(createGame('既存借入ID', 42), borrow), borrow);
    const baseId = `loan-${state.week}-${state.loans.length}-${state.cash}`;
    state.loans[0].id = baseId;
    state.loans[1].id = `${baseId}-1`;
    const imported = await decodeEnvelope(await createEnvelope(state));
    const next = applyAction(imported, borrow);

    expect(next.loans.slice(0, 2)).toEqual(imported.loans);
    expect(next.loans[2].id).toBe(`${baseId}-2`);
    expect(new Set(next.loans.map(loan => loan.id)).size).toBe(3);
    expect(await decodeEnvelope(await createEnvelope(next))).toEqual(next);
    expect(imported).toEqual(state);
  });
});
