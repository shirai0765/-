import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceWeek, applyAction, createGame } from '../src/sim/engine';
import { SETTLEMENT_REVEAL_MS, settlementRevealFrame, WeeklySettlementSummary } from '../src/ui/WeeklyResults';

// A CPU-only hook/RAF harness exercises lifecycle, skipping, and replay without
// a browser. The state/report below still comes from the real settlement engine.
const hooks = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], stateIndex: 0, refIndex: 0, effect: undefined as undefined | (() => void | (() => void)) }));
const cue = vi.hoisted(() => vi.fn());
vi.mock('../src/audio/CityAudioCues', () => ({ emitCityAudioCue: cue }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual,
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++;
      if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next; }];
    },
    useRef: (initial: unknown) => { const index = hooks.refIndex++; return hooks.refs[index] ??= { current: initial }; },
    useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect; },
  };
});

let frameId = 0;
let frames = new Map<number, FrameRequestCallback>();
let reduced = false;
let motionListener: (() => void) | undefined;
let dispose: void | (() => void);

beforeEach(() => {
  hooks.states = []; hooks.refs = []; hooks.stateIndex = 0; hooks.refIndex = 0; hooks.effect = undefined;
  frames = new Map(); frameId = 0; reduced = false; motionListener = undefined; dispose = undefined;
  cue.mockClear();
  vi.stubGlobal('window', { matchMedia: () => ({ get matches() { return reduced; }, addEventListener: (_: string, listener: () => void) => { motionListener = listener; }, removeEventListener: () => { motionListener = undefined; } }) });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
});
afterEach(() => { dispose?.(); vi.unstubAllGlobals(); });

function company(key: string, profit = 75_250, cashChange = -80_000) {
  const state = advanceWeek(applyAction(createGame('実際の決算', 909), { type: 'openStore', lotId: 'center-01', style: 'standard' }));
  state.id = key;
  state.lastReport = { ...state.lastReport!, netProfit: profit, cashChange };
  state.history.find(point => point.week === state.lastReport!.week)!.cash = 9_000_000;
  state.cash = 17; // Later spending must not become the animation's ending cash.
  return state;
}

function render(state: ReturnType<typeof company>) {
  hooks.stateIndex = 0; hooks.refIndex = 0;
  const element = WeeklySettlementSummary({ state })!;
  return (element.type as (props: typeof element.props) => ReactElement<Record<string, unknown>>)(element.props);
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Record<string, unknown>>(child) ? [child, ...elements(child.props.children as ReactNode)] : []);
}
function frame(time: number) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); }
function resetMountedHooks() { hooks.states = []; hooks.refs = []; hooks.stateIndex = 0; hooks.refIndex = 0; }

describe('actual settlement reveal', () => {
  it('stages exact signed amounts and recorded cash within 1.2 seconds', () => {
    const state = company('reveal-natural'), before = structuredClone(state);
    expect(render(state).props['data-settlement-animation']).toBe('reveal');
    dispose = hooks.effect!();
    frame(0); frame(550);
    const middle = hooks.states[0] as ReturnType<typeof settlementRevealFrame>;
    expect(middle.phase).toBe('count');
    expect(middle.profit).toBeGreaterThan(0);
    expect(middle.profit).toBeLessThan(state.lastReport!.netProfit);
    expect(middle.cashChange).toBeLessThan(0);
    expect(middle.cash).toBeGreaterThan(9_000_000);
    frame(960);
    expect(hooks.states[0]).toMatchObject({ phase: 'finish', profit: 75_250, cashChange: -80_000, cash: 9_000_000 });
    frame(SETTLEMENT_REVEAL_MS);
    expect(render(state).props['data-settlement-animation']).toBe('complete');
    expect(frames.size).toBe(0);
    expect(SETTLEMENT_REVEAL_MS).toBeLessThanOrEqual(1500);
    expect(cue).toHaveBeenCalledExactlyOnceWith({ kind: 'weekly', reportKey: `${state.id}:1`, netProfit: 75_250, reducedMotion: false, gameOver: false });
    expect(state).toEqual(before);
  });

  it('tap completes immediately and reopening the same report never replays', () => {
    const state = company('reveal-skip');
    render(state); dispose = hooks.effect!(); frame(0); frame(300);
    const skip = elements(render(state)).find(element => element.props.className === 'weekly-results-reveal-finish')!;
    (skip.props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation: vi.fn() });
    expect(hooks.states[0]).toEqual({ phase: 'complete', profit: 75_250, cashChange: -80_000, cash: 9_000_000 });
    expect(frames.size).toBe(0);
    dispose?.(); resetMountedHooks();
    expect(render(state).props['data-settlement-animation']).toBe('complete');
    dispose = hooks.effect!();
    expect(frames.size).toBe(0);
    expect(cue).toHaveBeenCalledTimes(1);
  });

  it('reduced motion is instant, and enabling it mid-reveal cancels all frames', () => {
    reduced = true;
    const instant = company('reveal-reduced');
    expect(render(instant).props['data-settlement-animation']).toBe('complete');
    dispose = hooks.effect!();
    expect(frames.size).toBe(0);
    expect(cue).toHaveBeenLastCalledWith(expect.objectContaining({ reducedMotion: true }));
    dispose?.(); resetMountedHooks(); reduced = false;
    const changing = company('reveal-motion-change');
    render(changing); dispose = hooks.effect!(); frame(0); frame(200);
    reduced = true; motionListener!();
    expect(hooks.states[0]).toMatchObject({ phase: 'complete', profit: 75_250, cash: 9_000_000 });
    expect(frames.size).toBe(0);
    expect(cue).toHaveBeenCalledTimes(2);
  });

  it.each([-700_000, 0])('never decorates a %s result as a profitable reward', profit => {
    const state = company(`reveal-outcome-${profit}`, profit, -900_000);
    const tree = render(state);
    expect(tree.props['data-settlement-outcome']).toBe(profit < 0 ? 'negative' : 'neutral');
    expect(elements(tree).some(element => element.props.className === 'weekly-results-reward-art')).toBe(false);
    const amounts = { profit, cashChange: -900_000, cash: 9_000_000 };
    for (const elapsed of [0, 140, 350, 800, 960, 1180]) {
      const result = settlementRevealFrame(amounts, elapsed);
      expect(result.profit).toBeLessThanOrEqual(0);
      expect(result.profit).toBeGreaterThanOrEqual(profit);
      expect(result.cashChange).toBeLessThanOrEqual(0);
    }
    expect(settlementRevealFrame(amounts, 1180)).toEqual({ ...amounts, phase: 'complete' });
  });

  it('does not give an ended company a positive burst and cancels on unmount', () => {
    const state = company('reveal-ended'); state.gameOver = true;
    expect(elements(render(state)).some(element => element.props.className === 'weekly-results-reward-art')).toBe(false);
    dispose = hooks.effect!();
    expect(cue).toHaveBeenLastCalledWith(expect.objectContaining({ gameOver: true }));
    expect(frames.size).toBe(1);
    dispose?.(); dispose = undefined;
    expect(frames.size).toBe(0);
    expect(motionListener).toBeUndefined();
  });

  it('keeps unavailable ending cash honest through every animation stage', () => {
    for (const elapsed of [0, 140, 550, 960, 1180]) expect(settlementRevealFrame({ profit: 100, cashChange: 0, cash: null }, elapsed).cash).toBeNull();
  });
});
