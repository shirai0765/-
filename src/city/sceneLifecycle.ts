type Teardown = () => void | Promise<void>;

/** A renderer keeps its turn until asynchronous decoders and image disposal settle. */
export class SceneLifecycleQueue {
  private tail: Promise<void> = Promise.resolve();
  private sequence = 0;
  private active: number | null = null;
  private waiting = new Set<number>();

  snapshot() { return { activeId: this.active, waiting: this.waiting.size, scheduled: this.sequence }; }

  schedule(start: () => Teardown, onError: (error: unknown) => void = () => {}): () => Promise<void> {
    const id = ++this.sequence;
    const previous = this.tail;
    let release!: () => void;
    const retired = new Promise<void>(resolve => { release = resolve; });
    this.tail = retired;
    this.waiting.add(id);
    let cancelled = false, started = false, retiring = false;
    let teardown: Teardown | undefined;
    const report = (error: unknown) => { try { onError(error); } catch { /* A notification cannot retain the lease. */ } };
    const finish = () => { this.waiting.delete(id); if (this.active === id) this.active = null; release(); };
    const retire = () => {
      if (retiring || !started) return;
      retiring = true;
      try { Promise.resolve(teardown?.()).catch(report).finally(finish); }
      catch (error) { report(error); finish(); }
    };
    void previous.then(() => {
      if (cancelled) { finish(); return; }
      this.waiting.delete(id); this.active = id;
      try { teardown = start(); started = true; if (cancelled) retire(); }
      catch (error) { report(error); finish(); }
    });
    return () => { cancelled = true; retire(); return retired; };
  }
}

// Survive Vite module replacement while an old renderer is still retiring.
const key = Symbol.for('shibuya.sceneLifecycle');
const owner = globalThis as typeof globalThis & { [key]?: SceneLifecycleQueue };
const queue = owner[key] ?? (owner[key] = new SceneLifecycleQueue());
export const scheduleScene = (start: () => Teardown, onError?: (error: unknown) => void) => queue.schedule(start, onError);
export const getSceneLifecycleSnapshot = () => queue.snapshot();

if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV && typeof window !== 'undefined') {
  Object.assign(window, { __sceneLifecycleSnapshot: getSceneLifecycleSnapshot });
}
