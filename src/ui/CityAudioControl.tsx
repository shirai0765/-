import { useEffect, useId, useRef, useState } from 'react';
import GameDialog from './GameDialog';
import { GameIcon } from './GameIcon';
import { CITY_AUDIO_STORAGE_KEY, CityAudioSession, readCityAudioPreferences } from '../audio/CityAudioSession';
import { CITY_AUDIO_ASSETS } from '../audio/CityAudioAssets';
import { subscribeCityAudioCues } from '../audio/CityAudioCues';
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
    const active = new CityAudioSession(latestPreferences.current, undefined, CITY_AUDIO_ASSETS);
    session.current = active;
    active.subscribe(setSnapshot);
    const unsubscribeCues = subscribeCityAudioCues(cue => active.playCue(cue));
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
      unsubscribeCues();
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
        <GameIcon name={snapshot.playback === 'playing' ? 'volume' : 'coffee'} size={20} tone={presentation.silent ? 'muted' : undefined}/><span className="city-audio-label-wide">{presentation.text}</span><span className="city-audio-label-compact" aria-hidden="true">{compactText}</span>
      </button>
      <button type="button" className="hud-button city-audio-settings" onClick={() => setExpanded(true)} aria-label="街のBGMを設定" title="音量・BGM・店内音の設定" aria-haspopup="dialog"><GameIcon name="settings" size={20}/></button>
      <span id={statusId} className="city-audio-hud-status" role="status">{presentation.status}</span>
    </div>
    {expanded && <GameDialog title="カフェの音とBGM" close={() => setExpanded(false)}><section className="city-audio-control" aria-label="カフェの音とBGM">
      <div className="city-audio-title"><GameIcon name="coffee" size={27} tone="gold"/><div><strong>カフェの音と、週のひと区切り</strong><small role="status">{presentation.status}</small></div></div>
      <div className="city-audio-actions">
        <button type="button" className="secondary" onClick={toggle} aria-label={presentation.label}><GameIcon name={presentation.active ? 'pause' : 'play'} size={20}/> {snapshot.playback === 'starting' ? '開始をキャンセル' : presentation.active ? '一時停止' : snapshot.playback === 'interrupted' ? '音を再開' : snapshot.playback === 'error' ? '音を再試行' : '音を入れる'}</button>
        <button type="button" className="secondary city-audio-mute" onClick={() => setPreferences(value => ({ ...value, muted: !value.muted }))} aria-label={preferences.muted ? '音の消音を解除' : '音を消音'} aria-pressed={preferences.muted}><GameIcon name="volume" size={20} tone={preferences.muted ? 'muted' : undefined}/><span>{preferences.muted ? '消音を解除' : '消音'}</span></button>
      </div>
      <div className="city-audio-master">{volume('volume', '音量')}</div>
      <div className="city-audio-mix"><div><GameIcon name="volume" size={21}/>{volume('music', 'BGM')}</div><div><GameIcon name="coffee" size={21}/>{volume('ambience', '店内音')}</div></div>
      <p className="city-audio-note">BGMと店内音は個別に調整できます。効果音も店内音の設定に従います。</p>
      {snapshot.error && <p className="city-audio-error" role="status">{snapshot.error}</p>}
    </section></GameDialog>}
  </>;
}
