import type { GameState, WeeklyReport } from '../model';
import { STOCKS } from '../data/stocks';
import { developmentHeadlines } from './development';
import { railProjectHeadlines } from './railProjects';

/** Recorded reporting data only; never an input to simulation or a future estimate. */
export interface WeeklyNewsConditions { readonly demand: number; readonly wages: number; readonly rents: number }
export interface WeeklyStockMovement { readonly stockId: string; readonly previousPrice: number; readonly currentPrice: number; readonly percentChange: number }
export interface WeeklyNewsDigest {
  readonly week: number;
  readonly market: { readonly advances: number; readonly declines: number; readonly unchanged: number };
  readonly companies: readonly WeeklyStockMovement[];
  readonly city: { readonly current: WeeklyNewsConditions; readonly previous?: WeeklyNewsConditions };
  readonly events: readonly { readonly category: 'city' | 'company'; readonly text: string }[];
}

export const WEEKLY_NEWS_COMPANY_LIMIT = 2;
export const WEEKLY_NEWS_EVENT_LIMIT = 5;
const conditions = ({ demand, wages, rents }: WeeklyNewsConditions): WeeklyNewsConditions => ({ demand, wages, rents });

/** Call once after the existing end-week price update, with this week's actual report. */
export function createWeeklyNews(
  before: GameState,
  settledPrices: Readonly<Record<string, number>>,
  currentConditions: WeeklyNewsConditions,
  report: WeeklyReport,
  previousConditions?: WeeklyNewsConditions,
): WeeklyNewsDigest {
  const market = { advances: 0, declines: 0, unchanged: 0 };
  const owned = new Set(before.marketAcquisitions?.companies.map(company => company.stockId) ?? []);
  const movements: WeeklyStockMovement[] = [];
  for (const stock of STOCKS) {
    const previousPrice = before.stockPrices[stock.id], currentPrice = settledPrices[stock.id];
    if (currentPrice > previousPrice) market.advances++;
    else if (currentPrice < previousPrice) market.declines++;
    else market.unchanged++;
    // Imported legacy prices can be zero or tiny. A percent comparison then has
    // no representable basis; omit that company rather than inventing a return.
    if (owned.has(stock.id) || stock.market === 'REIT' || previousPrice < .01) continue;
    const percentChange = (currentPrice / previousPrice - 1) * 100;
    movements.push({ stockId: stock.id, previousPrice, currentPrice, percentChange });
  }
  const order = (a: WeeklyStockMovement, b: WeeklyStockMovement) => b.percentChange - a.percentChange || a.stockId.localeCompare(b.stockId);
  const rising = movements.filter(row => row.percentChange > 0).sort(order);
  const falling = movements.filter(row => row.percentChange < 0).sort((a, b) => order(b, a));
  const companies = rising.length && falling.length
    ? [rising[0], falling[0]]
    : movements.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange) || a.stockId.localeCompare(b.stockId)).slice(0, WEEKLY_NEWS_COMPANY_LIMIT);
  const cityEvents = [...developmentHeadlines(before), ...railProjectHeadlines(before)]
    .filter(text => report.headlines.includes(text))
    .map(text => ({ category: 'city' as const, text }));
  const companyEvents = report.headlines
    .filter(text => text.endsWith('の事業運営が開始しました。') || text.endsWith('の保有資産運用が開始しました。'))
    .map(text => ({ category: 'company' as const, text }));
  return {
    week: report.week,
    market,
    companies,
    city: { current: conditions(currentConditions), ...(previousConditions ? { previous: conditions(previousConditions) } : {}) },
    events: [...cityEvents, ...companyEvents].slice(0, WEEKLY_NEWS_EVENT_LIMIT),
  };
}

type Obj = Record<string, unknown>;
function object(value: unknown, allowed: readonly string[]): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key));
}
function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function integer(value: unknown, min: number, max: number): value is number {
  return finite(value, min, max) && Number.isSafeInteger(value);
}
function validConditions(value: unknown): value is WeeklyNewsConditions {
  return object(value, ['demand', 'wages', 'rents']) && finite(value.demand, .93 - 1e-12, 1.07 + 1e-12)
    && finite(value.wages, .975 - 1e-12, 1.205 + 1e-12) && finite(value.rents, 1, 1.15 + 1e-12);
}

/** Validate imported snapshots without recomputing them from a later game state. */
export function isWeeklyNewsDigest(value: unknown, reportWeek: number): value is WeeklyNewsDigest {
  if (!object(value, ['week', 'market', 'companies', 'city', 'events']) || !integer(value.week, 0, 1_000_000) || value.week !== reportWeek) return false;
  const { market, companies, city, events } = value;
  if (!object(market, ['advances', 'declines', 'unchanged']) || !integer(market.advances, 0, STOCKS.length)
    || !integer(market.declines, 0, STOCKS.length) || !integer(market.unchanged, 0, STOCKS.length)
    || market.advances + market.declines + market.unchanged !== STOCKS.length) return false;
  if (!object(city, ['current', 'previous']) || !validConditions(city.current)) return false;
  if (value.week > 1 ? !validConditions(city.previous) : Object.hasOwn(city, 'previous')) return false;
  if (!Array.isArray(companies) || companies.length > WEEKLY_NEWS_COMPANY_LIMIT) return false;
  const seenStocks = new Set<string>();
  for (const row of companies) {
    if (!object(row, ['stockId', 'previousPrice', 'currentPrice', 'percentChange']) || typeof row.stockId !== 'string'
      || !STOCKS.some(stock => stock.id === row.stockId && stock.market !== 'REIT') || seenStocks.has(row.stockId)
      || !finite(row.previousPrice, .01, 1e18) || !finite(row.currentPrice, 1, 1e12) || !finite(row.percentChange, -100, 1e16)) return false;
    const expected = (row.currentPrice / row.previousPrice - 1) * 100;
    if (Math.abs(expected - row.percentChange) > Math.max(1e-9, Math.abs(expected) * 1e-12)) return false;
    seenStocks.add(row.stockId);
  }
  if (!Array.isArray(events) || events.length > WEEKLY_NEWS_EVENT_LIMIT) return false;
  const seenEvents = new Set<string>();
  for (const event of events) {
    if (!object(event, ['category', 'text']) || !['city', 'company'].includes(String(event.category))
      || typeof event.text !== 'string' || !event.text.trim() || event.text.length > 1000) return false;
    const key = `${event.category}:${event.text}`;
    if (seenEvents.has(key)) return false;
    seenEvents.add(key);
  }
  return true;
}
