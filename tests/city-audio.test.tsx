import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityAudioEngine } from '../src/audio/CityAudioEngine';
import type { CityAudioContextState } from '../src/audio/CityAudioEngine';
import { CITY_AUDIO_STORAGE_KEY, CityAudioSession, createCityAudioContext, readCityAudioPreferences } from '../src/audio/CityAudioSession';
import CityAudioControl, { cityAudioPresentation } from '../src/ui/CityAudioControl';
import { emitCityAudioCue, subscribeCityAudioCues } from '../src/audio/CityAudioCues';
import type { CityAudioAssetConfig } from '../src/audio/CityAudioAssets';

class Parameter {
  value = 1;
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class Node {
  connect = vi.fn();
  disconnect = vi.fn();
  gain = new Parameter();
  frequency = new Parameter();
  Q = new Parameter();
  threshold = new Parameter();
  ratio = new Parameter();
  attack = new Parameter();
  release = new Parameter();
  playbackRate = new Parameter();
  type = '';
  loop = false;
  buffer: unknown = null;
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}
/** Models state/promise ordering, not a sound device or PCM renderer. */
class Context extends EventTarget {
  state: CityAudioContextState = 'suspended';
  currentTime = 0;
  sampleRate = 8_000;
  destination = new Node();
  gains: Node[] = [];
  oscillators: Node[] = [];
  buffers: Float32Array[] = [];
  sources: Node[] = [];
  resumeBehavior: (() => Promise<void>) | null = null;
  resume = vi.fn(() => {
    if (this.resumeBehavior) return this.resumeBehavior();
    this.transition('running');
    return Promise.resolve();
  });
  suspend = vi.fn(() => { this.transition('suspended'); return Promise.resolve(); });
  close = vi.fn(() => { this.transition('closed'); return Promise.resolve(); });
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createDynamicsCompressor() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
  createBufferSource() { const node = new Node(); this.sources.push(node); return node; }
  decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => ({ duration: 2, length: 16_000, numberOfChannels: 2 } as AudioBuffer));
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length); this.buffers.push(data);
    return { getChannelData: () => data };
  }
  transition(state: CityAudioContextState) { this.state = state; this.dispatchEvent(new Event('statechange')); }
  get audioContext() { return this as unknown as AudioContext; }
}
const preferences = { volume: .6, muted: false, music: .72, ambience: .9 };
const sessions: CityAudioSession[] = [];
const engines: CityAudioEngine[] = [];
const cueSubscriptions: (() => void)[] = [];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function session(context = new Context()) {
  const create = vi.fn(() => context.audioContext);
  const audio = new CityAudioSession({ ...preferences }, create);
  sessions.push(audio);
  return { audio, context, create };
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(async () => {
  for (const audio of sessions.splice(0)) audio.dispose();
  for (const engine of engines.splice(0)) await engine.dispose();
  for (const unsubscribe of cueSubscriptions.splice(0)) unsubscribe();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

const bundledMusic: CityAudioAssetConfig = { music: { variants: [{ path: 'audio/external-v080/bgm/lounge.m4a', loopStart: .1, loopEnd: 1.9 }] } };
function assetSession(context = new Context()) {
  vi.stubGlobal('document', { baseURI: 'https://example.test/-/?v=0.9.0' });
  const fetchAsset = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  vi.stubGlobal('fetch', fetchAsset);
  const create = vi.fn(() => context.audioContext);
  const audio = new CityAudioSession({ ...preferences }, create, bundledMusic);
  sessions.push(audio);
  return { audio, context, create, fetchAsset };
}

describe('optional local audio loading lifecycle', () => {
  it('resumes in the gesture before fetching and confirms source readiness before playing', async () => {
    const { audio, context, create, fetchAsset } = assetSession();
    let complete!: (buffer: AudioBuffer) => void;
    context.decodeAudioData.mockImplementation(() => new Promise(done => { complete = done; }));
    audio.toggle();
    expect(create).toHaveBeenCalledTimes(1);
    expect(context.resume.mock.invocationCallOrder[0]).toBeLessThan(fetchAsset.mock.invocationCallOrder[0]);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.current.playback).toBe('starting');
    expect(context.sources).toHaveLength(0);
    audio.playCue({ kind: 'button' });
    expect(context.oscillators).toHaveLength(0);
    complete({ duration: 2, length: 16_000, numberOfChannels: 2 } as AudioBuffer);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.current.playback).toBe('playing');
    expect(context.sources.filter(source => source.loop)).toHaveLength(2);
    expect(context.oscillators).toHaveLength(0);
  });

  it('cancels pending decoding and never revives a retired context from the late result', async () => {
    const { audio, context, fetchAsset } = assetSession();
    let complete!: (buffer: AudioBuffer) => void;
    context.decodeAudioData.mockImplementation(() => new Promise(done => { complete = done; }));
    audio.toggle(); await vi.advanceTimersByTimeAsync(0);
    const signal = (fetchAsset.mock.calls[0] as unknown as [URL, { signal: AbortSignal }])[1].signal;
    audio.toggle();
    expect(signal.aborted).toBe(true);
    expect(context.close).toHaveBeenCalledTimes(1);
    complete({ duration: 2, length: 16_000, numberOfChannels: 2 } as AudioBuffer);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.current.playback).toBe('paused');
    expect(context.sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a loading start and retries only on a fresh explicit gesture', async () => {
    const stalled = new Context(), next = new Context();
    const { audio, create } = assetSession(stalled);
    create.mockReturnValueOnce(stalled.audioContext).mockReturnValueOnce(next.audioContext);
    let complete!: (buffer: AudioBuffer) => void;
    stalled.decodeAudioData.mockImplementation(() => new Promise(done => { complete = done; }));
    audio.toggle(); await vi.advanceTimersByTimeAsync(8_000);
    expect(audio.current.playback).toBe('error');
    expect(stalled.close).toHaveBeenCalledTimes(1);
    audio.recover(); expect(create).toHaveBeenCalledTimes(1);
    audio.toggle(); await vi.advanceTimersByTimeAsync(0);
    expect(audio.current.playback).toBe('playing');
    expect(create).toHaveBeenCalledTimes(2);
    complete({ duration: 2, length: 16_000, numberOfChannels: 2 } as AudioBuffer);
    await vi.advanceTimersByTimeAsync(0);
    expect(stalled.sources).toHaveLength(0);
    expect(audio.current.playback).toBe('playing');
  });

  it('reports failed decoding as a retry and reuses decoded loops through pause/visibility recovery', async () => {
    const { audio, context, create, fetchAsset } = assetSession();
    const replacement = new Context();
    create.mockReturnValueOnce(context.audioContext).mockReturnValueOnce(replacement.audioContext);
    context.decodeAudioData.mockRejectedValueOnce(new Error('Unsupported or corrupt file'));
    audio.toggle(); await vi.advanceTimersByTimeAsync(0);
    expect(audio.current).toMatchObject({ playback: 'error', error: expect.stringContaining('音源') });
    expect(context.sources).toHaveLength(0);
    audio.toggle(); await vi.advanceTimersByTimeAsync(0);
    expect(audio.current.playback).toBe('playing');
    const requests = fetchAsset.mock.calls.length;
    const loops = replacement.sources.length;
    audio.setVisible(false); await vi.advanceTimersByTimeAsync(0);
    expect(audio.current.playback).toBe('hidden');
    audio.setVisible(true); await vi.advanceTimersByTimeAsync(0);
    audio.toggle(); await vi.advanceTimersByTimeAsync(0);
    audio.toggle(); await vi.advanceTimersByTimeAsync(0);
    expect(audio.current.playback).toBe('playing');
    expect(fetchAsset).toHaveBeenCalledTimes(requests);
    expect(replacement.sources).toHaveLength(loops);
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('opt-in result and button feedback', () => {
  it('never starts audio for events and consumes silent/reduced-motion weekly reveals without replay', async () => {
    const { audio, context, create } = session();
    cueSubscriptions.push(subscribeCityAudioCues(cue => audio.playCue(cue)));
    const silent = { kind: 'weekly' as const, reportKey: 'silent-company:1', netProfit: 123 };
    emitCityAudioCue(silent); emitCityAudioCue({ kind: 'button' });
    expect(create).not.toHaveBeenCalled();
    audio.toggle(); await flush();
    const before = context.oscillators.length;
    emitCityAudioCue(silent);
    emitCityAudioCue({ kind: 'weekly', reportKey: 'reduced-company:1', netProfit: 123, reducedMotion: true });
    emitCityAudioCue({ kind: 'weekly', reportKey: 'reduced-company:1', netProfit: 123 });
    expect(context.oscillators).toHaveLength(before);
    emitCityAudioCue({ kind: 'weekly', reportKey: 'audible-company:1', netProfit: 123 });
    const after = context.oscillators.length;
    expect(after).toBeGreaterThan(before);
    emitCityAudioCue({ kind: 'weekly', reportKey: 'audible-company:1', netProfit: 123 });
    expect(context.oscillators).toHaveLength(after);
  });

  it('drops cues under mute, zero effects/master, hidden state and deliberate pause', async () => {
    const { audio, context } = session();
    audio.toggle(); await flush();
    for (const prefs of [{ ...preferences, muted: true }, { ...preferences, ambience: 0 }, { ...preferences, volume: 0 }]) {
      audio.setPreferences(prefs);
      const before = context.oscillators.length;
      audio.playCue({ kind: 'weekly', reportKey: 'gate:1', netProfit: 1 });
      expect(context.oscillators).toHaveLength(before);
    }
    audio.setPreferences(preferences);
    audio.setVisible(false); await flush();
    const hidden = context.oscillators.length;
    audio.playCue({ kind: 'button' }); expect(context.oscillators).toHaveLength(hidden);
    audio.setVisible(true); await flush();
    audio.playCue({ kind: 'button' });
    const feedback = context.oscillators.at(-1)!;
    audio.toggle(); await flush();
    expect(feedback.stop).toHaveBeenCalledTimes(2);
    expect(feedback.disconnect).toHaveBeenCalled();
    const paused = context.oscillators.length;
    audio.playCue({ kind: 'button' }); expect(context.oscillators).toHaveLength(paused);
  });

  it('uses restrained confirmation instead of a profit flourish for loss, zero and ended games', async () => {
    const { audio, context } = session();
    audio.toggle(); await flush();
    for (const result of [{ netProfit: -1 }, { netProfit: 0 }, { netProfit: 1, gameOver: true }]) {
      const before = context.oscillators.length;
      audio.playCue({ kind: 'weekly', reportKey: 'outcome:1', ...result });
      const added = context.oscillators.slice(before);
      expect(added).toHaveLength(1);
      expect(added[0].frequency.value).toBeLessThanOrEqual(440);
      context.currentTime += .4;
    }
  });

  it('discards feedback tails and their nodes on an OS interruption instead of replaying them on recovery', async () => {
    const { audio, context } = session();
    audio.toggle(); await flush();
    audio.playCue({ kind: 'button' });
    const voice = context.oscillators.at(-1)!;
    const gain = context.gains.at(-1)!;
    context.transition('interrupted');
    expect(voice.stop).toHaveBeenCalledTimes(2);
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
    expect(voice.onended).toBeNull();
    const before = context.oscillators.length;
    context.transition('suspended'); await flush();
    expect(audio.current.playback).toBe('playing');
    expect(context.oscillators).toHaveLength(before);
  });
});

describe('gesture-started café audio session', () => {
  it('does not autoplay and constructs/resumes synchronously in the first toggle', async () => {
    const { audio, context, create } = session();
    let resolve!: () => void;
    context.resumeBehavior = () => new Promise<void>(done => { resolve = done; });
    expect(create).not.toHaveBeenCalled();
    audio.toggle();
    expect(create).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(audio.current.playback).toBe('starting');
    // A resolved resume promise alone does not establish that Safari is running.
    resolve(); await flush();
    expect(audio.current.playback).toBe('interrupted');
    context.resumeBehavior = null;
    audio.toggle(); await flush();
    expect(audio.current.playback).toBe('playing');
    expect(create).toHaveBeenCalledTimes(1);
    expect(context.oscillators.length).toBeGreaterThan(0);
    expect(context.sources.some(source => source.loop)).toBe(true);
  });

  it('uses actual context state changes when Safari interrupts and returns to suspended', async () => {
    const { audio, context, create } = session();
    audio.toggle(); await flush();
    expect(audio.current.playback).toBe('playing');
    context.transition('interrupted');
    expect(audio.current.playback).toBe('interrupted');
    context.transition('suspended'); await flush();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(audio.current.playback).toBe('playing');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('leaves a visible retry after blocked automatic recovery and resumes from a tap', async () => {
    const { audio, context } = session();
    audio.toggle(); await flush();
    context.resumeBehavior = () => Promise.reject(new Error('Gesture required'));
    context.transition('interrupted'); context.transition('suspended'); await flush();
    expect(audio.current.playback).toBe('interrupted');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(context.resume).toHaveBeenCalledTimes(2);
    context.resumeBehavior = null;
    audio.toggle(); await flush();
    expect(audio.current.playback).toBe('playing');
    expect(context.resume).toHaveBeenCalledTimes(3);
  });

  it('pauses while hidden, resumes when visible, and keeps a deliberate pause through focus/visibility', async () => {
    const { audio, context, create } = session();
    audio.toggle(); await flush();
    audio.setVisible(false); await flush();
    expect(audio.current.playback).toBe('hidden'); expect(context.state).toBe('suspended');
    audio.setVisible(true); await flush();
    expect(audio.current.playback).toBe('playing');
    audio.toggle(); await flush();
    expect(audio.current.playback).toBe('paused');
    const resumes = context.resume.mock.calls.length;
    audio.recover(); audio.setVisible(false); audio.setVisible(true); await flush();
    expect(context.resume).toHaveBeenCalledTimes(resumes);
    expect(context.state).toBe('suspended'); expect(create).toHaveBeenCalledTimes(1);
  });

  it('preserves deliberate mute and independent mix across recovery', async () => {
    const { audio, context } = session();
    audio.setPreferences({ volume: .45, muted: true, music: 0, ambience: .8 });
    audio.toggle(); await flush();
    expect(context.gains[0].gain.value).toBe(0);
    expect(context.gains[1].gain.value).toBe(0);
    expect(context.gains[2].gain.value).toBe(.8);
    audio.setVisible(false); audio.setVisible(true); await flush();
    expect(context.gains[0].gain.value).toBe(0);
    expect(context.gains[1].gain.value).toBe(0);
    expect(context.gains[2].gain.value).toBe(.8);
    audio.setPreferences({ ...preferences });
    expect(context.gains[0].gain.value).toBeCloseTo(.6 ** 1.2);
    expect(audio.current.playback).toBe('playing');
  });

  it('cancels an unresolved start without allowing its late result to revive the graph', async () => {
    const { audio, context } = session();
    let resolve!: () => void;
    context.resumeBehavior = () => new Promise<void>(done => { resolve = done; });
    audio.toggle(); audio.toggle();
    expect(audio.current.playback).toBe('paused');
    expect(context.close).toHaveBeenCalledTimes(1);
    context.transition('running'); resolve(); await flush();
    expect(audio.current.playback).toBe('paused');
    expect(context.oscillators).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retires an unconfirmed start and creates a fresh context only on a new user tap', async () => {
    const stalled = new Context(), replacement = new Context();
    let resolve!: () => void;
    stalled.resumeBehavior = () => new Promise<void>(done => { resolve = done; });
    const create = vi.fn().mockReturnValueOnce(stalled.audioContext).mockReturnValueOnce(replacement.audioContext);
    const audio = new CityAudioSession({ ...preferences }, create); sessions.push(audio);
    audio.toggle(); await vi.advanceTimersByTimeAsync(8_000);
    expect(audio.current.playback).toBe('error'); expect(stalled.close).toHaveBeenCalledTimes(1);
    audio.recover(); audio.setVisible(false); audio.setVisible(true);
    expect(create).toHaveBeenCalledTimes(1);
    audio.toggle(); await flush();
    expect(audio.current.playback).toBe('playing'); expect(create).toHaveBeenCalledTimes(2);
    resolve(); await flush();
    expect(audio.current.playback).toBe('playing'); expect(stalled.oscillators).toHaveLength(0);
  });

  it('reports an externally closed context and retries on a new tap', async () => {
    const context = new Context(), next = new Context();
    const create = vi.fn().mockReturnValueOnce(context.audioContext).mockReturnValueOnce(next.audioContext);
    const audio = new CityAudioSession({ ...preferences }, create); sessions.push(audio);
    audio.toggle(); await flush(); context.transition('closed');
    expect(audio.current.playback).toBe('error');
    audio.toggle(); await flush();
    expect(audio.current.playback).toBe('playing'); expect(create).toHaveBeenCalledTimes(2);
  });

  it('closes a context if graph construction fails and keeps retry gesture-only', () => {
    const { audio, context, create } = session();
    context.createBuffer = () => { throw new Error('Allocation rejected'); };
    audio.toggle();
    expect(audio.current.playback).toBe('error'); expect(context.close).toHaveBeenCalledTimes(1);
    audio.recover();
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('one music and café graph', () => {
  it('reuses its room loop and scheduler on repeated resume and skips missed bars', async () => {
    const context = new Context(), audio = new CityAudioEngine(context.audioContext); engines.push(audio);
    audio.setVolume(.6, false); audio.setMix(.72, .9);
    await audio.setPlaying(true);
    const originalVoices = context.oscillators.length;
    await audio.setPlaying(true);
    expect(context.sources.filter(source => source.loop)).toHaveLength(1);
    expect(context.oscillators).toHaveLength(originalVoices);
    expect(vi.getTimerCount()).toBe(1);
    context.currentTime = 120;
    await vi.advanceTimersByTimeAsync(100);
    const later = context.oscillators.slice(originalVoices);
    expect(later.length).toBeGreaterThan(0);
    expect(later.length).toBeLessThan(24);
    for (const oscillator of later) expect(oscillator.start.mock.calls[0][0]).toBeGreaterThanOrEqual(119.9);
  });

  it('corrects a late resume after an explicit pause and disconnects every source on disposal', async () => {
    const context = new Context(), audio = new CityAudioEngine(context.audioContext); engines.push(audio);
    let resolve!: () => void;
    context.resumeBehavior = () => new Promise<void>(done => { resolve = done; });
    const pending = audio.setPlaying(true);
    await audio.setPlaying(false);
    context.transition('running'); resolve(); await pending;
    expect(context.state).toBe('suspended'); expect(audio.playing).toBe(false);
    context.resumeBehavior = null;
    await audio.setPlaying(true); await audio.dispose(); await audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    for (const source of [...context.sources, ...context.oscillators]) expect(source.disconnect).toHaveBeenCalled();
  });

  it('silences an explicit pause immediately even when context suspension is delayed', async () => {
    const context = new Context(), audio = new CityAudioEngine(context.audioContext); engines.push(audio);
    audio.setVolume(.6, false); audio.setMix(.72, .9);
    await audio.setPlaying(true);
    expect(context.gains[0].gain.value).toBeGreaterThan(0);
    context.suspend.mockImplementation(() => new Promise<void>(() => {}));
    void audio.setPlaying(false);
    expect(context.state).toBe('running');
    expect(context.gains[0].gain.value).toBe(0);
    audio.setVolume(.9, false);
    expect(context.gains[0].gain.value).toBe(0);
    expect(audio.playing).toBe(false);
  });
});

describe('Safari compatibility and saved sound preferences', () => {
  it('falls back to webkitAudioContext and requests optional media playback on a tap', () => {
    const Constructor = vi.fn(function () { return new Context().audioContext; });
    const media = { type: 'auto' };
    vi.stubGlobal('window', { webkitAudioContext: Constructor });
    vi.stubGlobal('navigator', { audioSession: media });
    createCityAudioContext();
    expect(Constructor).toHaveBeenCalledTimes(1); expect(media.type).toBe('playback');
  });

  it('keeps Web Audio usable when the optional Audio Session setting is rejected', () => {
    const Constructor = vi.fn(function () { return new Context().audioContext; });
    const media = { get type() { return 'auto'; }, set type(_value: string) { throw new Error('Unavailable'); } };
    vi.stubGlobal('window', { AudioContext: Constructor });
    vi.stubGlobal('navigator', { audioSession: media });
    expect(() => createCityAudioContext()).not.toThrow();
  });

  it('preserves old mute/volume preferences and safely fills new mix levels', () => {
    const getItem = vi.fn(() => JSON.stringify({ volume: .35, muted: true }));
    vi.stubGlobal('localStorage', { getItem });
    expect(readCityAudioPreferences()).toEqual({ volume: .35, muted: true, music: .72, ambience: .9 });
    expect(getItem).toHaveBeenCalledWith(CITY_AUDIO_STORAGE_KEY);
    getItem.mockReturnValue(JSON.stringify({ volume: 4, muted: false, music: -1, ambience: 'invalid' }));
    expect(readCityAudioPreferences()).toEqual({ volume: 1, muted: false, music: 0, ambience: .9 });
    getItem.mockReturnValue('bad JSON');
    expect(readCityAudioPreferences()).toEqual(preferences);
  });

  it('renders a discoverable one-tap start and distinguishes interruption from playback', () => {
    const markup = renderToStaticMarkup(createElement(CityAudioControl));
    expect(markup).toContain('aria-label="カフェの音を再生"'); expect(markup).toContain('音を入れる');
    expect(markup).not.toContain('<dialog');
    expect(cityAudioPresentation('interrupted', preferences)).toMatchObject({ active: false, label: 'カフェの音を再開', text: '音を再開' });
    expect(cityAudioPresentation('playing', { ...preferences, muted: true })).toMatchObject({ silent: true, text: '消音中', status: '再生中 · 消音' });
    expect(cityAudioPresentation('playing', { ...preferences, music: 0, ambience: 0 }).silent).toBe(true);
  });
});
