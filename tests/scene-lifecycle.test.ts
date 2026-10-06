import { describe, expect, it, vi } from 'vitest';
import { SceneLifecycleQueue } from '../src/city/sceneLifecycle';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

describe('one rendering scene at a time', () => {
  it('waits for late decode disposal before constructing the next renderer', async () => {
    const queue = new SceneLifecycleQueue(), decode = deferred(), order: string[] = [];
    const first = queue.schedule(() => { order.push('first mount'); return async () => { order.push('first stop'); await decode.promise; order.push('first freed'); }; });
    const second = queue.schedule(() => { order.push('second mount'); return () => { order.push('second freed'); }; });
    await tick(); const retiring = first(); await tick();
    expect(order).toEqual(['first mount', 'first stop']);
    expect(queue.snapshot()).toMatchObject({ activeId: 1, waiting: 1 });
    decode.resolve(); await retiring; await tick();
    expect(order).toEqual(['first mount', 'first stop', 'first freed', 'second mount']);
    await second(); expect(queue.snapshot()).toMatchObject({ activeId: null, waiting: 0 });
  });

  it('skips superseded maps without allowing a later map past an unfinished teardown', async () => {
    const queue = new SceneLifecycleQueue(), decode = deferred(), skipped = vi.fn(() => () => {}), latest = vi.fn(() => () => {});
    const first = queue.schedule(() => () => decode.promise); await tick();
    const second = queue.schedule(skipped), third = queue.schedule(latest);
    const cancelled = second(); void first(); await tick();
    expect(skipped).not.toHaveBeenCalled(); expect(latest).not.toHaveBeenCalled();
    decode.resolve(); await cancelled; await tick();
    expect(skipped).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledTimes(1); await third();
  });

  it('handles StrictMode setup/cleanup/setup without creating the cancelled scene', async () => {
    const queue = new SceneLifecycleQueue(), construct = vi.fn(() => vi.fn());
    const abandoned = queue.schedule(construct); void abandoned();
    const current = queue.schedule(construct); await tick();
    expect(construct).toHaveBeenCalledTimes(1);
    const done = current(); expect(current()).toBe(done); await done;
    expect(construct.mock.results[0].value).toHaveBeenCalledTimes(1);
  });

  it('releases failed WebGL initialization and reports teardown failure without deadlocking', async () => {
    const queue = new SceneLifecycleQueue(), onError = vi.fn(), next = vi.fn(() => () => {});
    const failed = queue.schedule(() => { throw new Error('No WebGL'); }, onError);
    const disposal = queue.schedule(() => async () => { throw new Error('Disposal failed'); }, onError);
    const last = queue.schedule(next);
    await tick(); await failed(); await disposal(); await tick();
    expect(onError.mock.calls.map(([error]) => error.message)).toEqual(['No WebGL', 'Disposal failed']);
    expect(next).toHaveBeenCalledOnce(); await last();
  });
});
