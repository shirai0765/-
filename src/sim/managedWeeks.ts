import type { GameState, WeeklyReport } from '../model';
import { advanceWeek, getSummary, getWeekOutlook } from './engine';
import { getOffers } from './deals';
import { getMarketGroupFinancials } from './marketAcquisitions';
import { getActiveMarketOperation } from './marketOperations';

export interface ManagedWeekHooks {
  /** Resolve only after this exact week has been durably saved. */
  commit: (next: GameState) => Promise<void>;
  /** Called only after commit succeeds, including a final opportunity-triggering week. */
  onCommit?: (next: GameState, report: WeeklyReport) => void;
  shouldCancel?: () => boolean;
}
export interface ManagedWeekOptions {
  /** Per-run choice only. Financial risks and growth milestones always stop. */
  stopOnNewOffers?: boolean;
}
export interface ManagedWeekResult {
  state: GameState;
  reports: WeeklyReport[];
  stopReason: string | null;
}
const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const detail = (error: unknown) => error instanceof Error ? error.message : '不明なエラー';

/** Advance delegated weeks with one durable commit per week. No rescue financing,
 * automatic investment, or skipped debt/default rules. Input is never mutated. */
export async function runManagedWeeks(initial: GameState, requested: 4 | 13, hooks: ManagedWeekHooks, options: ManagedWeekOptions = {}): Promise<ManagedWeekResult> {
  const stopOnNewOffers = options.stopOnNewOffers !== false;
  let state = initial;
  const reports: WeeklyReport[] = [];
  const stop = (stopReason: string | null): ManagedWeekResult => ({ state, reports, stopReason });
  if (requested !== 4 && requested !== 13) return stop('進める期間は4週または13週を指定してください。');
  for (let i = 0; i < requested; i++) {
    // A macrotask yield keeps cancel/paint events responsive between saved weeks.
    await yieldToUI();
    if (hooks.shouldCancel?.()) return stop('進行を停止しました。完了した週までは保存済みです。');
    if (state.gameOver) return stop(state.gameOverReason ?? 'ゲームが終了しているため進められません。');
    let next: GameState;
    let report: WeeklyReport;
    let beforeIPO: boolean;
    let beforeOffers: Set<string>;
    const operatingProgram = getActiveMarketOperation(state);
    try {
      const outlook = getWeekOutlook(state);
      report = outlook.expected;
      if (!Number.isFinite(report.netProfit) || !Number.isFinite(report.cashChange)) return stop('週次予測を確認できないため停止しました。');
      if (outlook.risk.debtLossPossible) return stop('借入中の利益が見込み範囲の下限でゼロ以下になる可能性があります。決算前に停止しました。経営内容を見直してください。');
      if (outlook.risk.cashShortfallPossible) return stop('次の週末に見込み範囲の下限で現預金が不足する可能性があるため、週を進めず停止しました。支出と資金を確認してください。');
      beforeIPO = getSummary(state).ipoEligible;
      beforeOffers = new Set(getOffers(state).map(offer => offer.id));
      next = advanceWeek(state);
      report = next.lastReport!;
    } catch (error) {
      return stop(`週次計算で停止しました。保存済みの週は維持されています。${detail(error)}`);
    }
    try {
      await hooks.commit(next);
    } catch (error) {
      return stop(`保存できなかったため停止しました。その週は進めていません。${detail(error)}`);
    }
    // Once durable commit succeeds, never return the preceding week even if a UI
    // callback or opportunity check fails. The disk and returned state must agree.
    state = next;
    reports.push(report);
    try {
      hooks.onCommit?.(state, report);
      if (state.gameOver) return stop(state.gameOverReason ?? 'ゲームが終了しました。');
      if (operatingProgram && state.week >= operatingProgram.endWeek) return stop('事業投資の26週間が終了しました。保存済みの実績を確認し、次の運営方針を判断してください。');
      const completedBefore = initial.development?.programs.reduce((n, p) => n + p.completedChoiceIds.length, 0) ?? 0;
      const completedNow = state.development?.programs.reduce((n, p) => n + p.completedChoiceIds.length, 0) ?? 0;
      if (completedNow > completedBefore) return stop('街区開発が完成しました。次の投資方針を確認してください。');
      const railCompletedBefore = initial.railProjects?.projects.filter(p => p.completeWeek <= initial.week).length ?? 0;
      const railCompletedNow = state.railProjects?.projects.filter(p => p.completeWeek <= state.week).length ?? 0;
      if (railCompletedNow > railCompletedBefore) return stop('沿線の共同開発が完成しました。今週からの効果と店舗の運営を確認してください。');
      if (getMarketGroupFinancials(state).operating > getMarketGroupFinancials(initial).operating) return stop('買収した事業の運営準備が完了しました。収益と次の投資を確認してください。');
      if (!beforeIPO && getSummary(state).ipoEligible) return stop('新たにIPOの条件を満たしました。上場の判断をしてください。');
      if (stopOnNewOffers && getOffers(state).some(offer => !beforeOffers.has(offer.id))) return stop('新しい営業提案が届きました。内容を確認してください。');
    } catch (error) {
      return stop(`この週の保存は完了しましたが、表示・確認処理で停止しました。${detail(error)}`);
    }
  }
  return stop(null);
}
