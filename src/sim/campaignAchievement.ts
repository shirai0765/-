import type { GameState, WeeklyReport } from '../model';
import { getCampaignRequirements } from './campaign';

/** The first fully operating, profitable settlement of the finite campaign.
 * These counts describe its original target set, even during later play. */
export interface CampaignAchievement {
  readonly week: number;
  readonly cash: number;
  readonly netProfit: number;
  readonly totalCustomers: number;
  readonly storeCount: number;
  readonly propertyCount: number;
  readonly subsidiaries: 8;
  readonly marketBusinesses: 100;
  readonly districts: 4;
}

/** Call only with the actual report registered during advanceWeek, after
 * default checks and development settlement. Never backfill on load or action.
 * Evaluate operations in report.week, before any next-week handover counts. */
export function settleCampaignAchievement(state: GameState, report: WeeklyReport): CampaignAchievement | undefined {
  if (state.campaignAchievement) return state.campaignAchievement;
  if (!state.lastReport || state.lastReport.week !== report.week || state.lastReport.netProfit !== report.netProfit ||
      !Number.isSafeInteger(report.week) || report.week < 1 ||
      (report.week !== state.week && report.week !== state.week - 1) ||
      !Number.isFinite(report.netProfit) || report.netProfit <= 0) return undefined;
  const settled = { ...state, week: report.week };
  if (!getCampaignRequirements(settled).readyToSettle) return undefined;
  return {
    week: report.week,
    cash: state.cash,
    netProfit: report.netProfit,
    totalCustomers: state.totalCustomers,
    storeCount: state.stores.length,
    propertyCount: state.properties.length,
    subsidiaries: 8,
    marketBusinesses: 100,
    districts: 4,
  };
}

/** Validate history against saved time and cumulative customers, not today's
 * assets or profitability: later sales, losses and game over retain the record. */
export function validateCampaignAchievement(value: unknown, state: Pick<GameState, 'week' | 'totalCustomers'>): asserts value is CampaignAchievement {
  const invalid = () => { throw new Error('キャンペーンの達成記録が不正です。'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  const fields = ['week', 'cash', 'netProfit', 'totalCustomers', 'storeCount', 'propertyCount', 'subsidiaries', 'marketBusinesses', 'districts'];
  if (Object.keys(record).length !== fields.length || Object.keys(record).some(key => !fields.includes(key))) return invalid();
  const integer = (key: string, min: number, max: number) => typeof record[key] === 'number' && Number.isSafeInteger(record[key]) && record[key] >= min && record[key] <= max;
  if (!integer('week', 1, Math.min(999_999, state.week - 1)) ||
      !integer('cash', 0, 1e18) || !integer('netProfit', 1, 1e18) ||
      !integer('totalCustomers', 0, state.totalCustomers) ||
      !integer('storeCount', 0, 10_000) || !integer('propertyCount', 4, 10_000) ||
      record.subsidiaries !== 8 || record.marketBusinesses !== 100 || record.districts !== 4) return invalid();
}
