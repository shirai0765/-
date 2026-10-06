import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2, ChevronRight, Coffee, Landmark, Layers, MapPin, Menu, Palette, Flag, Settings, TrendingUp, HelpCircle, ReceiptText, X } from 'lucide-react';
import CityView from './city/CityView';
import { RealCityView } from './ui/RealCityView';
import SiteBrowser from './ui/SiteBrowser';
import { hasRealCityAnchor } from './realcity/gameSites';
import './ui/business-map.css';
import Modal, { GameNoticeContext } from './ui/GameDialog';
import { createGame, applyAction, getWeekOutlook, advanceWeek, getSummary, operatingConditions } from './sim/engine';
import { LOTS, ACQUISITION_TARGETS } from './data/district';
import MarketPanel from './ui/MarketPanel';
import DealsPanel from './ui/DealsPanel';
import DesignPanel, { type DesignChoice } from './ui/DesignPanel';
import DevelopmentPanel from './ui/DevelopmentPanel';
import ProgressionPanel from './ui/ProgressionPanel';
import StoreOpeningPanel from './ui/StoreOpeningPanel';
import OpeningResults from './ui/OpeningResults';
import StoreManagementPanel from './ui/StoreManagementPanel';
import WeeklyResults from './ui/WeeklyResults';
import FirstPlayGuide from './ui/FirstPlayGuide';
import CityAudioControl from './ui/CityAudioControl';
import CapitalPlanningPanel, { type CapitalPlanningDraft } from './ui/CapitalPlanningPanel';
import RailProjectsPanel from './ui/RailProjectsPanel';
import GrowthMilestonePanel from './ui/GrowthMilestonePanel';
import { getInvestmentMemo, type InvestmentIntent, type InvestmentVisit, type InvestmentMemo } from './ui/investmentPlanning';
import { runManagedWeeks } from './sim/managedWeeks';
import { loadGame, saveGame, exportGame, importGame, listBackups, restoreBackup } from './persistence';
import type { GameState, GameAction, StoreStyle, DistrictId } from './model';

type Page = 'city' | 'stores' | 'finance' | 'stocks' | 'group' | 'history' | 'deals' | 'progression' | 'development';
const money = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');
const rangeMoney = (range: {min:number;max:number}) => `${compact(Math.floor(range.min/1000)*1000)} 〜 ${compact(Math.ceil(range.max/1000)*1000)}`;
const compact = (n: number) => Math.abs(n) >= 100000000 ? `${(n / 100000000).toFixed(2)}億円` : Math.abs(n) >= 10000 ? `${(n / 10000).toFixed(1)}万円` : money(n);
const styles: Record<StoreStyle, string> = { standard: '街角カフェ', premium: 'プレミアム', takeaway: 'テイクアウト' };
const districtNames: Record<string,string> = { center: '渋谷駅前', dogenzaka: '道玄坂', miyashita: '宮下公園', sakuragaoka: '桜丘' };
function Metric({ label, value, note, good }: { label: string; value: ReactNode; note?: string; good?: boolean }) { return <div className="metric"><span>{label}</span><strong className={good === true ? 'positive' : good === false ? 'negative' : ''}>{value}</strong>{note && <small>{note}</small>}</div>; }


