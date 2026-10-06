import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../model';
import { scheduleScene } from '../city/sceneLifecycle';
import { createRealCityScene } from '../realcity/RealCityScene';
import type { RealCityProgress } from '../realcity/RealCityScene';
import { getRealCitySites } from '../realcity/gameSites';
import type { TextureQuality } from '../realcity/textureBudget';
import { DEFAULT_PHOTO_GAIN } from '../realcity/photoAppearance';
import './real-city-view.css';

interface Props {
  state: GameState;
  selectedLotId: string | null;
  focusLotId: string | null;
  focusRequestId: number;
  onSelectLot: (lotId: string) => void;
  onFallback: () => void;
  onOverview?: () => void;
  onDisposing?: (done: Promise<void>) => void;
}

type SceneController = ReturnType<typeof createRealCityScene>;
type FocusState = { lotId: string | null; status: 'idle' | 'queued' | 'focused' | 'unknown' };
const statusLabels = { empty: '未出店', store: 'カフェ営業中', property: '物件保有', both: 'カフェ・物件保有' };
// DEV only: bounded readers let QA observe whether disposed instances keep rendering.
const retiredDiagnostics: (() => unknown)[] = [];
const development = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

/** Only presentation state lives here. All business selections and actions belong to App. */
export function RealCityView(props: Props) {
  const { state, selectedLotId, focusLotId, focusRequestId } = props;
  const sites = useMemo(() => getRealCitySites(state, selectedLotId), [state, selectedLotId]);
  const latest = useRef({ props, sites });
  latest.current = { props, sites };
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const displayMenu = useRef<HTMLDivElement>(null);
  const displayButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [brightness, setBrightness] = useState(DEFAULT_PHOTO_GAIN);
  const [viewRequest, setViewRequest] = useState<{ preset: 'crossing' | '109' | 'overhead' } | null>(null);
  const [quality, setQuality] = useState<TextureQuality>('1024');
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const [progress, setProgress] = useState<RealCityProgress>({ status: 'loading', quality: '1024', buildingTiles: 0, groundTiles: 0, generation: 0 });
  const [failed, setFailed] = useState(false);
  const [focus, setFocus] = useState<FocusState>({ lotId: null, status: 'idle' });
  const selectedSite = sites.find(site => site.lotId === selectedLotId);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !displayMenu.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      displayButton.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    const retire = scheduleScene(() => {
      if (!active || !host.current) return () => {};
      const instance = createRealCityScene(host.current, {
        textureQuality: qualityRef.current,
        onSelectLot: id => { if (active) latest.current.props.onSelectLot(id); },
        onProgress: next => {
          if (!active) return;
          setProgress({ ...next });
          if (next.status === 'failed') setFailed(true);
          if (next.status === 'ready') {
            setFailed(false);
            controller.current?.updateSites(latest.current.sites);
          }
        },
        onError: () => { if (active) setFailed(true); },
        onFocusChange: next => {
          if (active) setFocus({ lotId: next.lotId, status: next.status === 'cleared' ? 'idle' : next.status });
        },
      });
      controller.current = instance;
      let observer: ResizeObserver | null = null;
      let disposal: Promise<void> | null = null;
      const resize = () => {
        const bounds = host.current?.getBoundingClientRect();
        if (bounds) instance.resize(bounds.width, bounds.height);
      };
      const dispose = () => {
        observer?.disconnect();
        window.removeEventListener('resize', resize);
        if (controller.current === instance) controller.current = null;
        if (!disposal) {
          disposal = instance.dispose();
          if (development) {
            retiredDiagnostics.push(() => instance.getDiagnostics());
            if (retiredDiagnostics.length > 12) retiredDiagnostics.splice(0, retiredDiagnostics.length - 12);
          }
        }
        return disposal;
      };
      try {
        instance.updateSites(latest.current.sites);
        observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
        observer?.observe(host.current);
        if (!observer) window.addEventListener('resize', resize);
        resize();
        setRuntimeReady(value => value + 1);
        if (development) {
          const debugWindow = window as unknown as { __realCityIntegrationQA?: { snapshot: () => unknown } };
          debugWindow.__realCityIntegrationQA = {
            snapshot: () => ({ current: controller.current?.getDiagnostics() ?? null, retired: retiredDiagnostics.map(read => read()) }),
          };
        }
      } catch {
        if (active) setFailed(true);
        // Keep the lease until the partially initialized instance has fully retired.
        void dispose().catch(() => {});
      }
      return dispose;
    }, () => { if (active) setFailed(true); });
    return () => {
      active = false;
      const done = retire();
      latest.current.props.onDisposing?.(done);
    };
  }, [attempt]);

  useEffect(() => { controller.current?.updateSites(sites); }, [sites, runtimeReady]);

  useEffect(() => {
    const instance = controller.current;
    if (!instance) return;
    if (!selectedLotId || !focusLotId || selectedLotId !== focusLotId) {
      instance.overview();
      setFocus({ lotId: null, status: 'idle' });
      return;
    }
    const status = instance.focusLot(focusLotId);
    setFocus({ lotId: focusLotId, status });
  }, [selectedLotId, focusLotId, focusRequestId, runtimeReady]);

  useEffect(() => { controller.current?.setExposure(brightness); }, [brightness, runtimeReady]);
  // Run after the focus effect so clearing the app selection cannot overwrite a preset.
  useEffect(() => {
    if (viewRequest) controller.current?.setPreset(viewRequest.preset);
  }, [viewRequest]);

  const changeQuality = (next: TextureQuality) => {
    qualityRef.current = next;
    setQuality(next);
    if (controller.current) {
      setFailed(false);
      controller.current.setQuality(next);
    } else if (failed) {
      setFailed(false);
      setAttempt(value => value + 1);
    }
  };
  const retry = () => {
    if (controller.current) {
      setFailed(false);
      controller.current.setQuality(qualityRef.current);
    } else {
      setFailed(false);
      setProgress({ status: 'loading', quality: qualityRef.current, buildingTiles: 0, groundTiles: 0, generation: 0 });
      setAttempt(value => value + 1);
    }
  };
  const changeView = (preset: 'crossing' | '109' | 'overhead') => {
    latest.current.props.onOverview?.();
    setViewRequest({ preset });
    setFocus({ lotId: null, status: 'idle' });
  };
  const displayStatus = failed ? 'failed' : progress.status;
  const loadingLabel = progress.buildingTiles < 20
    ? `建物 ${progress.buildingTiles} / 20 を読み込み中`
    : `街路写真 ${progress.groundTiles} / 72 を読み込み中`;

  return <section className="real-city-view" aria-label="実測の渋谷とゲーム内地点"
    data-status={displayStatus} data-selected-lot={selectedLotId ?? ''}
    data-focus-lot={focus.lotId ?? ''} data-focus-status={focus.status}>
    <div className="real-city-view-canvas" ref={host} />
    <div className="real-city-view-menu" ref={displayMenu}>
      <button className="real-city-view-menu-toggle" type="button" ref={displayButton}
        aria-expanded={menuOpen} aria-controls="real-city-display-options"
        onClick={() => setMenuOpen(value => !value)}>街の表示 <span aria-hidden="true">{menuOpen ? '−' : '+'}</span></button>
      {menuOpen && <div className="real-city-view-options" id="real-city-display-options" role="region" aria-label="街の表示設定">
      <div className="real-city-view-controls">
        <label>建物写真の精細さ<select value={quality} onChange={event => changeQuality(event.target.value as TextureQuality)}>
          <option value="1024">軽量・1024</option><option value="2048">高精細・2048</option>
        </select></label>
        <label>建物写真の明るさ<input type="range" min="1" max="1.8" step="0.05" value={brightness}
          onChange={event => setBrightness(Number(event.target.value))} /></label>
        <div className="real-city-view-presets" aria-label="視点を選ぶ">
          <button type="button" onClick={() => changeView('crossing')}>交差点</button>
          <button type="button" onClick={() => changeView('109')}>109前</button>
          <button type="button" onClick={() => changeView('overhead')}>実測街の全景</button>
        </div>
        <button type="button" onClick={() => latest.current.props.onFallback()}>ゲーム街で続ける</button>
      </div>
      <h3 className="real-city-view-sites-heading">地点を選ぶ</h3>
      <nav className="real-city-view-sites" aria-label="実測街のゲーム内地点">
        {sites.map(site => <button key={site.lotId} type="button" aria-pressed={site.selected}
          onClick={() => { setMenuOpen(false); latest.current.props.onSelectLot(site.lotId); }} title={`${site.label} · ${statusLabels[site.status]}`}>
          <span>{site.label}</span><small>{statusLabels[site.status]}</small>
        </button>)}
      </nav>
      {selectedSite && <p className="real-city-view-selected">選択：<strong>{selectedSite.label}</strong>
        {focus.status === 'queued' && <span> · 地点への移動を準備中</span>}</p>}
      {(focus.status === 'unknown' || (selectedLotId && !selectedSite)) && <p className="real-city-view-selected">この地点はゲーム街で表示できます。</p>}
      <details className="real-city-view-attribution"><summary>出典・表示について</summary>
        <p>実測の渋谷に架空の経営を重ねています。実測街では{sites.length}地点に対応しています。</p>
        <p>地点・賃料・売買価格・人流はゲーム設定です。実際の募集物件ではありません。全32地点の経営はゲーム街と一覧から続けられます。</p>
        <p>軽量表示は画像メモリを抑えます。建物データの通信量が減る設定ではありません。地表は平面近似で、高低差と実際の入口は再現していません。</p>
        <p>建物：<a href="https://www.mlit.go.jp/plateau/opendata/" target="_blank" rel="noreferrer">東京都・国土交通省 Project PLATEAU</a>（2025年度公開）。地表：<a href="https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto" target="_blank" rel="noreferrer">地理院タイル</a>。写真の撮影時期は場所により異なります。</p>
      </details>
      </div>}
    </div>
    {displayStatus !== 'ready' && <div className="real-city-view-progress" role={failed ? 'alert' : 'status'}>
      {failed ? <><span>街を表示できませんでした。</span>
        <button type="button" onClick={retry}>再試行</button>
        <button type="button" onClick={() => latest.current.props.onFallback()}>ゲーム街へ</button></>
        : <span>{loadingLabel}</span>}
    </div>}
  </section>;
}
