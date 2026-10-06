import type { GameState } from '../model';
import { ACQUISITION_TARGETS, DISTRICTS, LOTS } from '../data/district';
import { STOCKS } from '../data/stocks';
import { getMarketAcquisitionTargets, getMarketGroupFinancials } from './marketAcquisitions';
import { getDevelopmentPrograms } from './development';
import { evaluateSite, getSummary, getWeekOutlook, type EstimateRange } from './engine';
import { getCampaignCompletion } from './campaign';

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const rangeYen = ({ min, max }: EstimateRange) => `約${yen(Math.floor(min / 1000) * 1000)}〜${yen(Math.ceil(max / 1000) * 1000)}`;
export interface RoadmapStep { id: string; title: string; description: string; achieved: boolean; requirements: { label: string; met: boolean }[]; tab: string; optionalBeforeIPO?: boolean }
export type CapitalFocus =
  | { kind: 'ipo'; title: string; eligible: boolean; tab: string }
  | { kind: 'investment'; title: string; cost: number; tab: string };
/** Live operating goals, not persisted awards or additional engine unlocks. */
export function getProgression(state: GameState) {
  const marketGroup = getMarketGroupFinancials(state);
  const nextMarketTarget = getMarketAcquisitionTargets(state).filter(t => t.status !== 'owned' && t.status !== 'integrating').sort((a, b) => a.upfrontCost - b.upfrontCost)[0];
  const allMarketOperating = marketGroup.operating === STOCKS.length && marketGroup.integrating === 0;
  const programs = getDevelopmentPrograms(state);
  const completedDistricts = programs.filter(p => p.phase === 3).length;
  const activeCompletedDistricts = programs.filter(p => p.phase === 3 && p.active).length;
  const summary = getSummary(state);
  const outlook = getWeekOutlook(state);
  const forecast = outlook.expected;
  const completion = getCampaignCompletion(state, forecast);
  const profitRequirement = `今週の利益見込み：${rangeYen(outlook.netProfit)}（達成判定は基準見込みの黒字）`;
  const neutralProfit = summary.weeklyProfit > 0 ? '黒字' : summary.weeklyProfit === 0 ? '損益ゼロ' : '赤字';
  const ipoLabels = [
    `店舗数 ${state.stores.length} / 3 店`,
    `累計黒字 ${state.profitableWeeks} / 12 週`,
    `純資産 ${yen(summary.netWorth)} / ${yen(20_000_000)}`,
    `今週の利益見込み：${rangeYen(outlook.netProfit)}（基準見込み：${neutralProfit}）`,
  ];
  const ipoRequirements = summary.ipoRequirements.map((requirement, index) => ({ ...requirement, label: ipoLabels[index] ?? requirement.label }));
  const availableLots = LOTS.filter(l => l.available);
  const nextLot = availableLots.find(l => !state.stores.some(s => s.lotId === l.id));
  const openingCost = nextLot ? evaluateSite(state, nextLot.id, 'takeaway').openingCost : 0;
  const nextProperty = availableLots.filter(l => !state.properties.some(p => p.lotId === l.id)).sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
  const acquisition = ACQUISITION_TARGETS.filter(t => !state.subsidiaries.some(s => s.id === t.id)).sort((a, b) => a.price - b.price)[0];
  const rail = ACQUISITION_TARGETS.filter(t => t.sector === 'rail').sort((a, b) => a.price - b.price)[0];
  const acquiredTargets = ACQUISITION_TARGETS.filter(t => state.subsidiaries.some(s => s.id === t.id)).length;
  const hasRail = state.subsidiaries.some(s => s.sector === 'rail');
  const hasFood = state.subsidiaries.some(s => s.sector === 'food');
  const hasPropertyCompany = state.subsidiaries.some(s => s.sector === 'property');
  const requirements = (price: number, reputation?: number) => [{ label: `手元資金 ${yen(state.cash)} / ${yen(price)}`, met: state.cash >= price }, ...(reputation === undefined ? [] : [{ label: `信用 ${state.reputation.toFixed(1)} / ${reputation}`, met: state.reputation >= reputation }])];
  const roadmap: RoadmapStep[] = [
    { id: 'cafe', title: '渋谷の一杯から', description: '街で空き区画を選び、最初の店を開きましょう。', achieved: state.stores.length >= 1, requirements: [{ label: `${state.stores.length} / 1 店舗を運営`, met: state.stores.length >= 1 }, ...requirements(openingCost)], tab: 'city' },
    { id: 'chain', title: '3店舗のチェーンへ', description: '収支を整え、立地と客層の異なる店舗を育てます。', achieved: state.stores.length >= 3, requirements: [{ label: `${state.stores.length} / 3 店舗を運営`, met: state.stores.length >= 3 }], tab: 'stores' },
    { id: 'property', title: '街のオーナーになる', description: '物件購入は任意の投資で、上場の必須条件ではありません。地区開発には対象地区の直接保有物件が必要です。自店の家賃削減か、賃貸収入か。物件ごとの収益を比較。', achieved: state.properties.length > 0, requirements: [{ label: `${state.properties.length} / 1 物件を直接保有`, met: state.properties.length > 0 }, ...(nextProperty ? requirements(nextProperty.purchasePrice) : [])], tab: 'finance', optionalBeforeIPO: true },
    { id: 'ipo', title: '株式公開で次の規模へ', description: '3店舗以上・累計12週の黒字・純資産2,000万円以上・基準見込み利益の黒字が公開条件です。店長や物件購入は必須ではありません。公開後は増資と配当を選択します。', achieved: state.listed, requirements: ipoRequirements, tab: 'group' },
    { id: 'group', title: '複数事業を束ねる会社へ', description: '飲食と不動産の子会社を保有する経営目標。鉄道買収の必須条件ではありません。', achieved: hasFood && hasPropertyCompany, requirements: [{ label: '飲食の子会社を保有', met: hasFood }, { label: '不動産の子会社を保有', met: hasPropertyCompany }], tab: 'group' },
    { id: 'rail', title: '鉄道と沿線の未来へ', description: '鉄道事業を買収し、街を支える企業グループへ。', achieved: hasRail, requirements: rail ? requirements(rail.price, rail.minReputation) : [], tab: 'group' },
    { id: 'districts', title: '4地区の未来をつくる', description: '各地区で3工程を完成させる長期目標。工程ごとに集客と不動産収益の配分を選びます。', achieved: completedDistricts === programs.length, requirements: programs.map(p => ({ label: `${p.name}：${p.phase} / 3 工程完了`, met: p.phase === 3 })), tab: 'development' },
    { id: 'portfolio', title: 'すべての事業をグループへ', description: '飲食・不動産・鉄道の全買収候補を傘下に迎える長期目標。', achieved: acquiredTargets === ACQUISITION_TARGETS.length, requirements: [{ label: `${acquiredTargets} / ${ACQUISITION_TARGETS.length} 社を買収`, met: acquiredTargets === ACQUISITION_TARGETS.length }], tab: 'group' },
    { id: 'market-group', title: '100の事業を動かす企業へ', description: '市場の全企業・投資法人を友好的に取得し、引継ぎを完了。経営調査と運営方式の選択を重ねます。', achieved: allMarketOperating, requirements: [{ label: `${marketGroup.operating} / ${STOCKS.length} 社・投資法人が稼働`, met: allMarketOperating }, { label: `引継ぎ中 ${marketGroup.integrating} 件`, met: marketGroup.integrating === 0 }], tab: 'stocks' },
    { id: 'campaign', title: '街と企業の成長を結実させる', description: '上場・既存8社と市場100事業の取得・全地区開発を達成し、全事業の引継ぎ後に利益を確保する最終目標。', achieved: completion.complete, requirements: [{ label: '株式公開を達成', met: state.listed }, { label: `全 ${ACQUISITION_TARGETS.length} 社を傘下に保有`, met: acquiredTargets === ACQUISITION_TARGETS.length }, { label: `市場 ${STOCKS.length} 事業の引継ぎを完了`, met: allMarketOperating }, { label: `全 ${programs.length} 地区で3工程を完成・稼働`, met: activeCompletedDistricts === programs.length }, { label: '会社が継続し、現金が非負', met: !state.gameOver && state.cash >= 0 }, { label: state.lastReport ? `直近の決算が黒字：${yen(state.lastReport.netProfit)}` : '初めての決算を完了', met: completion.lastReportProfitable }, { label: profitRequirement, met: completion.forecastProfitable }], tab: 'development' },
  ];
  const cashBurn = Math.max(0, -outlook.cashChange.min);
  const runway = cashBurn > 0 ? Math.max(0, state.cash) / cashBurn : null;
  // This reserve is advice, never an action prerequisite.
  const reserve = Math.max(0, forecast.revenue - forecast.operatingProfit + forecast.interest + forecast.loanRepayment) * 4;
  const districts = Object.entries(DISTRICTS).map(([id, district]) => ({ id, name: district.name, stores: state.stores.filter(s => LOTS.find(l => l.id === s.lotId)?.district === id).length }));
  const positiveProfits = forecast.storeResults.filter(s => s.profit > 0);
  const storeProfitTotal = positiveProfits.reduce((n, s) => n + s.profit, 0);
  const biggest = [...positiveProfits].sort((a, b) => b.profit - a.profit)[0];
  const concentration = biggest && storeProfitTotal > 0 ? biggest.profit / storeProfitTotal : 0;
  const unmanaged = state.stores.filter(s => !s.manager).length;
  const lossStores = forecast.storeResults.filter(s => s.profit < 0).length;
  // Suggested milestone order is not an engine gate. Direct ownership remains
  // a district-development condition, without making it a step before IPO.
  const next = roadmap.find(s => !s.achieved && !s.optionalBeforeIPO);
  const capital: CapitalFocus | null = !state.listed && state.stores.length >= 3
    ? { kind: 'ipo', title: '上場の条件と調達案を確認', eligible: summary.ipoEligible, tab: 'finance' }
    : state.stores.length < 3 && nextLot ? { kind: 'investment', title: 'テイクアウト店の比較例', cost: openingCost, tab: 'city' }
    : acquisition ? { kind: 'investment', title: acquisition.name, cost: acquisition.price, tab: 'group' }
    : nextMarketTarget ? { kind: 'investment', title: `${nextMarketTarget.name}（自主運営・必要調査込み）`, cost: nextMarketTarget.upfrontCost + (nextMarketTarget.researched ? 0 : nextMarketTarget.researchCost), tab: 'stocks' }
    : null;
  const recommendations: { title: string; body: string; tab: string; urgent?: boolean }[] = [];
  if (outlook.risk.debtLossPossible) recommendations.push({ title: '借入中の利益不足に注意', body: `今週の利益見込みは ${rangeYen(outlook.netProfit)}。幅の下限では利益がゼロ以下になる可能性があります。借入中に週末の実績利益がゼロ以下になると倒産します。赤字店舗・契約費用・利息を確認し、返済も検討してください。`, tab: 'finance', urgent: true });
  if (outlook.risk.cashShortfallPossible) recommendations.push({ title: '週末に現金が不足するおそれ', body: `週末の現金見込みは ${rangeYen(outlook.cashAfter)}。幅の下限では資金不足となる可能性があります。支出と返済を確認し、資産売却などで現金を確保しましょう。`, tab: 'finance', urgent: true });
  if (lossStores > 0) recommendations.push({ title: `基準見込みで赤字の${lossStores}店舗を見直す`, body: '価格・品質・人員・販促を一つずつ調整し、週次の利益見込み幅を比較しましょう。実績は週末に確定します。', tab: 'stores' });
  if (unmanaged >= 3) recommendations.push({ title: `${unmanaged}店舗を手動で管理中`, body: '手動管理が3店舗を超えると経営者の管理負荷で運営能力（来店対応上限）が下がります。店長は管理負荷を減らし、価格・人員・販促を調整します。週額費用も含めて導入後の利益見込み幅を比較しましょう。', tab: 'stores' });
  if (summary.ipoEligible) recommendations.push({ title: '上場条件を満たしています', body: '公開する場合の調達資金と創業者持分を比較できます。公開せず、今の運営を続けることも選べます。', tab: 'group' });
  const readyDevelopment = programs.find(p => p.choices.some(c => c.unlocked) && p.remainingWeeks === 0 && p.phase < 3);
  if (readyDevelopment && recommendations.length < 2) recommendations.push({ title: `${readyDevelopment.name}の次期開発を比較`, body: '着工できる計画があります。完成後の需要・賃貸収入と維持費を比較し、投資先を選びましょう。', tab: 'development' });
  if (state.listed && !allMarketOperating && recommendations.length < 2) recommendations.push({ title: '市場の企業を、次の事業に', body: `現在 ${marketGroup.operating} 事業が稼働中。株式市場の「友好的買収」で調査と取得条件を比較しましょう。`, tab: 'stocks' });
  if (!recommendations.length && next) recommendations.push({ title: next.title, body: next.description, tab: next.tab });
  return { summary, forecast, outlook, roadmap, next, runway, reserve, districts, concentration, unmanaged, capital, recommendations };
}
