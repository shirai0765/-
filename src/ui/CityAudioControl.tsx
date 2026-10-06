import { useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import GameDialog from './GameDialog';
import { CityAudioEngine } from '../audio/CityAudioEngine';
import './city-audio-control.css';

const STORAGE_KEY = 'shibuya-capital-city-audio-v1';
const START_TIMEOUT_MS = 8_000;
type Preferences = { volume: number; muted: boolean };
type Playback = 'paused' | 'starting' | 'playing' | 'hidden';
function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return { volume: typeof value?.volume === 'number' && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : .35, muted: value?.muted === true };
  } catch { return { volume: .35, muted: false }; }
}

/** Playback is opt-in each mount. Only mute/volume persist, outside company saves. */
export default function CityAudioControl({ className = '' }: { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [preferences, setPreferences] = useState(readPreferences);
  const [playback, setPlayback] = useState<Playback>('paused');
  const [error, setError] = useState('');
  const engine = useRef<CityAudioEngine | null>(null);
  const wanted = useRef(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  const startTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starting = useRef(false);

  const clearStartTimeout = () => {
    if (startTimeout.current !== null) clearTimeout(startTimeout.current);
    startTimeout.current = null;
  };
  const retire = (active: CityAudioEngine) => {
    if (engine.current === active) engine.current = null;
    // Disposal disconnects sound and invalidates an unresolved resume immediately.
    void active.dispose().catch(() => { /* The browser may already have closed the context. */ });
  };
  const failPlayback = (active: CityAudioEngine, ticket: number, message: string) => {
    if (!mounted.current || ticket !== revision.current || engine.current !== active) return;
    revision.current++; clearStartTimeout(); starting.current = false;
    wanted.current = false; setPlayback('paused'); setError(message);
    retire(active);
  };
  const syncPlayback = (active: CityAudioEngine) => {
    const ticket = ++revision.current;
    clearStartTimeout();
    const shouldPlay = wanted.current && !document.hidden;
    starting.current = shouldPlay;
    setPlayback(wanted.current ? shouldPlay ? 'starting' : 'hidden' : 'paused');
    if (shouldPlay) startTimeout.current = setTimeout(() => {
      failPlayback(active, ticket, '音楽の開始を確認できませんでした。再生ボタンで再試行できます。');
    }, START_TIMEOUT_MS);
    void active.setPlaying(shouldPlay).then(() => {
      if (!mounted.current || ticket !== revision.current || engine.current !== active) return;
      clearStartTimeout(); starting.current = false;
      // The engine resolves a start only after the context is running.
      if (shouldPlay && wanted.current && !document.hidden) setPlayback('playing');
    }).catch(() => {
      failPlayback(active, ticket, '音楽を再生できませんでした。再生ボタンで再試行できます。');
    });
  };

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Playback still works without storage. */ }
    engine.current?.setVolume(preferences.volume, preferences.muted);
  }, [preferences]);

  useEffect(() => {
    mounted.current = true;
    const visibility = () => {
      const active = engine.current;
      if (!active) return;
      // A hidden tab pauses sound but preserves the user's playback request.
      syncPlayback(active);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false; wanted.current = false; revision.current++;
      clearStartTimeout(); starting.current = false;
      document.removeEventListener('visibilitychange', visibility);
      const active = engine.current; engine.current = null;
      void active?.dispose().catch(() => { /* The browser may already have closed the context. */ });
    };
  }, []);

  const toggle = () => {
    const next = !wanted.current;
    wanted.current = next; setError('');
    if (!next && starting.current && engine.current) {
      revision.current++; clearStartTimeout(); starting.current = false;
      setPlayback('paused'); retire(engine.current);
      return;
    }
    try {
      if (!engine.current && next) {
        if (typeof AudioContext === 'undefined') throw new Error('Web Audio unavailable');
        engine.current = new CityAudioEngine(new AudioContext());
        engine.current.setVolume(preferences.volume, preferences.muted);
      }
      if (engine.current) syncPlayback(engine.current);
    } catch {
      revision.current++; clearStartTimeout(); starting.current = false;
      wanted.current = false; setPlayback('paused'); setError('この環境では音楽を開始できませんでした。');
      if (engine.current) retire(engine.current);
    }
  };

  return <>
    <button type="button" className={`hud-button ${className}`} onClick={() => setExpanded(true)} aria-label="街のBGMを設定" aria-haspopup="dialog"><Music2 size={18} aria-hidden="true"/><span>音楽</span></button>
    {expanded && <GameDialog title="街のBGM" close={() => setExpanded(false)}><section className="city-audio-control" aria-label="街のBGM">
    <div className="city-audio-title"><Music2 size={18} aria-hidden="true"/><div><strong>街のBGM</strong><small role="status">{playback === 'starting' ? '音楽を開始しています…' : playback === 'hidden' ? 'タブ非表示中は一時停止' : playback === 'playing' ? preferences.muted || preferences.volume === 0 ? '再生中 · 消音' : '静かな街の旋律' : '再生ボタンで音楽を開始'}</small></div></div>
    <div className="city-audio-actions">
      <button type="button" className="secondary" onClick={toggle} aria-label={playback === 'starting' ? 'BGMの開始をキャンセル' : playback !== 'paused' ? 'BGMを一時停止' : 'BGMを再生'}>{playback !== 'paused' ? <Pause size={16}/> : <Play size={16}/>} {playback === 'starting' ? '開始をキャンセル' : playback !== 'paused' ? '一時停止' : '再生'}</button>
      <button type="button" className="secondary city-audio-mute" onClick={() => setPreferences(value => ({ ...value, muted: !value.muted }))} aria-label={preferences.muted ? 'BGMの消音を解除' : 'BGMを消音'} aria-pressed={preferences.muted}>{preferences.muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
      <label className="city-audio-volume">音量 <span>{Math.round(preferences.volume * 100)}%</span><input type="range" min="0" max="100" step="1" value={Math.round(preferences.volume * 100)} onChange={event => setPreferences(value => ({ ...value, volume: Number(event.target.value) / 100 }))}/></label>
    </div>
    {error && <p className="city-audio-error" role="status">{error}</p>}
    </section></GameDialog>}
  </>;
}
