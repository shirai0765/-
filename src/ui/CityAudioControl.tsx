import { useEffect, useId, useRef, useState } from 'react';
import { Coffee, Music2, Pause, Play, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import GameDialog from './GameDialog';
import { CITY_AUDIO_STORAGE_KEY, CityAudioSession, readCityAudioPreferences } from '../audio/CityAudioSession';
import type { CityAudioPlayback, CityAudioPreferences, CityAudioSnapshot } from '../audio/CityAudioSession';
import './city-audio-control.css';

export function cityAudioPresentation(playback: CityAudioPlayback, preferences: CityAudioPreferences) {
  const silent = preferences.muted || preferences.volume === 0 || (preferences.music === 0 && preferences.ambience === 0);
  const active = playback === 'playing' || playback === 'starting' || playback === 'hidden';
  const label = playback === 'starting' ? '音の開始をキャンセル'
    : active ? 'カフェの音を一時停止'
    : playback === 'interrupted' ? 'カフェの音を再開'
    : playback === 'error' ? 'カフェの音を再試行' : 'カフェの音を再生';
  const text = playback === 'starting' ? '開始中…' : playback === 'hidden' ? '音を休止中'
    : playback === 'interrupted' ? '音を再開' : playback === 'error' ? '音を再試行'
    : playback === 'playing' ? silent ? '消音中' : '音あり' : silent ? '消音設定' : '音を入れる';
  const status = playback === 'starting' ? '音を開始しています…'
    : playback === 'hidden' ? '画面を離れている間は一時停止'
    : playback === 'interrupted' ? '音が休止中です。音を再開できます。'
    : playback === 'error' ? '音を開始できませんでした。再試行できます。'
    : playback === 'playing' ? silent ? '再生中 · 消音' : preferences.music === 0 ? '店内音を再生中' : preferences.ambience === 0 ? 'BGMを再生中' : '店内音とBGMを再生中'
    : silent ? '消音設定中。設定から音量・消音を変更できます。' : 'ワンタップで店内音とBGMを開始';
  return { active, silent, label, text, status };
}

/** Playback is opt-in each mount. Sound preferences stay outside company saves. */
export default function CityAudioControl({ className = '' }: { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [preferences, setPreferences] = useState(readCityAudioPreferences);
  const [snapshot, setSnapshot] = useState<CityAudioSnapshot>({ playback: 'paused', error: '' });
  const session = useRef<CityAudioSession | null>(null);
  const latestPreferences = useRef(preferences);
  latestPreferences.current = preferences;
  const statusId = useId();
  const presentation = cityAudioPresentation(snapshot.playback, preferences);
  const compactText = snapshot.playback === 'starting' ? '開始中' : snapshot.playback === 'hidden' ? '休止中'
    : snapshot.playback === 'interrupted' ? '音再開' : snapshot.playback === 'error' ? '再試行'
    : snapshot.playback === 'playing' ? presentation.silent ? '消音中' : '音あり' : presentation.silent ? '消音中' : '音なし';

  useEffect(() => {
    try { localStorage.setItem(CITY_AUDIO_STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Sound still works without storage. */ }
    session.current?.setPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const active = new CityAudioSession(latestPreferences.current);
    session.current = active;
    active.subscribe(setSnapshot);
    active.setVisible(!document.hidden);
    const visibility = () => active.setVisible(!document.hidden);
    const pagehide = () => active.setVisible(false);
    const pageshow = () => { active.setVisible(!document.hidden); active.recover(); };
    const focus = () => { if (!document.hidden) active.recover(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      window.removeEventListener('focus', focus);
      if (session.current === active) session.current = null;
      active.dispose();
    };
  }, []);

  // Context construction and resume occur in this click, before any effect/await.
  const toggle = () => session.current?.toggle();
  const volume = (key: 'volume' | 'music' | 'ambience', label: string) => <label className="city-audio-volume">{label}<span>{Math.round(preferences[key] * 100)}%</span><input type="range" aria-label={label} min="0" max="100" step="1" value={Math.round(preferences[key] * 100)} onChange={event => setPreferences(value => ({ ...value, [key]: Number(event.target.value) / 100 }))}/></label>;

  return <>
    <div className={`city-audio-hud ${className}`}>
      <button type="button" className={`hud-button city-audio-start ${snapshot.playback === 'playing' && !presentation.silent ? 'city-audio-on' : ''}`} onClick={toggle} aria-label={presentation.label} aria-pressed={presentation.active} aria-describedby={statusId} title={snapshot.error || presentation.status}>
        {snapshot.playback === 'playing' ? presentation.silent ? <VolumeX size={18} aria-hidden="true"/> : <Volume2 size={18} aria-hidden="true"/> : <Coffee size={18} aria-hidden="true"/>}<span className="city-audio-label-wide">{presentation.text}</span><span className="city-audio-label-compact" aria-hidden="true">{compactText}</span>
      </button>
      <button type="button" className="hud-button city-audio-settings" onClick={() => setExpanded(true)} aria-label="街のBGMを設定" title="音量・BGM・店内音の設定" aria-haspopup="dialog"><SlidersHorizontal size={17} aria-hidden="true"/></button>
      <span id={statusId} className="city-audio-hud-status" role="status">{presentation.status}</span>
    </div>
    {expanded && <GameDialog title="カフェの音とBGM" close={() => setExpanded(false)}><section className="city-audio-control" aria-label="カフェの音とBGM">
      <div className="city-audio-title"><Coffee size={21} aria-hidden="true"/><div><strong>カップの音、コーヒー、静かな旋律</strong><small role="status">{presentation.status}</small></div></div>
      <div className="city-audio-actions">
        <button type="button" className="secondary" onClick={toggle} aria-label={presentation.label}>{presentation.active ? <Pause size={16} aria-hidden="true"/> : <Play size={16} aria-hidden="true"/>} {snapshot.playback === 'starting' ? '開始をキャンセル' : presentation.active ? '一時停止' : snapshot.playback === 'interrupted' ? '音を再開' : snapshot.playback === 'error' ? '音を再試行' : '音を入れる'}</button>
        <button type="button" className="secondary city-audio-mute" onClick={() => setPreferences(value => ({ ...value, muted: !value.muted }))} aria-label={preferences.muted ? 'BGMの消音を解除' : 'BGMを消音'} aria-pressed={preferences.muted}>{preferences.muted ? <VolumeX size={17} aria-hidden="true"/> : <Volume2 size={17} aria-hidden="true"/>}<span>{preferences.muted ? '消音を解除' : '消音'}</span></button>
      </div>
      <div className="city-audio-master">{volume('volume', '音量')}</div>
      <div className="city-audio-mix"><div><Music2 size={17} aria-hidden="true"/>{volume('music', 'BGM')}</div><div><Coffee size={17} aria-hidden="true"/>{volume('ambience', '店内音')}</div></div>
      <p className="city-audio-note">BGMと店内音は個別に調整できます。音量0でその音を止めます。</p>
      {snapshot.error && <p className="city-audio-error" role="status">{snapshot.error}</p>}
    </section></GameDialog>}
  </>;
}
