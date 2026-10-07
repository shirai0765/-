import { describe, expect, it } from 'vitest';
import { advanceWeek, applyAction, createGame, getSummary } from '../src/sim/engine';
import { isLoanApplicationCurrent, screenLoanApplication } from '../src/sim/loanApplication';

describe('disposable bank applications', () => {
  it('quotes the exact existing loan action without changing money, loans, week, or state', () => {
    const state = createGame('融資相談', 21);
    const before = structuredClone(state);
    const application = screenLoanApplication(state, 100_000, 13);
    const actual = applyAction(state, application.action);
    expect(application.approved).toBe(true);
    expect(application.checks.every(check => check.passed)).toBe(true);
    expect(application.quote).toMatchObject({
      amount: 100_000, weeks: 13, annualRate: actual.loans[0].annualRate,
      cashAfterBorrowing: 12_100_000, debtAfterBorrowing: 100_000,
      initialInterest: 87, initialPrincipalPayment: 7692,
    });
    expect(state).toEqual(before);
    expect(state.loans).toHaveLength(0);
    expect(screenLoanApplication(state, 100_000, 13)).toEqual(application);
    expect(application.quote).not.toHaveProperty('netProfit');
    expect(application.quote).not.toHaveProperty('weekEndCash');
  });

  it('declines out-of-range applications with the actual borrowing limit and a specific reason', () => {
    const state = createGame('限度額確認', 22);
    const before = JSON.stringify(state);
    const overLimit = screenLoanApplication(state, 6_000_000, 52);
    expect(overLimit).toMatchObject({ approved: false, quote: null, availableCredit: 5_000_000 });
    expect(overLimit.checks.find(check => check.id === 'credit')).toMatchObject({ passed: false, detail: '希望額が追加枠¥5,000,000を¥1,000,000超えています。' });
    for (const [amount, weeks] of [[99_999, 52], [NaN, 52], [100_000.5, 52], [100_000, 12], [100_000, 261], [100_000, 52.5]]) {
      expect(screenLoanApplication(state, amount, weeks)).toMatchObject({ approved: false, quote: null });
      expect(() => applyAction(state, { type: 'borrow', amount, weeks })).toThrow();
    }
    const finished = { ...state, gameOver: true };
    expect(screenLoanApplication(finished, 100_000, 52).checks.find(check => check.id === 'company')?.passed).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('invalidates an approval when the amount, term, or company changes', () => {
    const state = createGame('再審査', 23);
    const application = screenLoanApplication(state, 5_000_000, 52);
    expect(isLoanApplicationCurrent(application, state, 5_000_000, 52)).toBe(true);
    expect(isLoanApplicationCurrent(application, state, 100_000, 52)).toBe(false);
    expect(isLoanApplicationCurrent(application, state, 5_000_000, 13)).toBe(false);
    const changed = applyAction(state, { type: 'borrow', amount: 1_000_000, weeks: 52 });
    expect(isLoanApplicationCurrent(application, changed, 5_000_000, 52)).toBe(false);
    expect(screenLoanApplication(changed, 5_000_000, 52).approved).toBe(false);
    expect(() => applyAction(changed, application.action)).toThrow();
  });

  it('matches real settled interest and principal including other contracts and weekly rounding', () => {
    let state = createGame('返済明細の照合', 24);
    // Stable profitable operation keeps both comparison paths alive to full maturity.
    state.subsidiaries = [{ id: 'payment-fixture', name: '稼働企業', sector: 'property', purchasePrice: 1_000_000, weeklyProfit: 1_000_000, risk: 0 }];
    state = applyAction(state, { type: 'borrow', amount: 123_457, weeks: 26 });
    const application = screenLoanApplication(state, 100_003, 13);
    expect(application.approved).toBe(true);
    const quote = application.quote!;
    expect(quote.annualRate).toBe(applyAction(state, application.action).loans[1].annualRate);
    const summary = getSummary(state);
    expect(quote.annualRate).toBe(.045 + Math.min(.055, summary.debt / Math.max(1, summary.valuation) * .08));
    let existing = state, combined = applyAction(state, application.action);
    let interest = 0, principal = 0;
    for (let week = 0; week < 13; week++) {
      existing = advanceWeek(existing);
      combined = advanceWeek(combined);
      expect(existing.gameOver || combined.gameOver).toBe(false);
      const addedInterest = combined.lastReport!.interest - existing.lastReport!.interest;
      const addedPrincipal = combined.lastReport!.loanRepayment - existing.lastReport!.loanRepayment;
      if (week === 0) {
        expect(quote.initialInterest).toBe(addedInterest);
        expect(quote.initialPrincipalPayment).toBe(addedPrincipal);
      }
      interest += addedInterest;
      principal += addedPrincipal;
    }
    expect(quote.totalInterest).toBe(interest);
    expect(quote.totalPrincipalPayments).toBe(principal);
    expect(quote.totalPayments).toBe(interest + principal);
    expect(combined.loans.some(loan => loan.principal === 100_003)).toBe(false);
  });

  it('shows the known cost of longer repayment rather than a future operating profit', () => {
    const state = createGame('期間を比較', 25);
    const short = screenLoanApplication(state, 1_000_000, 13).quote!;
    const long = screenLoanApplication(state, 1_000_000, 260).quote!;
    expect(short.annualRate).toBe(long.annualRate);
    expect(short.initialInterest).toBe(long.initialInterest);
    expect(short.initialPrincipalPayment).toBeGreaterThan(long.initialPrincipalPayment);
    expect(short.totalInterest).toBeLessThan(long.totalInterest);
    expect(state.week).toBe(1);
    expect(state.cash).toBe(12_000_000);
  });
});