export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(null);
  const [ready, setReady] = useState(false);
  const [companyName, setCompanyName] = useState('渋谷珈琲株式会社');
  const [page, setPage] = useState<Page>('city');
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'manage'|'explore'>('manage');
  const [overviewRequestId, setOverviewRequestId] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    if (!state?.id) return;
    try { if (localStorage.getItem('shibuya-first-play-guide-v1') !== 'seen') setGuideOpen(true); }
    catch { setGuideOpen(true); }
  }, [state?.id]);
  const closeGuide = () => { setGuideOpen(false); try { localStorage.setItem('shibuya-first-play-guide-v1', 'seen'); } catch { /* Help remains available without storage. */ } };
  const [hudPanel, setHudPanel] = useState<'menu'|'sites'|'map'|null>(null);
  useEffect(() => { if (page !== 'city') setFacilityOpen(false); }, [page]);
  const [marketEntry, setMarketEntry] = useState<'investment'|'acquisitions'>('investment');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [focusRailDistrict, setFocusRailDistrict] = useState<DistrictId | null>(null);
  const [focusStoreLotId, setFocusStoreLotId] = useState<string | null>(null);
  const [storeFocusRequestId, setStoreFocusRequestId] = useState(0);
  const [mapMode, setMapMode] = useState<'game'|'real'>('game');
  const [realFocusLotId, setRealFocusLotId] = useState<string | null>(null);
  const [realFocusRequestId, setRealFocusRequestId] = useState(0);
  const inspectorRef = useRef<HTMLElement>(null);
  const [investmentPlan, setInvestmentPlan] = useState<{ visit: InvestmentVisit; memo: InvestmentMemo } | null>(null);
  const [investmentVisit, setInvestmentVisit] = useState<InvestmentVisit | null>(null);
  const investmentSequence = useRef(0);
  const [financeDraft, setFinanceDraft] = useState<CapitalPlanningDraft | undefined>();
  const [growthMilestone, setGrowthMilestone] = useState<{ before: GameState; after: GameState } | null>(null);
  const [viewMode, setViewMode] = useState<'normal'|'demand'|'ownership'>('normal');
  const [modal, setModal] = useState<'week'|'settings'|'report'|'new'|'recovery'|'design'|'batch'|null>(null);
  const [design, setDesign] = useState<DesignChoice>(() => { try { const v=localStorage.getItem('shibuya-design'); return v==='metro'||v==='night'?v:'daylight'; } catch { return 'daylight'; } });
  useEffect(() => { document.documentElement.dataset.design=design; try { localStorage.setItem('shibuya-design',design); } catch { /* The theme still works if storage is unavailable. */ } },[design]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [runWeeks, setRunWeeks] = useState<1|4|13>(1);
  const [batchResult, setBatchResult] = useState<Awaited<ReturnType<typeof runManagedWeeks>> | null>(null);
  const [batchDone, setBatchDone] = useState(0);
  const stopRun = useRef(false);
  const [onboarding, setOnboarding] = useState(true);
  const [style, setStyle] = useState<StoreStyle>('standard');
  const [backups, setBackups] = useState<Awaited<ReturnType<typeof listBackups>>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { loadGame().then(setSaved).catch(e => setMessage(String(e))).finally(() => setReady(true)); }, []);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    if (!investmentVisit) return;
    const destination = investmentVisit.intent.kind === 'store' ? 'city' : investmentVisit.intent.kind === 'rail' ? 'development' : 'stocks';
    if (page !== destination) setInvestmentVisit(null);
  }, [page, investmentVisit]);
  useEffect(() => { if (!message || modal || page !== 'city' || facilityOpen || hudPanel || guideOpen) return; const id = setTimeout(() => setMessage(''), 8000); return () => clearTimeout(id); }, [message, modal, page, facilityOpen, hudPanel, guideOpen]);
  useEffect(() => { if (modal === 'settings' || modal === 'recovery') listBackups().then(setBackups).catch(e => setMessage(String(e))); }, [modal]);
  const fail = (e: unknown) => setMessage(e instanceof Error ? e.message : String(e));
  const act = (action: GameAction) => { if (!state || busy) return false; try { const before = stateRef.current ?? state; const next = applyAction(before, action); stateRef.current = next; setState(next); if (action.type === 'ipo' && !before.listed && next.listed) { setModal(null); setPage('city'); setFacilityOpen(false); setHudPanel(null); setGrowthMilestone({ before, after: next }); } if (action.type === 'closeStore' && before.stores.find(store => store.id === action.storeId)?.lotId === focusStoreLotId) setFocusStoreLotId(null); return true; } catch(e) { fail(e); return false; } };
  const start = async () => { if (busy) return; setBusy(true); try { const next = createGame(companyName.trim() || '渋谷珈琲株式会社', crypto.getRandomValues(new Uint32Array(1))[0]); await saveGame(next); setState(next); stateRef.current = next; setSaved(next); setModal(null); setRunWeeks(1); setBatchResult(null); setPage('city'); setFacilityOpen(false); setHudPanel(null); setSelectedLotId(null); setFocusRailDistrict(null); setFocusStoreLotId(null); setRealFocusLotId(null); setMapMode('game'); setInvestmentPlan(null); setInvestmentVisit(null); setGrowthMilestone(null); setFinanceDraft(undefined); setOnboarding(true); setCameraMode('manage'); } catch(e) { fail(e); } finally { setBusy(false); } };
  const finishWeek = async () => {
    if (!state || busy) return;
    setBusy(true); setBatchDone(0); stopRun.current=false;
    try {
      if (runWeeks===1) {
        const next=advanceWeek(state); await saveGame(next); setState(next); stateRef.current=next; setSaved(next); setModal('report');
      } else {
        const result=await runManagedWeeks(state,runWeeks,{commit:saveGame,shouldCancel:()=>stopRun.current,onCommit:(next)=>{setState(next);stateRef.current=next;setSaved(next);setBatchDone(n=>n+1);}});
        setBatchResult(result); setState(result.state); stateRef.current=result.state; setSaved(result.state); setRunWeeks(1);
        if(result.reports.length) setModal('batch'); else if(result.stopReason)setMessage(result.stopReason);
      }
    } catch(e) { fail(e); } finally { setBusy(false); }
  };
  const save = async () => { if (!state || busy) return; setBusy(true); try { await saveGame(state); setSaved(state); setMessage('現在の経営状況を保存しました。'); } catch(e) { fail(e); } finally { setBusy(false); } };
  const openRealCity = async () => { if (busy) return; setBusy(true); try { if (state) { await saveGame(stateRef.current ?? state); } window.location.assign('./real-shibuya.html'); } catch(e) { fail(e); setBusy(false); } };
  const restore = async (key: string) => { if (busy) return; setBusy(true); try { const next = await restoreBackup(key); stateRef.current = next; setState(next); setSaved(next); setModal(null); setPage('city'); setFacilityOpen(false); setHudPanel(null); setSelectedLotId(null); setFocusRailDistrict(null); setFocusStoreLotId(null); setRealFocusLotId(null); setMapMode('game'); setInvestmentPlan(null); setInvestmentVisit(null); setGrowthMilestone(null); setFinanceDraft(undefined); setRunWeeks(1); setMessage('バックアップを復元しました。'); } catch(e) { fail(e); } finally { setBusy(false); } };
  const importFile = async (file: File) => { setBusy(true); try { const next = await importGame(file); await saveGame(next); stateRef.current = next; setState(next); setSaved(next); setModal(null); setPage('city'); setFacilityOpen(false); setHudPanel(null); setSelectedLotId(null); setFocusRailDistrict(null); setFocusStoreLotId(null); setRealFocusLotId(null); setMapMode('game'); setInvestmentPlan(null); setInvestmentVisit(null); setGrowthMilestone(null); setFinanceDraft(undefined); setRunWeeks(1); setMessage('会社データを読み込みました。'); } catch(e) { fail(e); } finally { setBusy(false); } };
  const fileInput = <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ''; }}/ >;
  const designDialog = modal==='design' && <Modal notice={message} onClearNotice={()=>setMessage('')} title="デザインを選ぶ" close={()=>setModal(null)} wide><DesignPanel value={design} onChange={setDesign}/></Modal>;
  const designButton = <button className="design-trigger" onClick={()=>setModal('design')} aria-label="デザインを選ぶ"><Palette size={16}/><span>デザイン</span></button>;
  if (!state) return <GameNoticeContext.Provider value={{notice:message,onClearNotice:()=>setMessage('')}}><main className="welcome"><div className="welcome-design">{designButton}</div>{designDialog}<div className="welcome-grid"/><div className="welcome-content"><span className="eyebrow">TOKYO BUSINESS SIMULATION</span><h1>SHIBUYA<br/><em>CAPITAL.</em></h1><p className="welcome-lead">一軒の珈琲店から、<br/>この街の未来をつくる。</p><p className="welcome-copy">渋谷で起業し、利益を次の挑戦へ。<br/>店舗、不動産、投資、そして巨大企業グループへ。</p><div className="welcome-actions">{!ready ? <p>会社データを確認中…</p> : <>{saved && <button className="primary" onClick={() => { setState(saved); stateRef.current = saved; setOnboarding(false); }}><span>{saved.companyName} を続ける<small>第{saved.week}週 · {compact(saved.cash)}</small></span><ArrowUpRight size={20}/></button>}<label>会社名<input value={companyName} maxLength={40} onChange={e => setCompanyName(e.target.value)} /></label><button className={saved ? 'secondary' : 'primary'} disabled={busy} onClick={() => saved ? setModal('new') : void start()}>新しい会社を設立 <ChevronRight size={18}/></button><button className="text-button" disabled={busy} onClick={() => fileRef.current?.click()}>保存ファイルを読み込む</button><button className="text-button" disabled={busy} onClick={() => setModal('recovery')}>保存履歴から復元</button></>}<button className="text-button" disabled={busy} onClick={()=>void openRealCity()}>実際の渋谷を3Dで見る <ArrowUpRight size={15}/></button><small>初期資金 1,200万円 · 週ごとに進行 · ログイン不要</small></div></div><div className="welcome-side"><span>35°39′N / 139°42′E</span><div className="skyline">{Array.from({length:18},(_,i)=><i key={i} style={{height: `${90+((i*79)%250)}px`, width:`${20+i%4*12}px`}}/>)}</div><div className="welcome-caption"><span>CHAPTER 01</span><h2>渋谷、その先へ。</h2><p>小さな決断が、大きな街を動かす。</p></div></div>{fileInput}{message && <div className="toast" role="alert">{message}<button onClick={() => setMessage('')} aria-label="閉じる"><X size={16}/></button></div>}{modal === 'recovery' && <Modal notice={message} onClearNotice={()=>setMessage('')} title="保存履歴から復元" close={() => setModal(null)}><p>週末の自動保存から、会社の経営を再開できます。</p>{!backups.length && <p className="muted">このブラウザーに保存履歴はありません。</p>}{backups.map(b=><button className="backup" key={b.key} disabled={busy} onClick={() => void restore(b.key)}><span>{b.companyName} · 第{b.week}週</span><small>{new Date(b.savedAt).toLocaleString('ja-JP')}</small></button>)}</Modal>}{modal === 'new' && <Modal notice={message} onClearNotice={()=>setMessage('')} title="新しい会社を設立" close={() => setModal(null)}><p>現在の保存データを新しい会社で置き換えます。必要な場合は先に現在の会社を続け、設定から保存ファイルを書き出してください。</p><button className="primary" disabled={busy} onClick={() => void start()}>設立する</button></Modal>}</main></GameNoticeContext.Provider>;

  const summary = getSummary(state);
  const outlook = getWeekOutlook(state);
  const forecast = outlook.expected;
  const weekRisk = outlook.risk.debtLossPossible || outlook.risk.cashShortfallPossible;
  const weekEndsCompany = (state.loans.some(loan=>loan.remaining>0) && outlook.netProfit.max <= 0) || outlook.cashAfter.max < 0;
  const economy = operatingConditions(state);
  const lot = LOTS.find(l => l.id === selectedLotId);
  const store = state.stores.find(s => s.lotId === selectedLotId);
  const property = state.properties.find(p => p.lotId === selectedLotId);
  const tabs: {id:Page;label:string;icon:ReactNode}[] = [{id:'city',label:'街を探索',icon:<MapPin size={18}/>},{id:'stores',label:'店舗経営',icon:<Coffee size={18}/>},{id:'finance',label:'財務・不動産',icon:<Landmark size={18}/>},{id:'stocks',label:'株式市場',icon:<TrendingUp size={18}/>},{id:'deals',label:'営業・提案',icon:<ArrowDownLeft size={18}/>},{id:'group',label:'グループ',icon:<Building2 size={18}/>},{id:'development',label:'街区開発',icon:<Building2 size={18}/>},{id:'progression',label:'成長戦略',icon:<Flag size={18}/>},{id:'history',label:'経営記録',icon:<Layers size={18}/>}];
  const requestRealFocus = (id: string | null) => { setRealFocusLotId(id); setRealFocusRequestId(value=>value+1); };

  const selectLot = (id: string) => {
    setSelectedLotId(id); setPage('city'); setFacilityOpen(true); setHudPanel(null);
    if(mapMode==='real'&&!hasRealCityAnchor(id)){setMapMode('game');setMessage('この区画はゲーム街に表示します。同じ会社のまま経営を続けられます。');}
  };
  const changeMap = (next: 'game'|'real') => {
    if(next===mapMode)return;
    setMapMode(next);setFocusRailDistrict(null);setFocusStoreLotId(null);
    requestRealFocus(null);
  };
  const viewStore = (id: string) => {
    const current = stateRef.current ?? state;
    if (!current.stores.some(candidate => candidate.lotId === id)) { setMessage('この場所の店舗は現在営業していません。'); return; }
    setModal(null); setFocusRailDistrict(null); setSelectedLotId(id); setFocusStoreLotId(id); setPage('city'); setFacilityOpen(false); setHudPanel(null);
    setStoreFocusRequestId(value => value + 1);
    requestRealFocus(hasRealCityAnchor(id)?id:null);
    if(mapMode==='real'&&!hasRealCityAnchor(id)){setMapMode('game');setMessage('この店舗の外観はゲーム街で表示します。会社や選択した店舗は変わりません。');}
  };
  const planInvestment = (intent: InvestmentIntent) => {
    const current = stateRef.current ?? state;
    const visit = { id: `${current.id}:plan:${++investmentSequence.current}`, intent };
    const memo = getInvestmentMemo(current, visit);
    if (!memo) { setMessage('この投資の条件が変わりました。対象の状態を確認してください。'); return; }
    setInvestmentPlan({ visit, memo }); setInvestmentVisit(null); setModal(null); setPage('finance');
  };
  const returnToInvestment = () => {
    if (!investmentPlan) return;
    const intent = investmentPlan.visit.intent;
    setInvestmentVisit({ id: `${investmentPlan.visit.id}:return:${++investmentSequence.current}`, intent });
    setModal(null);
    if (intent.kind === 'store') { setStyle(intent.style); selectLot(intent.lotId); }
    else setPage(intent.kind === 'rail' ? 'development' : 'stocks');
  };
  const actionButton = (label:string, action:GameAction, className='secondary') => <button className={className} disabled={busy || state.gameOver} onClick={() => act(action)}>{label}</button>;
  const showOverview = () => { setFocusRailDistrict(null); setFocusStoreLotId(null); requestRealFocus(null); setOverviewRequestId(value=>value+1); setHudPanel(null); };
  const browseSites = () => { setModal(null); setPage('city'); setFacilityOpen(false); setHudPanel('sites'); };
  return <GameNoticeContext.Provider value={{notice:message,onClearNotice:()=>setMessage('')}}><main className="game-shell immersive-game">
    <section className="immersive-city" aria-label="渋谷の街">
      <div className="business-map" data-map-mode={mapMode}><div className="business-map-body">
        {mapMode==='real'?<RealCityView cameraMode={cameraMode} state={state} selectedLotId={selectedLotId} focusLotId={realFocusLotId} focusRequestId={realFocusRequestId} onSelectLot={selectLot} onFallback={()=>changeMap('game')} onOverview={()=>requestRealFocus(null)}/>:<CityView storeFocusRequestId={storeFocusRequestId} overviewRequestId={overviewRequestId} cameraMode={cameraMode} state={state} selectedLotId={selectedLotId} onSelectLot={selectLot} quality={state.settings.quality} viewMode={viewMode} focusRailDistrict={focusRailDistrict} focusStoreLotId={focusStoreLotId}/>}
      </div></div>
    </section>
    <div className="game-hud">
      <button className="hud-company" onClick={()=>setPage('finance')} aria-label={`手元資金 ${compact(state.cash)}・財務を開く`}><span>手元資金</span><strong title={money(state.cash)}>{Math.abs(state.cash)>=100000000?compact(state.cash):money(state.cash)}</strong></button>
      <div className="hud-tools"><CityAudioControl/><button className="hud-button" aria-label="地図" title="地図" onClick={()=>setHudPanel('map')}><Layers size={18}/><span>地図</span></button><button className="hud-button" aria-label="経営" title="経営" onClick={()=>setHudPanel('menu')}><Menu size={18}/><span>経営</span></button></div>
    </div>
    <div className="hud-context">
      {onboarding&&state.week===1&&!selectedLotId&&<div className="first-step-hint"><span>{state.stores.length?'1号店が開業。週を終了して、営業結果を見よう。':'＋ の建物をクリックして、1号店を開こう。'}</span><button className="icon-button" aria-label="ガイドを閉じる" onClick={()=>setOnboarding(false)}><X size={16}/></button></div>}
      {focusStoreLotId&&mapMode==='game'&&<p className="store-scene-caption">直近の営業をもとにした街の様子</p>}
      <div className="hud-context-actions">{cameraMode==='explore'&&<button className="hud-button" onClick={()=>setCameraMode('manage')}>俯瞰で経営に戻る</button>}<button className="hud-button" onClick={()=>setHudPanel('sites')}><MapPin size={18}/><span>{state.stores.length?'物件を探す':'出店場所を探す'}</span></button>{selectedLotId&&lot&&<button className="hud-button" onClick={()=>selectLot(lot.id)}><Coffee size={18}/><span>{store?'この店を経営':'選んだ建物'}</span></button>}{(focusRailDistrict||focusStoreLotId||realFocusLotId)&&<button className="hud-button" onClick={showOverview}>街全体に戻る</button>}</div>
    </div>
    <button className="hud-next-week" disabled={busy||state.gameOver} onClick={()=>setModal('week')}><span>第 {state.week} 週<small>週を終了する</small></span><ArrowUpRight size={22}/></button>
    {hudPanel==='menu'&&<Modal notice={message} onClearNotice={()=>setMessage('')} title="経営" close={()=>setHudPanel(null)}><nav className="game-menu" aria-label="経営メニュー">{state.lastReport&&<button onClick={()=>{setHudPanel(null);setModal('report');}}><ReceiptText size={18}/><span>直近の営業結果</span><ChevronRight size={16}/></button>}{tabs.filter(t=>t.id!=='city').map(t=><button key={t.id} onClick={()=>{if(t.id==='stocks')setMarketEntry('investment');setHudPanel(null);setPage(t.id);}}>{t.icon}<span>{t.label}</span><ChevronRight size={16}/></button>)}<button onClick={()=>{setHudPanel(null);setModal('settings');}}><Settings size={18}/><span>設定・保存</span><ChevronRight size={16}/></button><button onClick={()=>{setHudPanel(null);setGuideOpen(true);}}><HelpCircle size={18}/><span>遊び方</span><ChevronRight size={16}/></button></nav></Modal>}
    {hudPanel==='sites'&&<Modal notice={message} onClearNotice={()=>setMessage('')} title="物件を探す" close={()=>setHudPanel(null)}><SiteBrowser state={state} selectedLotId={selectedLotId} onSelectLot={selectLot} mapMode={mapMode}/></Modal>}
    {hudPanel==='map'&&<Modal notice={message} onClearNotice={()=>setMessage('')} title="地図" close={()=>setHudPanel(null)}><div className="map-choice" role="group" aria-label="地図の表示"><button aria-pressed={mapMode==='game'} onClick={()=>{changeMap('game');setHudPanel(null);}}>ゲーム街<small>32区画に出店・投資</small></button><button aria-pressed={mapMode==='real'} onClick={()=>{changeMap('real');setHudPanel(null);}}>実測の渋谷<small>写真からつくられた街 · 4地点対応</small></button></div>{mapMode==='game'&&<><h3>街の見方</h3><div className="map-layer-choice">{(['normal','demand','ownership'] as const).map((v,i)=><button key={v} aria-pressed={viewMode===v} onClick={()=>{setViewMode(v);setHudPanel(null);}}>{['街並み','需要分布','所有物件'][i]}</button>)}</div></>}<button className="secondary map-overview" onClick={showOverview}>街全体に戻る</button><h3>カメラ操作</h3><div className="map-layer-choice" role="group" aria-label="カメラ操作">{(['manage','explore'] as const).map(mode=><button key={mode} aria-pressed={cameraMode===mode} onClick={()=>{setCameraMode(mode);setHudPanel(null);}}>{mode==='manage'?'俯瞰で経営':'街を眺める'}</button>)}</div><p className="muted">{cameraMode==='manage'?'ドラッグで街を移動、ホイールで拡大します。角度は変わりません。':'ドラッグで回転、ホイールで拡大します。「俯瞰で経営」で元の角度に戻れます。'} ＋ の目印から出店できます。</p></Modal>}
    {page!=='city'&&<Modal key={page} notice={message} onClearNotice={()=>setMessage('')} title={tabs.find(t=>t.id===page)?.label??'経営'} close={()=>setPage('city')} wide className="management-dialog"><div className="page-content">
  {page==='development' && <><DevelopmentPanel state={state} onAction={act} busy={busy}/><RailProjectsPanel state={state} onAction={act} busy={busy} onPlanInvestment={planInvestment} investmentVisit={investmentVisit} onShowProject={districtId=>{setSelectedLotId(null);setFocusStoreLotId(null);requestRealFocus(null);setMapMode('game');setFocusRailDistrict(districtId);setPage('city');}}/></>}
  {page==='progression' && <ProgressionPanel state={state} onNavigate={tab=>setPage(tab as Page)}/>}
  {page==='stores' && <><div className="summary-strip"><Metric label="店舗数" value={`${state.stores.length} 店`}/><Metric label="累計来店者" value={`${state.totalCustomers.toLocaleString()} 人`}/><Metric label="ブランド評価" value={state.reputation.toFixed(0)}/></div>{!state.stores.length ? <div className="empty"><Coffee size={40}/><h3>最初の一杯から始めよう。</h3><p>渋谷の物件を選び、あなたの1号店を開業しましょう。</p><button className="primary" onClick={browseSites}>街で物件を探す</button></div>:<div className="store-grid">{state.stores.map(s=>{const actual=state.lastReport?.storeResults.find(result=>result.id===s.id);return <article className="card" key={s.id}><header><div><span className="eyebrow">{styles[s.style]} / LEVEL {s.level}</span><h3>{s.name}</h3></div><button className="icon-button" title="店の様子を見る" aria-label={`${s.name}の様子を見る`} onClick={()=>viewStore(s.lotId)}><MapPin size={18}/></button></header><div className="mini-metrics">{actual?<><Metric label="直近の店舗利益" value={compact(actual.profit)} good={actual.profit>=0}/><Metric label="満足度" value={`${Math.round(actual.satisfaction)}%`}/></>:<p className="muted">{s.openedWeek===state.week?'初営業待ち':'営業実績は未記録'} · 週を終えると結果が届きます。</p>}</div><button className="secondary" onClick={()=>selectLot(s.lotId)}>この店を経営</button></article>;})}</div>}</>}
  {page==='finance' && <><div className="summary-strip"><Metric label="手元資金" value={compact(state.cash)}/><Metric label="借入残高" value={compact(summary.debt)}/><Metric label="純資産" value={compact(summary.netWorth)}/></div><CapitalPlanningPanel state={state} onAction={act} disabled={busy||state.gameOver} planningContext={investmentPlan?.memo} onReturnToInvestment={returnToInvestment} initialDraft={financeDraft} onDraftChange={setFinanceDraft}/><div className="two-columns"><section className="card"><h3>借入契約</h3>{!state.loans.length && <p className="muted">借入はありません。</p>}{state.loans.map(l=><div className="list-row" key={l.id}><div><strong>{money(l.remaining)}</strong><small>年利 {(l.annualRate*100).toFixed(1)}% · 残り{l.weeksLeft}週</small></div>{actionButton('一括返済',{type:'repayLoan',loanId:l.id})}</div>)}</section></div><h3 className="section-title">保有不動産 <span>{state.properties.length} PROPERTIES</span></h3>{!state.properties.length?<div className="empty small"><Building2 size={28}/><p>地図上の物件から購入できます。賃貸収入を次の事業へ。</p><button className="secondary" onClick={browseSites}>物件を探す</button></div>:<div className="store-grid">{state.properties.map(p=><article className="card" key={p.id}><span className="eyebrow">PROPERTY / LEVEL {p.level}</span><h3>{LOTS.find(l=>l.id===p.lotId)?.name}</h3><div className="mini-metrics"><Metric label={state.stores.some(s=>s.lotId===p.lotId)?"自社利用・家賃節約":"週間賃料の基準"} value={money(state.stores.some(s=>s.lotId===p.lotId)?(LOTS.find(l=>l.id===p.lotId)?.rent??0)*economy.rents:p.weeklyIncome*p.occupancy*economy.rents)}/><Metric label="稼働率" value={`${Math.round(p.occupancy*100)}%`}/></div><div className="button-row">{actionButton(`改修 ${compact(p.purchasePrice*.12)}`,{type:'upgradeProperty',propertyId:p.id})}<button className="danger-link" disabled={state.gameOver} onClick={()=>{if(window.confirm(`この不動産を ${money(p.purchasePrice*(1+(p.level-1)*.10)*.9)} で売却しますか？`)) act({type:'sellProperty',propertyId:p.id});}}>売却</button><button className="icon-button" onClick={()=>selectLot(p.lotId)} title="地図で見る"><MapPin size={17}/></button></div></article>)}</div>}</>}
  {page==='stocks' && <MarketPanel initialSection={marketEntry} state={state} onAction={act} busy={busy} onPlanInvestment={planInvestment} investmentVisit={investmentVisit}/>}
  {page==='deals' && <DealsPanel state={state} onAction={act} busy={busy}/>}
  {page==='group' && <><div className="summary-strip"><Metric label="企業価値" value={compact(summary.valuation)}/><Metric label="創業者持分" value={`${(summary.ownership*100).toFixed(1)}%`}/><Metric label="子会社" value={`${state.subsidiaries.length} 社`}/></div><section className="card ipo-card"><div><span className="eyebrow">資本政策</span><h3>{state.listed?'上場企業として、その先へ。':'東京から、株式市場へ。'}</h3>{!state.listed?<div className="requirements">{summary.ipoRequirements.map(r=><span key={r.label} className={r.met?'met':''}>{r.met?'✓':'○'} {r.label}</span>)}</div>:<p className="muted">発行済株式 {state.sharesOutstanding.toLocaleString()} 株 · 株価 {money(state.sharePrice)}</p>}</div>{!state.listed?<button className="primary" onClick={()=>setPage('finance')}>公開後の資金と持分を比較</button>:<div className="ipo-actions"><button className="secondary" onClick={()=>setPage('finance')}>増資と借入を比較</button><label>配当性向<select value={state.dividendPayout} onChange={e=>act({type:'setDividend',payout:Number(e.target.value)})}>{[0,0.1,0.25,0.5].map(v=><option key={v} value={v}>{v*100}%</option>)}</select></label></div>}</section><h3 className="section-title">事業を広げる <span>MERGERS & ACQUISITIONS</span></h3><div className="store-grid">{ACQUISITION_TARGETS.map(t=>{const owned=state.subsidiaries.some(s=>s.id===t.id);return <article className="card acquisition" key={t.id}><span className="eyebrow">{{food:'FOOD & BEVERAGE',property:'REAL ESTATE',rail:'RAILWAY'}[t.sector]}</span><h3>{t.name}</h3><p>{t.description}</p><div className="mini-metrics"><Metric label="買収価格" value={compact(t.price)}/><Metric label="週間利益の目安" value={compact(t.weeklyProfit)}/></div><small className="muted">必要ブランド評価 {t.minReputation} · 事業リスク {(t.risk*100).toFixed(0)}%</small>{owned?<span className="owned-label">グループ傘下</span>:actionButton('買収する',{type:'acquire',targetId:t.id},'primary')}</article>;})}</div></>}
  {page==='history' && <><div className="summary-strip"><Metric label="経営期間" value={`${state.week-1} 週`}/><Metric label="利益を出した週" value={`${state.profitableWeeks} 週`}/><Metric label="累計来店者" value={state.totalCustomers.toLocaleString()}/></div><OpeningResults onBrowseSites={browseSites} state={state} onViewStore={viewStore} mode="history" onSelectStore={selectLot} onNavigate={tab=>{setSelectedLotId(null);setFocusRailDistrict(null);setFocusStoreLotId(null);setPage(tab);}}/><section className="card"><span className="eyebrow">企業価値の記録</span><h3>企業価値の軌跡</h3>{state.history.length<2?<p className="muted">週を進めると成長の記録が表示されます。</p>:<div className="chart"><svg viewBox="0 0 800 200" role="img" aria-label="企業価値の推移"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--accent)" stopOpacity=".35"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>{[40,90,140,190].map(y=><line key={y} x1="0" x2="800" y1={y} y2={y} stroke="var(--line)"/>)}{(()=>{const points=state.history;const max=Math.max(...points.map(p=>p.valuation),1);const min=Math.min(...points.map(p=>p.valuation),0);const coords=points.map((p,i)=>`${i/(points.length-1)*800},${190-(p.valuation-min)/(max-min||1)*170}`).join(' ');return <><polygon points={`0,200 ${coords} 800,200`} fill="url(#chartFill)"/><polyline points={coords} fill="none" stroke="var(--accent)" strokeWidth="3"/></>;})()}</svg><div className="chart-axis"><span>第{state.history[0].week}週</span><span>第{state.history[state.history.length-1].week}週</span></div></div>}</section><div className="table-wrap"><table><thead><tr><th>週</th><th>売上</th><th>純利益</th><th>手元資金</th><th>店舗数</th></tr></thead><tbody>{[...state.history].reverse().slice(0,100).map(h=><tr key={h.week}><td>第{h.week}週</td><td>{money(h.revenue)}</td><td className={h.profit>0?'positive':'negative'}>{money(h.profit)}</td><td>{money(h.cash)}</td><td>{h.stores}</td></tr>)}</tbody></table></div></>}

    </div></Modal>}
    {page==='city'&&facilityOpen&&lot&&<Modal notice={message} onClearNotice={()=>setMessage('')} title={store?.name??lot.name} close={()=>setFacilityOpen(false)} className="facility-dialog"><section ref={inspectorRef} className="facility-content" data-selected-lot-id={selectedLotId??''}>
{lot?<><p className="facility-district">{districtNames[lot.district]}{store?" · 営業中":property?" · 保有物件":lot.available?" · 出店できます":" · 街のランドマーク"}</p>{store?<StoreManagementPanel key={store.id} state={state} store={store} onAction={act} disabled={busy||state.gameOver} onViewStore={viewStore}/>:lot.available?<StoreOpeningPanel state={state} lotId={lot.id} style={style} onStyleChange={setStyle} onOpen={chosen=>{if(act({type:'openStore',lotId:lot.id,style:chosen})){setFacilityOpen(false);setMessage(`${lot.name}にカフェを開業しました。「自社」の目印から経営できます。週を終了すると最初の営業結果が届きます。`);}}} onFinance={()=>planInvestment({kind:'store',lotId:lot.id,style})} disabled={busy||state.gameOver}/>:<p className="muted">この建物には出店できません。</p>}{property?<><div className="section-rule"><h3>所有不動産</h3><span>Lv.{property.level}</span></div><p>{store?`自社店舗の家賃 ${money(lot.rent*economy.rents)} / 週を節約`:`週間賃料の基準 ${money(property.weeklyIncome*property.occupancy*economy.rents)}`}</p>{actionButton(`物件を改修 ${compact(property.purchasePrice*.12)}`,{type:'upgradeProperty',propertyId:property.id})}</>:lot.available?<details className="facility-property-options"><summary>この建物を不動産として購入</summary><p className="property-price">{money(lot.purchasePrice)}</p>{actionButton('物件を購入する',{type:'buyProperty',lotId:lot.id})}</details>:null}<details className="facility-location-details"><summary>この場所について</summary><p>{lot.description}</p><div className="mini-metrics"><Metric label="通行量" value={lot.footfall.toLocaleString()}/><Metric label="客層の購買力" value={lot.affluence.toFixed(1)}/></div>{mapMode==='real'&&<p className="real-lot-note">出店条件はゲーム設定です。実際の募集物件ではありません。</p>}</details></>:null}
    </section></Modal>}
    {growthMilestone&&<GrowthMilestonePanel before={growthMilestone.before} after={growthMilestone.after} onClose={()=>setGrowthMilestone(null)} onNavigate={target=>{if(target==='market')setMarketEntry('acquisitions');setGrowthMilestone(null);setPage(target==='market'?'stocks':target);}}/>}{designDialog}
    {fileInput}
  {message&&!modal&&page==='city'&&!hudPanel&&!facilityOpen && <div className="toast" role="alert">{message}<button aria-label="閉じる" onClick={()=>setMessage('')}><X size={16}/></button></div>}
  {state.gameOver && modal!=='settings' && <div className="game-over-banner"><strong>経営を終了しました</strong><span>{state.gameOverReason}</span><button onClick={()=>setModal('settings')}>記録の保存・新しい会社</button></div>}
  {modal==='week' && <Modal notice={message} onClearNotice={()=>setMessage('')} title={`第${state.week}週を営業する`} close={()=>!busy&&setModal(null)}>
    <p className="week-intro">この1週間をお店に任せて、営業結果を待ちましょう。</p>
    <p className="muted">客足や店舗のコンディションは週ごとに変わります。収益が確定するのは営業後です。</p>
    {weekRisk&&<p className="warning danger" role="alert">{outlook.risk.debtLossPossible?'借入中の利益が0以下になる可能性があります。':'週末の支払い資金が不足する可能性があります。'}{runWeeks===1?(weekEndsCompany?'今の計画では、見込みの上限でも経営を続けられません。':'結果によっては経営終了になります。'):'連続営業は決算前に停止します。'} 設定や資金を見直せます。</p>}
    <details className="week-outlook" open={weekRisk||undefined}><summary>営業前の見込みを確認</summary>
      <dl className="cost-list"><div><dt>売上の見込み</dt><dd>{rangeMoney(outlook.revenue)}</dd></div><div><dt>利益の見込み（利息後）</dt><dd>{rangeMoney(outlook.netProfit)}</dd></div><div><dt>週末の手元資金</dt><dd>{rangeMoney(outlook.cashAfter)}</dd></div></dl>
      <p className="muted">範囲は今の設定で想定する目安です。店舗を開く・価格や人員を変えると、見込みも変わります。</p>
      <details><summary>支払いの内訳</summary><dl className="cost-list"><div><dt>本部・グループ運営費</dt><dd>{money(economy.overhead)}</dd></div><div><dt>支払利息</dt><dd>{money(forecast.interest)}</dd></div><div><dt>元本返済</dt><dd>{money(forecast.loanRepayment)}</dd></div><div><dt>受取配当の目安</dt><dd>{money(forecast.dividendsReceived)}</dd></div></dl></details>
    </details>
    {state.profitableWeeks>=12&&<label>営業を進める期間<select disabled={busy} value={runWeeks} onChange={e=>setRunWeeks(Number(e.target.value) as 1|4|13)}><option value="1">1週間 · 結果を確認</option><option value="4">最大4週間 · 店舗に任せる</option><option value="13">最大13週間 · 店舗に任せる</option></select></label>}
    {runWeeks>1&&<p className="muted">毎週保存し、新しい提案や成長機会、赤字・資金不足の可能性がある週の手前で止まります。</p>}
    {busy&&runWeeks>1&&<div className="batch-progress" role="status"><p>{batchDone} / {runWeeks} 週間の営業・保存が完了</p><button className="secondary" onClick={()=>{stopRun.current=true;}}>ここで停止</button></div>}
    <div className="button-row"><button className="secondary" disabled={busy} onClick={()=>setModal(null)}>街に戻る</button><button className={weekRisk&&runWeeks===1?'primary week-confirm-danger':'primary'} disabled={busy} onClick={()=>void finishWeek()}>{busy?'営業・保存中…':runWeeks===1?(weekRisk?'リスクを承知して営業する':'営業して週を進める'):`最大${runWeeks}週間の営業を始める`}<ArrowUpRight size={18}/></button></div>
  </Modal>}
  {modal==='batch'&&batchResult&&<Modal notice={message} onClearNotice={()=>setMessage('')} title="連続営業の報告" close={()=>setModal(null)}><p>第{batchResult.reports[0]?.week}週から {batchResult.reports.length} 週間の営業を完了しました。各週の会社データを保存しています。</p><div className="summary-strip"><Metric label="期間の純利益" value={money(batchResult.reports.reduce((n,r)=>n+r.netProfit,0))} good={batchResult.reports.reduce((n,r)=>n+r.netProfit,0)>0}/><Metric label="期間の現金増減" value={money(batchResult.reports.reduce((n,r)=>n+r.cashChange,0))}/></div>{batchResult.stopReason&&<p className="warning">{batchResult.stopReason}</p>}<OpeningResults onBrowseSites={browseSites} state={state} onViewStore={viewStore} reportWeeks={batchResult.reports.map(r=>r.week)} onSelectStore={id=>{setModal(null);selectLot(id);}} onNavigate={tab=>{setModal(null);setSelectedLotId(null);setFocusRailDistrict(null);setFocusStoreLotId(null);setPage(tab);}} onContinue={()=>setModal(null)}/><div className="table-wrap"><table><thead><tr><th>営業週</th><th>純利益</th><th>現金増減</th></tr></thead><tbody>{batchResult.reports.map(r=><tr key={r.week}><td>第{r.week}週</td><td className={r.netProfit>0?'positive':'negative'}>{money(r.netProfit)}</td><td>{money(r.cashChange)}</td></tr>)}</tbody></table></div><div className="button-row"><button className="secondary" onClick={()=>setModal('report')}>最後の週の詳細</button><button className="primary" onClick={()=>setModal(null)}>経営に戻る<ChevronRight size={18}/></button></div></Modal>}
  {modal==='report' && state.lastReport && <Modal notice={message} onClearNotice={()=>setMessage('')} title={`第${state.lastReport.week}週の営業結果`} close={()=>setModal(null)} className="weekly-results-dialog">{state.gameOver&&<p className="warning danger">{state.gameOverReason}</p>}<WeeklyResults state={state} onManageStore={id=>{setModal(null);selectLot(id);}} onViewStore={viewStore} onBrowseSites={browseSites} onContinue={()=>setModal(null)} onFinance={()=>{setModal(null);setPage('finance');}}/><p className="save-confirm">✓ 自動保存しました</p></Modal>}
  {modal==='settings' && <Modal notice={message} onClearNotice={()=>setMessage('')} title="設定と会社データ" close={()=>!busy&&setModal(null)} wide><div className="two-columns"><section><h3>表示品質</h3>{designButton}<label>3D描画<select value={state.settings.quality} onChange={e=>act({type:'settings',changes:{quality:e.target.value as GameState['settings']['quality']}})}><option value="low">軽量 · ノートPC向け</option><option value="medium">標準</option><option value="high">高品質</option></select></label><p className="muted">経営は「週を終了」したときだけ進みます。</p><button className="secondary" disabled={busy} onClick={()=>void openRealCity()}>保存して実際の渋谷を3Dで見る</button><h3>保存と持ち出し</h3><p className="muted">週終了時に自動保存します。長く遊ぶ会社は、定期的にファイルへ書き出してください。</p><div className="stack-buttons"><button className="primary" disabled={busy} onClick={()=>void save()}>今すぐ保存する</button><button className="secondary" disabled={busy} onClick={()=>{void Promise.resolve(exportGame(state)).catch(fail);}}>保存ファイルを書き出す</button><button className="secondary" disabled={busy} onClick={()=>{if(window.confirm('現在の会社を読み込むファイルの内容で置き換えます。続けますか？'))fileRef.current?.click();}}>ファイルから読み込む</button></div></section><section><h3>週次バックアップ</h3><p className="muted">過去の時点に戻せます。現在の進行は置き換わります。</p><div className="backup-list">{!backups.length?<p>バックアップはまだありません。</p>:backups.map(b=><div className="list-row" key={b.key}><div><strong>{b.companyName}</strong><small>第{b.week}週 · {new Date(b.savedAt).toLocaleString('ja-JP')}</small></div><button className="secondary" disabled={busy} onClick={()=>{if(window.confirm(`第${b.week}週のバックアップを復元しますか？`))void restore(b.key);}}>復元</button></div>)}</div><div className="section-rule"><h3>新しい物語</h3></div><button className="danger-link" disabled={busy} onClick={()=>setModal('new')}>新しい会社を設立する</button></section></div></Modal>}
  {modal==='new' && <Modal notice={message} onClearNotice={()=>setMessage('')} title="新しい会社を設立" close={()=>setModal('settings')}><p>現在の会社を新しい会社に置き換えます。続ける前に保存ファイルを書き出すことをおすすめします。</p><button className="secondary" onClick={()=>{void Promise.resolve(exportGame(state)).catch(fail);}}>現在の会社を書き出す</button><label>会社名<input value={companyName} maxLength={40} onChange={e=>setCompanyName(e.target.value)}/></label><button className="primary" disabled={busy} onClick={()=>void start()}>新しい会社を設立する</button></Modal>}
  {guideOpen&&<FirstPlayGuide onClose={closeGuide}/>}
  </main></GameNoticeContext.Provider>;
}
