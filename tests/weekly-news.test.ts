import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/model';
import { STOCKS } from '../src/data/stocks';
import { advanceWeek, applyAction, createGame, operatingConditions, previewWeek } from '../src/sim/engine';
import { createWeeklyNews, isWeeklyNewsDigest } from '../src/sim/weeklyNews';
import { createEnvelope, decodeEnvelope, validateGame } from '../src/persistence';
import WeeklyNews from '../src/ui/WeeklyNews';

function cafe(seed = 812) {
  const opened = applyAction(createGame('街と市場の記録', seed), { type: 'openStore', lotId: 'center-01', style: 'standard' });
  return applyAction(opened, { type: 'updateStore', storeId: opened.stores[0].id, changes: { price: 950, staff: 4, quality: 85, marketing: 0 } });
}
const render = (state: GameState) => renderToStaticMarkup(createElement(WeeklyNews, { report: state.lastReport! }));

describe('recorded weekly city and company news', () => {
  it('records exact old/new prices and market breadth without changing its inputs', () => {
    const before = cafe(), after = advanceWeek(before), report = after.lastReport!;
    const prices = { ...before.stockPrices };
    const first = STOCKS.find(stock => stock.market !== 'REIT')!;
    const second = STOCKS.find(stock => stock.market !== 'REIT' && stock.id !== first.id)!;
    prices[first.id] *= 1.1;
    prices[second.id] *= .95;
    const original = structuredClone({ before, prices, report });
    const context = operatingConditions(before);
    const digest = createWeeklyNews(before, prices, context, report);
    expect(digest.market).toEqual({ advances: 1, declines: 1, unchanged: STOCKS.length - 2 });
    expect(digest.companies.map(row => row.stockId)).toEqual([first.id, second.id]);
    for (const row of digest.companies) {
      expect(row.previousPrice).toBe(before.stockPrices[row.stockId]);
      expect(row.currentPrice).toBe(prices[row.stockId]);
      expect(row.percentChange).toBe((row.currentPrice / row.previousPrice - 1) * 100);
    }
    expect(isWeeklyNewsDigest(digest, report.week)).toBe(true);
    expect({ before, prices, report }).toEqual(original);
    context.demand = .93;
    expect(digest.city.current.demand).toBe(1);
  });

  it('reports one-sided markets honestly and excludes owned companies and undefined percent bases', () => {
    const before = cafe(), report = advanceWeek(before).lastReport!;
    const [first, second] = STOCKS.filter(stock => stock.market !== 'REIT');
    before.marketAcquisitions = { research: [], companies: [{ stockId: first.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 3 }] };
    before.stockPrices[second.id] = 0;
    const prices = Object.fromEntries(STOCKS.map(stock => [stock.id, Math.max(1, before.stockPrices[stock.id] * 1.05)]));
    const digest = createWeeklyNews(before, prices, operatingConditions(before), report);
    expect(digest.market.advances).toBe(STOCKS.length);
    expect(digest.market.declines).toBe(0);
    expect(digest.companies).toHaveLength(2);
    expect(digest.companies.every(row => row.percentChange > 0 && ![first.id, second.id].includes(row.stockId))).toBe(true);
    expect(isWeeklyNewsDigest(digest, report.week)).toBe(true);
  });

  it('attaches news only to actual settlement and records that exact economic context', () => {
    const before = cafe(), original = structuredClone(before);
    expect(previewWeek(before).news).toBeUndefined();
    const next = advanceWeek(before), news = next.lastReport!.news!;
    expect(news).toBeDefined();
    expect(news.week).toBe(next.lastReport!.week);
    expect(news.city.current).toEqual({ demand: operatingConditions(before).demand, wages: operatingConditions(before).wages, rents: operatingConditions(before).rents });
    expect(news.city.previous).toBeUndefined();
    for (const row of news.companies) {
      expect(row.previousPrice).toBe(before.stockPrices[row.stockId]);
      expect(row.currentPrice).toBe(next.stockPrices[row.stockId]);
      expect(row.percentChange).toBe((row.currentPrice / row.previousPrice - 1) * 100);
    }
    const second = advanceWeek(next).lastReport!.news!;
    expect(second.city.previous).toEqual(news.city.current);
    expect(isWeeklyNewsDigest(second, 2)).toBe(true);
    expect(before).toEqual(original);
  });

  it('records development completion once and preserves the engine headline', () => {
    const before = cafe();
    before.week = 4;
    before.development = { programs: [{ districtId: 'center', completedChoiceIds: [], construction: { choiceId: 'center-0-commerce', startWeek: 1, completeWeek: 4 } }] };
    const complete = advanceWeek(before);
    const event = complete.lastReport!.news!.events.find(event => event.category === 'city')!;
    expect(event.text).toContain('歩行者とカフェの回遊整備');
    expect(event.text).toContain('が完成。');
    expect(complete.lastReport!.headlines).toContain(event.text);
    expect(event.text).toContain('保有物件がないため運営は休止中');
    expect(advanceWeek(complete).lastReport!.news!.events.some(event => event.category === 'city')).toBe(false);
  });

  it('records rail completion and the actual start of owned-company operations once', () => {
    const before = cafe(), stock = STOCKS.find(stock => stock.market !== 'REIT')!;
    before.week = 5;
    before.railProjects = { projects: [{ districtId: 'center', choiceId: 'commerce', startWeek: 1, completeWeek: 5 }] };
    before.marketAcquisitions = { research: [], companies: [{ stockId: stock.id, mode: 'autonomous', acquiredWeek: 3, readyWeek: 5 }] };
    const complete = advanceWeek(before), news = complete.lastReport!.news!;
    expect(news.events.some(event => event.category === 'city' && event.text.includes('駅前回遊・商業パートナー'))).toBe(true);
    expect(news.events.some(event => event.category === 'company' && event.text === `${stock.name}の事業運営が開始しました。`)).toBe(true);
    expect(news.events.every(event => complete.lastReport!.headlines.includes(event.text))).toBe(true);
    expect(news.companies.some(row => row.stockId === stock.id)).toBe(false);
    expect(advanceWeek(complete).lastReport!.news!.events).toEqual([]);
  });

  it('preserves a recorded report through trading, settings, export/import, reopening and later settlement', async () => {
    const settled = advanceWeek(cafe()), savedNews = structuredClone(settled.lastReport!.news), markup = render(settled);
    const stockId = settled.lastReport!.news!.companies[0].stockId;
    const traded = applyAction(settled, { type: 'buyStock', stockId, shares: 1 });
    const edited = applyAction(traded, { type: 'updateStore', storeId: settled.stores[0].id, changes: { price: 1100, staff: 3 } });
    const restored = await decodeEnvelope(await createEnvelope(edited));
    expect(restored.lastReport!.news).toEqual(savedNews);
    expect(render(restored)).toBe(markup);
    expect(render(restored)).toBe(markup);
    const next = advanceWeek(restored);
    expect(next.lastReport!.news!.week).toBe(2);
    expect(next.lastReport!.news).not.toEqual(savedNews);
    expect(restored.lastReport!.news).toEqual(savedNews);
    expect(settled.lastReport!.news).toEqual(savedNews);
    expect(markup).not.toMatch(/見込み|予測|最新ニュース|出店しました/);
    for (const row of savedNews!.companies) {
      expect(markup).toContain(`data-news-stock-id="${row.stockId}"`);
      expect(markup).toContain(`¥${row.previousPrice.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`);
      expect(markup).toContain(`¥${row.currentPrice.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`);
    }
  });

  it('accepts old saves without news and shows only their saved headlines', async () => {
    const state = advanceWeek(cafe());
    delete state.lastReport!.news;
    state.lastReport!.headlines = ['この週に保存された出来事'];
    const restored = await decodeEnvelope(await createEnvelope(state));
    Object.defineProperty(restored, 'stockPrices', { get: () => { throw new Error('Historical news must not inspect current prices'); } });
    const markup = render(restored);
    expect(markup).toContain('市場ニュースの記録がありません');
    expect(markup).toContain('この週に保存された出来事');
    expect(markup).not.toContain('data-news-stock-id');
    expect(restored.lastReport!.news).toBeUndefined();
  });

  it('rejects malformed or oversized imported snapshots instead of inventing replacements', () => {
    const settled = advanceWeek(cafe());
    const invalidValues: unknown[] = [
      null,
      { ...settled.lastReport!.news!, week: 99 },
      { ...settled.lastReport!.news!, extra: 'unknown field' },
      { ...settled.lastReport!.news!, market: { advances: 101, declines: 0, unchanged: 0 } },
      { ...settled.lastReport!.news!, market: { advances: 0, declines: 0, unchanged: 0 } },
      { ...settled.lastReport!.news!, city: { current: { demand: Infinity, wages: 1, rents: 1 } } },
      { ...settled.lastReport!.news!, city: { current: { demand: 2, wages: 1, rents: 1 } } },
      { ...settled.lastReport!.news!, city: { current: { demand: 1, wages: 1, rents: 1 }, previous: { demand: 1, wages: 1, rents: 1 } } },
      { ...settled.lastReport!.news!, companies: [{ stockId: 'unknown', previousPrice: 1, currentPrice: 2, percentChange: 100 }] },
      { ...settled.lastReport!.news!, companies: [{ ...settled.lastReport!.news!.companies[0], percentChange: 999 }] },
      { ...settled.lastReport!.news!, companies: [{ ...settled.lastReport!.news!.companies[0], previousPrice: 0 }] },
      { ...settled.lastReport!.news!, companies: Array(3).fill(settled.lastReport!.news!.companies[0]) },
      { ...settled.lastReport!.news!, companies: Array(2).fill(settled.lastReport!.news!.companies[0]) },
      { ...settled.lastReport!.news!, events: Array(6).fill({ category: 'city', text: '完成' }) },
      { ...settled.lastReport!.news!, events: [{ category: 'forecast', text: '来週の予測' }] },
      { ...settled.lastReport!.news!, events: [{ category: 'city', text: 'x'.repeat(1001) }] },
      { ...settled.lastReport!.news!, events: [{ category: 'city', text: '' }] },
    ];
    for (const news of invalidValues) {
      expect(isWeeklyNewsDigest(news, 1)).toBe(false);
      const imported = structuredClone(settled);
      (imported.lastReport! as unknown as Record<string, unknown>).news = news;
      expect(() => validateGame(imported)).toThrow();
    }
  });
});
