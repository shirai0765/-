import { CityAudioEngine } from './CityAudioEngine';
import { CityAudioAssetError } from './CityAudioAssets';
import type { CityAudioAssetConfig } from './CityAudioAssets';
import type { CityAudioCue } from './CityAudioCues';

export type CityAudioPlayback = 'paused' | 'starting' | 'playing' | 'hidden' | 'interrupted' | 'error';
export type CityAudioPreferences = { volume: number; muted: boolean; music: number; ambience: number };
export type CityAudioSnapshot = { playback: CityAudioPlayback; error: string };
export const CITY_AUDIO_STORAGE_KEY = 'shibuya-capital-city-audio-v1';
const START_TIMEOUT_MS = 8_000;
const clamp = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

export function readCityAudioPreferences(): CityAudioPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(CITY_AUDIO_STORAGE_KEY) ?? 'null');
    return { volume: clamp(value?.volume, .6), muted: value?.muted === true, music: clamp(value?.music, .72), ambience: clamp(value?.ambience, .9) };
  } catch { return { volume: .6, muted: false, music: .72, ambience: .9 }; }
}

/** Called only by a user's start gesture, including the older Safari constructor. */
export function createCityAudioContext(): AudioContext {
  const browser = window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
  if (!Constructor) throw new Error('Web Audio unavailable');
  // Supporting iPhones can treat the opted-in sound as media playback. This is
  // optional; other browsers still use the same Web Audio graph.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  try { if (session) session.type = 'playback'; } catch { /* Optional browser API. */ }
  return new Constructor();
}

/** Owns one graph, the user's intent, and browser interruption/recovery separately. */
export class CityAudioSession {
  private engine: CityAudioEngine | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly listeners = new Set<(snapshot: CityAudioSnapshot) => void>();
  private snapshot: CityAudioSnapshot = { playback: 'paused', error: '' };
  private wanted = false;
  private visible = true;
  private disposed = false;
  private revision = 0;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private recovered = false;

  constructor(private preferences: CityAudioPreferences, private readonly createContext = createCityAudioContext, private readonly assets?: CityAudioAssetConfig) {}

  get current() { return this.snapshot; }

  subscribe(listener: (snapshot: CityAudioSnapshot) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  setPreferences(preferences: CityAudioPreferences) {
    this.preferences = preferences;
    this.engine?.setVolume(preferences.volume, preferences.muted);
    this.engine?.setMix(preferences.music, preferences.ambience);
  }

  playCue(cue: CityAudioCue) {
    if (!this.disposed && this.wanted && this.visible && this.snapshot.playback === 'playing') this.engine?.playCue(cue);
  }

  /** Call directly from the UI event; context construction and resume stay in that gesture. */
  toggle() {
    if (this.disposed) return;
    const pause = this.wanted && ['starting', 'playing', 'hidden'].includes(this.snapshot.playback);
    this.wanted = !pause;
    this.recovered = false;
    if (pause && this.snapshot.playback === 'starting') {
      this.revision++; this.clearTimeout(); this.retire();
      this.publish('paused');
      return;
    }
    if (this.wanted && !this.engine) {
      let context: AudioContext | null = null;
      try {
        context = this.createContext();
        const active = new CityAudioEngine(context, this.assets);
        this.engine = active;
        this.unsubscribe = active.subscribe(() => this.contextChanged(active));
        this.setPreferences(this.preferences);
      } catch {
        if (context && !this.engine && context.state !== 'closed') void context.close().catch(() => { /* Failed graph construction. */ });
        this.retire(); this.publish('error', 'このブラウザでは音を開始できませんでした。');
        return;
      }
    }
    this.sync();
  }

  setVisible(visible: boolean) {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    this.recovered = false;
    this.sync();
  }

  /** Focus/pageshow retry an already unlocked context, never create a new one. */
  recover() {
    if (this.wanted && this.visible && this.engine && !this.engine.playing && this.snapshot.playback !== 'starting') this.sync();
  }

  private sync() {
    const active = this.engine;
    if (this.disposed || !active) return;
    const ticket = ++this.revision;
    this.clearTimeout();
    const shouldPlay = this.wanted && this.visible;
    this.publish(this.wanted ? shouldPlay ? 'starting' : 'hidden' : 'paused');
    if (shouldPlay) this.timeout = setTimeout(() => {
      if (ticket !== this.revision || this.engine !== active) return;
      this.revision++; this.clearTimeout(); this.retire();
      this.publish('error', '音の開始を確認できませんでした。「音を再試行」を押してください。');
    }, START_TIMEOUT_MS);
    // setPlaying calls resume synchronously here, before returning its promise.
    void active.setPlaying(shouldPlay).then(() => {
      if (this.disposed || ticket !== this.revision || this.engine !== active) return;
      this.clearTimeout();
      if (shouldPlay && this.wanted && this.visible) {
        if (active.playing) this.publish('playing');
        else this.publish('interrupted', '音が休止しています。「音を再開」を押してください。');
      }
    }).catch((error: unknown) => {
      if (this.disposed || ticket !== this.revision || this.engine !== active) return;
      this.clearTimeout();
      if (!shouldPlay) return;
      if (error instanceof CityAudioAssetError) {
        this.retire(); this.publish('error', '音源を読み込めませんでした。「音を再試行」を押してください。');
      } else if (active.state === 'closed') {
        this.retire(); this.publish('error', '音を再開できませんでした。「音を再試行」を押してください。');
      } else this.publish('interrupted', '音が休止しています。「音を再開」を押してください。');
    });
  }

  private contextChanged(active: CityAudioEngine) {
    if (this.disposed || this.engine !== active) return;
    if (!this.wanted) { this.publish('paused'); return; }
    if (!this.visible) { this.publish('hidden'); return; }
    if (active.state === 'closed') {
      this.revision++; this.clearTimeout(); this.retire();
      this.publish('error', '音が終了しました。「音を再試行」を押してください。');
    } else if (active.playing) {
      this.recovered = false; this.clearTimeout(); this.publish('playing');
    } else if (active.state === 'interrupted') {
      this.recovered = false; this.clearTimeout();
      this.publish('interrupted', '音が休止しています。「音を再開」を押してください。');
    } else if (this.snapshot.playback !== 'starting') {
      this.publish('interrupted', '音が休止しています。「音を再開」を押してください。');
      // Safari can end a call by moving interrupted -> suspended. Retry once;
      // if gesture permission is needed, leave the visible resume action available.
      if (!this.recovered) { this.recovered = true; this.sync(); }
    }
  }

  private publish(playback: CityAudioPlayback, error = '') {
    this.snapshot = { playback, error };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private clearTimeout() { if (this.timeout !== null) clearTimeout(this.timeout); this.timeout = null; }

  private retire() {
    this.unsubscribe?.(); this.unsubscribe = null;
    const active = this.engine; this.engine = null;
    void active?.dispose().catch(() => { /* The browser may already have closed it. */ });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.wanted = false; this.revision++;
    this.clearTimeout(); this.retire(); this.listeners.clear();
  }
}
