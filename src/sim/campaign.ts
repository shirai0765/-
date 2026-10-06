import type { GameState, WeeklyReport } from '../model';
import { ACQUISITION_TARGETS } from '../data/district';
import { STOCKS } from '../data/stocks';
import { getDevelopmentPrograms } from './development';
import { getMarketGroupFinancials } from './marketAcquisitions';
import { previewWeek } from './engine';

/** The UI and automatic strategies share the same finite completion rule. */
export function getCampaignCompletion(state: GameState, forecast: WeeklyReport = previewWeek(state)) {
  const group = getMarketGroupFinancials(state);
  const programs = getDevelopmentPrograms(state);
  const acquiredTargets = ACQUISITION_TARGETS.filter(t => state.subsidiaries.some(s => s.id === t.id)).length;
  const allMarketOperating = group.operating === STOCKS.length && group.integrating === 0;
  const activeCompletedDistricts = programs.filter(p => p.phase === 3 && p.active).length;
  const lastReportProfitable = state.lastReport !== null && state.lastReport.netProfit > 0;
  const forecastProfitable = forecast.netProfit > 0;
  const continuing = !state.gameOver && state.cash >= 0;
  return {
    complete: continuing && state.listed && acquiredTargets === ACQUISITION_TARGETS.length && allMarketOperating && activeCompletedDistricts === programs.length && lastReportProfitable && forecastProfitable,
    lastReportProfitable, forecastProfitable, continuing, allMarketOperating, acquiredTargets, activeCompletedDistricts,
  };
}
