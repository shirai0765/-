import type { GameState, WeeklyReport } from '../model';
import { ACQUISITION_TARGETS } from '../data/district';
import { STOCKS } from '../data/stocks';
import { getDevelopmentPrograms } from './development';

/** Current ownership and operating requirements, without predicting a profit. */
export function getCampaignRequirements(state: GameState) {
  const programs = getDevelopmentPrograms(state);
  const acquiredTargets = ACQUISITION_TARGETS.filter(t => state.subsidiaries.some(s => s.id === t.id)).length;
  const allMarketOperating = STOCKS.every(stock => state.marketAcquisitions?.companies.some(company => company.stockId === stock.id && company.acquiredWeek <= state.week && company.readyWeek <= state.week));
  const activeCompletedDistricts = programs.filter(p => p.phase === 3 && p.active).length;
  const lastReportProfitable = state.lastReport !== null && state.lastReport.netProfit > 0;
  const continuing = !state.gameOver && state.cash >= 0;
  const readyToSettle = continuing && state.listed && acquiredTargets === ACQUISITION_TARGETS.length && allMarketOperating && activeCompletedDistricts === programs.length;
  return {
    readyToSettle, lastReportProfitable, continuing, allMarketOperating, acquiredTargets, activeCompletedDistricts,
  };
}

/** Completion is a saved first achievement; current requirements can change
 * during continued play. The optional old forecast argument is ignored. */
export function getCampaignCompletion(state: GameState, _legacyForecast?: WeeklyReport) {
  const requirements = getCampaignRequirements(state);
  return {
    ...requirements,
    complete: state.campaignAchievement !== undefined,
    achievement: state.campaignAchievement,
    currentRequirementsMet: requirements.readyToSettle && requirements.lastReportProfitable,
  };
}
