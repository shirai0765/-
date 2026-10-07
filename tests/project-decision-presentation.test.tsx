import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameAction, GameState } from '../src/model';
import { applyAction, createGame, getWeekOutlook } from '../src/sim/engine';
import DevelopmentPanel from '../src/ui/DevelopmentPanel';
import RailProjectsPanel from '../src/ui/RailProjectsPanel';

// Seed only the selected UI dialog; simulation and action validation remain real.
const selection = vi.hoisted(() => ({ current: null as null | { districtId: string; choiceId: string } }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === null ? selection.current : initial) };
});
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const cases = [
  { kind: 'district', selection: { districtId: 'sakuragaoka', choiceId: 'sakuragaoka-0-commerce' }, action: { type: 'startDevelopment', districtId: 'sakuragaoka', choiceId: 'sakuragaoka-0-commerce' } as GameAction,
    debtWarning: '現在の営業計画では、借入中の利益不足が懸念されます。週末の利息後利益が0以下なら倒産します。', cashWarning: '着工後は週末の資金が不足するおそれがあります。' },
  { kind: 'rail', selection: { districtId: 'sakuragaoka', choiceId: 'commerce' }, action: { type: 'startRailProject', districtId: 'sakuragaoka', choiceId: 'commerce' } as GameAction,
    debtWarning: '着工後の維持費により、借入中の利益が不足するおそれがあります。週末の利息後利益が0以下なら倒産します。', cashWarning: '着工後、週末の支払い資金が不足するおそれがあります。' },
];
function company() {
  let state = createGame();
  state.cash = 600_000_000; state.listed = true; state.reputation = 90;
  state = applyAction(state, { type: 'openStore', lotId: 'sakuragaoka-01', style: 'standard' });
  return applyAction(state, { type: 'buyProperty', lotId: 'sakuragaoka-01' });
}
function render(kind: string, state: GameState, onAction = vi.fn(), busy = false) {
  return kind === 'district'
    ? renderToStaticMarkup(createElement(DevelopmentPanel, { state, onAction, busy }))
    : renderToStaticMarkup(createElement(RailProjectsPanel, { state, onAction, busy }));
}
beforeEach(() => { selection.current = null; });

describe('optional project confirmations do not disclose company outcomes', () => {
  it.each(cases)('$kind retains costs and conditions without a full-company profit or ending-cash answer', item => {
    const state = company(), before = structuredClone(state), onAction = vi.fn();
    selection.current = item.selection;
    const after = applyAction(state, item.action);
    const html = render(item.kind, state, onAction);
    expect(html).toContain('<dialog');
    expect(html).toContain(yen(state.cash - after.cash));
    expect(html).toContain(yen(after.cash));
    expect(html).toContain('工期');
    expect(html).toContain('維持費');
    expect(html).toContain('店舗需要');
    expect(html).toContain('賃料');
    expect(html).not.toMatch(/着工後・今週の利益見込み|着工後・週末の現金見込み|今週利益幅|着工後・週末現金の幅|支払と今週の予測|予想現金/);
    for (const outlook of [getWeekOutlook(state), getWeekOutlook(after)]) {
      for (const range of [outlook.netProfit, outlook.cashAfter]) {
        expect(html).not.toContain(`${yen(Math.floor(range.min / 1000) * 1000)}〜${yen(Math.ceil(range.max / 1000) * 1000)}`);
      }
    }
    expect(state).toEqual(before);
    expect(onAction).not.toHaveBeenCalled();
  });

  it.each(cases)('$kind preserves both exact danger messages and still permits explicit risk acceptance', item => {
    const state = company();
    state.loans = [{ id: 'presentation-risk', principal: 2_000_000_000, remaining: 2_000_000_000, annualRate: .5, weeksLeft: 52, weeklyPayment: 900_000_000 }];
    selection.current = item.selection;
    const after = applyAction(state, item.action);
    expect(getWeekOutlook(after).risk).toMatchObject({ debtLossPossible: true, cashShortfallPossible: true });
    const html = render(item.kind, state);
    expect(html).toContain(item.debtWarning);
    expect(html).toContain(item.cashWarning);
    expect(html).toMatch(/<button class="primary">着工する/);
  });

  it.each(cases)('$kind keeps funding and busy submission gates', item => {
    const state = company(); selection.current = item.selection;
    expect(render(item.kind, state, vi.fn(), true)).toMatch(/<button class="primary" disabled="">着工する/);
    state.cash = 0;
    expect(render(item.kind, state)).toMatch(/<button class="primary" disabled="">着工する/);
    expect(state.development?.programs ?? []).toHaveLength(0);
    expect(state.railProjects?.projects ?? []).toHaveLength(0);
  });
});
