import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STOCKS } from '../src/data/stocks';
import type { GameState } from '../src/model';
import { advanceWeek, applyAction, createGame, getSummary } from '../src/sim/engine';
import CampaignCompletionScreen from '../src/ui/CampaignCompletionScreen';
import MarketAcquisitionsPanel from '../src/ui/MarketAcquisitionsPanel';
import ProgressionPanel from '../src/ui/ProgressionPanel';
import WeeklyReviewScreen, { CurrentListingOpportunity } from '../src/ui/WeeklyReviewScreen';

// Select only a presentation phase; actual simulation and eligibility stay real.
const phase = vi.hoisted(() => ({ current: 'summary' as 'summary' | 'news' | 'details' }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === 'summary' ? phase.current : initial) };
});

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const settled = () => advanceWeek(applyAction(createGame('街の会社', 962), { type: 'openStore', lotId: 'center-01', style: 'standard' }));

// A historical UI fixture isolates replay; it is not a natural campaign run.
function achievedCompany() {
  const state = settled();
  state.week = 501;
  state.totalCustomers = 9_000_000;
  state.campaignAchievement = {
    week: 499, cash: 812_345_678, netProfit: 12_345_678,
    totalCustomers: 8_900_000, storeCount: 6, propertyCount: 4,
    subsidiaries: 8, marketBusinesses: 100, districts: 4,
  };
  return state;
}

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}

beforeEach(() => { phase.current = 'summary'; });

describe('saved campaign achievement presentation', () => {
  it('uses the first saved achievement after later losses and asset sales', () => {
    const state = achievedCompany();
    state.cash = 17;
    state.properties = [];
    state.subsidiaries = [];
    state.lastReport = { ...state.lastReport!, week: 500, netProfit: -900_000 };
    const before = structuredClone(state);
    const onClose = vi.fn(), onReviewWeek = vi.fn();
    const html = renderToStaticMarkup(createElement(CampaignCompletionScreen, { state, onClose, onReviewWeek }));
    expect(html).toContain('<dialog');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-achievement-week="499"');
    expect(html).toContain('第499週に達成');
    expect(html).toContain('街の会社');
    expect(html).toContain(yen(before.campaignAchievement!.netProfit));
    expect(html).toContain(yen(before.campaignAchievement!.cash));
    expect(html).toContain('108<span>の事業');
    expect(html).toContain('街の企業8社と市場100事業');
    expect(html).toContain('4<span>地区の開発');
    expect(html).toContain('達成時の店舗 6店 · 直接保有物件 4件');
    expect(html).not.toContain('¥17');
    expect(html).not.toContain('¥-900,000');
    expect(html).not.toContain('営業結果を見る');
    expect(html).not.toMatch(/見込み|予測|スコア/);
    expect(onClose).not.toHaveBeenCalled();
    expect(onReviewWeek).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });

  it('offers report review only while the exact achievement report is available', () => {
    const state = achievedCompany();
    state.lastReport = { ...state.lastReport!, week: 499, netProfit: state.campaignAchievement!.netProfit };
    const onReviewWeek = vi.fn();
    const html = renderToStaticMarkup(createElement(CampaignCompletionScreen, { state, onClose: vi.fn(), onReviewWeek }));
    expect(html).toContain('第499週の営業結果を見る');
    expect(renderToStaticMarkup(createElement(CampaignCompletionScreen, { state, onClose: vi.fn() }))).not.toContain('営業結果を見る');
    expect(onReviewWeek).not.toHaveBeenCalled();
  });

  it('retains the receipt for an ended company without promising continued management', () => {
    const state = achievedCompany();
    state.gameOver = true;
    state.gameOverReason = '経営終了';
    const html = renderToStaticMarkup(createElement(CampaignCompletionScreen, { state, onClose: vi.fn() }));
    expect(html).toContain('第499週に達成');
    expect(html).toContain('達成記録を閉じる');
    expect(html).toContain('経営終了後も振り返れます');
    expect(html).not.toContain('街で経営を続ける');
    expect(html).not.toContain('これからも');
  });

  it('does not infer a receipt from a company without an achievement record', () => {
    expect(renderToStaticMarkup(createElement(CampaignCompletionScreen, { state: settled(), onClose: vi.fn() }))).toBe('');
  });

  it('keeps saved completion replay explicit in the optional progression panel', () => {
    const state = achievedCompany();
    state.gameOver = true;
    const before = structuredClone(state), onNavigate = vi.fn(), onShowCompletion = vi.fn();
    const tree = ProgressionPanel({ state, onNavigate, onShowCompletion });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('第499週の達成記録');
    expect(html).toContain('data-roadmap-step="campaign" class="is-achieved"');
    expect(html).not.toContain('継続収益の条件');
    expect(onShowCompletion).not.toHaveBeenCalled();
    const replay = elements(tree).find(element => element.type === 'button' && element.props.onClick === onShowCompletion);
    expect(replay).toBeDefined();
    (replay!.props.onClick as () => void)();
    expect(onShowCompletion).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });
});

