import type { GameAction, GameState, Loan } from '../model';
import { applyAction, getSummary } from './engine';

export interface LoanApplicationCheck {
  id: 'company' | 'amount' | 'credit' | 'term' | 'engine';
  label: string;
  passed: boolean;
  detail: string;
}

export interface LoanQuote {
  amount: number;
  weeks: number;
  annualRate: number;
  cashAfterBorrowing: number;
  debtAfterBorrowing: number;
  initialInterest: number;
  initialPrincipalPayment: number;
  initialPayment: number;
  totalInterest: number;
  /** Incremental cash repayments after the engine's weekly aggregate rounding. */
  totalPrincipalPayments: number;
  totalPayments: number;
}

/** A local, disposable application result. It is never included in a save. */
export interface LoanApplication {
  state: GameState;
  amount: number;
  weeks: number;
  availableCredit: number;
  approved: boolean;
  checks: LoanApplicationCheck[];
  quote: LoanQuote | null;
  action: Extract<GameAction, { type: 'borrow' }>;
}

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

function payments(loans: Loan[]): { interest: number; principal: number } {
  return {
    interest: Math.round(loans.reduce((sum, loan) => sum + loan.remaining * loan.annualRate / 52, 0)),
    principal: Math.round(loans.reduce((sum, loan) => sum + Math.min(loan.remaining, loan.weeklyPayment), 0)),
  };
}

function repayScheduledWeek(loans: Loan[]): Loan[] {
  return loans.map(loan => ({
    ...loan,
    remaining: Math.max(0, loan.remaining - Math.min(loan.remaining, loan.weeklyPayment)),
    weeksLeft: loan.weeksLeft - 1,
  })).filter(loan => loan.remaining > .01 && loan.weeksLeft > 0);
}

/** Contract payments only: no week advancement, business forecast, or prepayment. */
function quotePayments(state: GameState, next: GameState, amount: number, weeks: number): LoanQuote {
  const loan = next.loans[next.loans.length - 1];
  let existing = state.loans.map(contract => ({ ...contract }));
  let combined = next.loans.map(contract => ({ ...contract }));
  const initialBefore = payments(existing), initialAfter = payments(combined);
  const initialInterest = initialAfter.interest - initialBefore.interest;
  const initialPrincipalPayment = initialAfter.principal - initialBefore.principal;
  let totalInterest = 0, totalPrincipalPayments = 0;
  for (let week = 0; week < weeks; week++) {
    const before = payments(existing), after = payments(combined);
    totalInterest += after.interest - before.interest;
    totalPrincipalPayments += after.principal - before.principal;
    existing = repayScheduledWeek(existing);
    combined = repayScheduledWeek(combined);
  }
  return {
    amount, weeks, annualRate: loan.annualRate,
    cashAfterBorrowing: next.cash,
    debtAfterBorrowing: Math.round(next.loans.reduce((sum, contract) => sum + contract.remaining, 0)),
    initialInterest, initialPrincipalPayment,
    initialPayment: initialInterest + initialPrincipalPayment,
    totalInterest, totalPrincipalPayments, totalPayments: totalInterest + totalPrincipalPayments,
  };
}

/** The existing borrow action is the final authority for approval and loan terms. */
export function screenLoanApplication(state: GameState, amount: number, weeks: number): LoanApplication {
  const { availableCredit } = getSummary(state);
  const validAmount = Number.isSafeInteger(amount) && amount >= 100_000;
  const checks: LoanApplicationCheck[] = [
    { id: 'company', label: '会社の状態', passed: !state.gameOver, detail: state.gameOver ? '経営終了後は新しい借入を申し込めません。' : '経営を継続している会社です。' },
    { id: 'amount', label: '希望額の入力', passed: validAmount, detail: validAmount ? `${yen(amount)}の申込み。最低額の10万円を満たしています。` : '借入希望額は10万円以上の整数（円）で入力してください。' },
    { id: 'credit', label: '追加の借入枠', passed: validAmount && amount <= availableCredit, detail: !validAmount ? `現在の追加枠は${yen(availableCredit)}です。希望額を入力してください。` : amount <= availableCredit ? `希望額は現在の追加枠${yen(availableCredit)}の範囲内です。` : `希望額が追加枠${yen(availableCredit)}を${yen(amount - availableCredit)}超えています。` },
    { id: 'term', label: '返済期間', passed: Number.isInteger(weeks) && weeks >= 13 && weeks <= 260, detail: Number.isInteger(weeks) && weeks >= 13 && weeks <= 260 ? `${weeks}週の元本均等返済です。` : '返済期間は13〜260週の整数で指定してください。' },
  ];
  const action = { type: 'borrow' as const, amount, weeks };
  let quote: LoanQuote | null = null;
  if (checks.every(check => check.passed)) {
    try {
      // applyAction clones its input. This result is discarded; no action is dispatched.
      const next = applyAction(state, action);
      quote = quotePayments(state, next, amount, weeks);
    } catch (error) {
      checks.push({ id: 'engine', label: '契約条件', passed: false, detail: error instanceof Error ? error.message : 'この条件では借入できません。' });
    }
  }
  return { state, amount, weeks, availableCredit, approved: quote !== null, checks, quote, action };
}

/** Any company or input change requires a new screening before money can move. */
export function isLoanApplicationCurrent(application: LoanApplication | null, state: GameState, amount: number, weeks: number): boolean {
  return application !== null && application.state === state && Object.is(application.amount, amount) && Object.is(application.weeks, weeks);
}
