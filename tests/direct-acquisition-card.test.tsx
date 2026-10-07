import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ACQUISITION_TARGETS } from '../src/data/district';
import { createGame, applyAction } from '../src/sim/engine';
import { formatReputation } from '../src/format';
import DirectAcquisitionCard from '../src/ui/DirectAcquisitionCard';

const target = ACQUISITION_TARGETS.find(row => row.id === 'metropolitan-rail')!;
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Record<string, unknown>>(child)
    ? [child, ...elements(child.props.children as ReactNode)] : []);
}
const buy = (tree: ReactNode) => elements(tree).find(element => element.type === 'button' && element.props.children === '買収する');
function company(reputation = 88) {
  const state = createGame('買収条件の境界', 8060);
  state.reputation = reputation;
  state.cash = target.price;
  return state;
}

describe('direct acquisition raw eligibility and visible thresholds', () => {
  it.each([
    [87.69, '87.6', false], [87.999, '87.9', false], [88, '88.0', true],
  ] as const)('shows reputation %s without rounding across the engine gate', (reputation, display, eligible) => {
    const state = company(reputation), before = structuredClone(state), onAction = vi.fn(), onManageStores = vi.fn();
    const tree = DirectAcquisitionCard({ state, target, onAction, onManageStores });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(`data-target-id="${target.id}"`);
    expect(formatReputation(reputation)).toBe(display);
    expect(html).toContain(`ブランド評価 ${display} / 必要 88.0`);
    expect(html).toContain(eligible ? '条件達成' : '条件未達');
    expect(buy(tree)!.props.disabled).toBe(!eligible);
    expect(onAction).not.toHaveBeenCalled();
    expect(onManageStores).not.toHaveBeenCalled();
    (buy(tree)!.props.onClick as () => void)();
    if (eligible) {
      expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'acquire', targetId: target.id });
      const acquired = applyAction(state, onAction.mock.calls[0][0]);
      expect(acquired.cash).toBe(0);
      expect(acquired.subsidiaries.at(-1)?.id).toBe(target.id);
      expect(acquired.week).toBe(state.week);
    } else {
      expect(onAction).not.toHaveBeenCalled();
      expect(() => applyAction(state, { type: 'acquire', targetId: target.id })).toThrow('信用');
    }
    expect(state).toEqual(before);
  });

  it('explains an exact cash shortage and prevents the rejected engine action', () => {
    const state = company(); state.cash = target.price - 1;
    const onAction = vi.fn();
    const tree = DirectAcquisitionCard({ state, target, onAction, onManageStores: () => {} });
    expect(renderToStaticMarkup(tree)).toContain('購入資金が¥1不足');
    expect(buy(tree)!.props.disabled).toBe(true);
    (buy(tree)!.props.onClick as () => void)();
    expect(onAction).not.toHaveBeenCalled();
    expect(() => applyAction(state, { type: 'acquire', targetId: target.id })).toThrow('現預金');
  });

  it.each(['busy', 'ended', 'owned'] as const)('prevents a duplicate or locked transaction: %s', condition => {
    let state = company();
    if (condition === 'ended') state.gameOver = true;
    if (condition === 'owned') state = applyAction(state, { type: 'acquire', targetId: target.id });
    const onAction = vi.fn();
    const tree = DirectAcquisitionCard({ state, target, onAction, onManageStores: () => {}, disabled: condition === 'busy' });
    const button = buy(tree);
    if (condition === 'owned') expect(button).toBeUndefined();
    else { expect(button!.props.disabled).toBe(true); (button!.props.onClick as () => void)(); }
    expect(onAction).not.toHaveBeenCalled();
  });

  it('links a reputation shortfall to store results without changing the company', () => {
    const state = company(87.69), before = structuredClone(state), onManageStores = vi.fn(), onAction = vi.fn();
    const tree = DirectAcquisitionCard({ state, target, onAction, onManageStores });
    expect(renderToStaticMarkup(tree)).toContain('店舗の満足度と全社の黒字・赤字が、毎週のブランド評価に影響します。');
    const link = elements(tree).find(element => element.type === 'button' && element.props.children === '店舗の営業実績を確認')!;
    (link.props.onClick as () => void)();
    expect(onManageStores).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });
});