describe('weekly and acquisition routes remain explicit', () => {
  it('restores the next-cafe action in details without crowding the summary', () => {
    const state = settled(), onBrowseSites = vi.fn();
    const props = { state, onClose: vi.fn(), onBrowseSites };
    expect(renderToStaticMarkup(createElement(WeeklyReviewScreen, props))).not.toContain('次の出店候補を見る');
    phase.current = 'details';
    expect(renderToStaticMarkup(createElement(WeeklyReviewScreen, props))).toContain('次の出店候補を見る');
    expect(onBrowseSites).not.toHaveBeenCalled();
    state.gameOver = true;
    expect(renderToStaticMarkup(createElement(WeeklyReviewScreen, props))).not.toContain('次の出店候補を見る');
  });

  it('shows current actual IPO eligibility separately from older saved news', () => {
    let state = createGame('上場を考える会社', 963);
    state.cash = 80_000_000;
    for (const lotId of ['center-01', 'dogenzaka-01', 'miyashita-01']) state = applyAction(state, { type: 'openStore', lotId, style: 'standard' });
    state = advanceWeek(state);
    state.profitableWeeks = 12;
    state.week = 30;
    expect(getSummary(state).ipoEligible).toBe(true);
    const before = structuredClone(state), onExchange = vi.fn();
    const props = { state, onClose: vi.fn(), onExchange };
    expect(renderToStaticMarkup(createElement(WeeklyReviewScreen, props))).not.toContain('現在の上場機会');
    phase.current = 'news';
    const html = renderToStaticMarkup(createElement(WeeklyReviewScreen, props));
    expect(html).toContain('第1週の街と企業ニュース');
    expect(html).toContain('現在の上場機会');
    expect(html).toContain('現在の会社でできること');
    expect(html).toContain('証券市場で条件を確認');
    expect(state.lastReport).toEqual(before.lastReport);
    expect(onExchange).not.toHaveBeenCalled();
    const opportunity = CurrentListingOpportunity({ state, onExchange });
    const button = elements(opportunity).find(element => element.type === 'button');
    (button!.props.onClick as () => void)();
    expect(onExchange).toHaveBeenCalledOnce();
    expect(state).toEqual(before);
    for (const changes of [{ listed: true }, { gameOver: true }, { lastReport: null }]) {
      expect(renderToStaticMarkup(createElement(CurrentListingOpportunity, { state: { ...state, ...changes }, onExchange }))).toBe('');
    }
  });

  it('starts with the remaining acquisition candidates while retaining all and owned filters', () => {
    const state = createGame('最後の取得候補', 964);
    state.week = 100;
    state.listed = true;
    state.marketAcquisitions = {
      research: [],
      companies: STOCKS.slice(0, -1).map(stock => ({ stockId: stock.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 3 })),
    };
    const before = structuredClone(state), onAction = vi.fn();
    const html = renderToStaticMarkup(createElement(MarketAcquisitionsPanel, { state, onAction }));
    expect(html).toContain('value="unowned" selected=""');
    expect(html).toContain('<option value="all">すべての候補</option>');
    expect(html).toContain('<option value="owned">グループ傘下</option>');
    expect(html).toContain(`<h3>${STOCKS.at(-1)!.name}</h3>`);
    expect(html.match(/class="ma-card"/g)).toHaveLength(1);
    expect(onAction).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });
});
