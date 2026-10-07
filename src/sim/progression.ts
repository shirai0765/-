import { formatReputation } from '../format';
import type { GameState } from '../model';
import { ACQUISITION_TARGETS, DISTRICTS, LOTS } from '../data/district';
import { STOCKS } from '../data/stocks';
import { getMarketAcquisitionTargets, getMarketGroupFinancials } from './marketAcquisitions';
import { getDevelopmentPrograms } from './development';
import { evaluateSite, getSummary, getWeekOutlook } from './engine';
import { getCampaignCompletion } from './campaign';

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
export interface RoadmapStep { id: string; title: string; description: string; achieved: boolean; requirements: { label: string; met: boolean }[]; tab: string; optionalBeforeIPO?: boolean }
export type CapitalFocus =
  | { kind: 'ipo'; title: string; eligible: boolean; tab: string }
  | { kind: 'investment'; title: string; cost: number; tab: string };
/** Live operating goals plus the saved final achievement; no extra unlocks. */
export function getProgression(state: GameState) {
  const marketGroup = getMarketGroupFinancials(state);
  const nextMarketTarget = getMarketAcquisitionTargets(state).filter(t => t.status !== 'owned' && t.status !== 'integrating').sort((a, b) => a.upfrontCost - b.upfrontCost)[0];
  const allMarketOperating = marketGroup.operating === STOCKS.length && marketGroup.integrating === 0;
  const programs = getDevelopmentPrograms(state);
  const activeCompletedDistricts = programs.filter(p => p.phase === 3 && p.active).length;
  const suspendedDistricts = programs.filter(p => p.phase > 0 && !p.active);
  const summary = getSummary(state);
  const outlook = getWeekOutlook(state);
  const forecast = outlook.expected;
  const completion = getCampaignCompletion(state);
  const ipoLabels = [
    `店舗数 ${state.stores.length} / 3 店`,
    `累計黒字 ${state.profitableWeeks} / 12 週`,
    `純資産 ${yen(summary.netWorth)} / ${yen(20_000_000)}`,
    state.lastReport ? `直近の決算が黒字（第${state.lastReport.week}週）：${yen(state.lastReport.netProfit)}` : '直近の決算が黒字：営業実績はまだありません',
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
  const requirements = (price: number, reputation?: number) => [{ label: `手元資金 ${yen(state.cash)} / ${yen(price)}`, met: state.cash >= price }, ...(reputation === undefined ? [] : [{ label: `信用 ${formatReputation(state.reputation)} / ${reputation}`, met: state.reputation >= reputation }])];
  const roadmap: RoadmapStep[] = [
    { id: 'cafe', title: '渋谷の一杯から', description: '街で空き区画を選び、最初の店を開きましょう。', achieved: state.stores.length >= 1, requirements: [{ label: `${state.stores.length} / 1 店舗を運営`, met: state.stores.length >= 1 }, ...requirements(openingCost)], tab: 'city' },
    { id: 'chain', title: '3店舗のチェーンへ', description: '収支を整え、立地と客層の異なる店舗を育てます。', achieved: state.stores.length >= 3, requirements: [{ label: `${state.stores.length} / 3 店舗を運営`, met: state.stores.length >= 3 }], tab: 'stores' },
    { id: 'property', title: '街のオーナーになる', description: '物件購入は任意の投資で、上場の必須条件ではありません。地区開発には対象地区の直接保有物件が必要です。自店の家賃削減か、賃貸収入か。物件ごとの収益を比較。', achieved: state.properties.length > 0, requirements: [{ label: `${state.properties.length} / 1 物件を直接保有`, met: state.properties.length > 0 }, ...(nextProperty ? requirements(nextProperty.purchasePrice) : [])], tab: 'finance', optionalBeforeIPO: true },
    { id: 'ipo', title: '株式公開で次の規模へ', description: '3店舗以上・累計12週の黒字・純資産2,000万円以上・直近の決算が黒字であることが公開条件です。店長や物件購入は必須ではありません。公開後は増資と配当を選択します。', achieved: state.listed, requirements: ipoRequirements, tab: 'group' },
    { id: 'group', title: '複数事業を束ねる会社へ', description: '飲食と不動産の子会社を保有する経営目標。鉄道買収の必須条件ではありません。', achieved: hasFood && hasPropertyCompany, requirements: [{ label: '飲食の子会社を保有', met: hasFood }, { label: '不動産の子会社を保有', met: hasPropertyCompany }], tab: 'group' },
    { id: 'rail', title: '鉄道と沿線の未来へ', description: '鉄道事業を買収し、街を支える企業グループへ。', achieved: hasRail, requirements: rail ? requirements(rail.price, rail.minReputation) : [], tab: 'group' },
    { id: 'districts', title: '4地区の未来をつくる', description: '各地区で3工程を完成させ、直接保有物件を維持して稼働させる長期目標。最後の物件を売ると稼働が止まりますが、完成済みの工程は残り、再取得で再開します。', achieved: activeCompletedDistricts === programs.length, requirements: programs.map(p => ({ label: `${p.name}：${p.phase} / 3 工程完了・${p.active ? '直接保有物件あり' : '直接保有物件なし。街で物件を取得してください'}`, met: p.phase === 3 && p.active })), tab: 'development' },
    { id: 'portfolio', title: 'すべての事業をグループへ', description: '飲食・不動産・鉄道の全買収候補を傘下に迎える長期目標。', achieved: acquiredTargets === ACQUISITION_TARGETS.length, requirements: [{ label: `${acquiredTargets} / ${ACQUISITION_TARGETS.length} 社を買収`, met: acquiredTargets === ACQUISITION_TARGETS.length }], tab: 'group' },
    { id: 'market-group', title: '100の事業を動かす企業へ', description: '市場の全企業・投資法人を友好的に取得し、引継ぎを完了。経営調査と運営方式の選択を重ねます。', achieved: allMarketOperating, requirements: [{ label: `${marketGroup.operating} / ${STOCKS.length} 社・投資法人が稼働`, met: allMarketOperating }, { label: `引継ぎ中 ${marketGroup.integrating} 件`, met: marketGroup.integrating === 0 }], tab: 'stocks' },
    { id: 'campaign', title: '街と企業の成長を結実させる', description: completion.achievement ? `第${completion.achievement.week}週の黒字決算で最終目標を達成しました。達成記録は残り、この会社の経営を続けられます。` : '上場・既存8社と市場100事業の取得・全地区開発が稼働する週を黒字で決算し、非負の現金とともに達成記録を保存する最終目標。全物件の所有や沿線共同開発は必須ではありません。', achieved: completion.complete, requirements: [{ label: '株式公開を達成', met: state.listed }, { label: `全 ${ACQUISITION_TARGETS.length} 社を傘下に保有`, met: acquiredTargets === ACQUISITION_TARGETS.length }, { label: `市場 ${STOCKS.length} 事業の引継ぎを完了`, met: allMarketOperating }, ...programs.map(p => ({ label: `${p.name}：3工程完了・${p.active ? '稼働中' : '直接保有物件を取得して稼働を再開'}`, met: p.phase === 3 && p.active })), { label: '会社が継続し、現金が非負', met: completion.continuing }, { label: '全事業と全地区が稼働する週の黒字決算を保存', met: completion.complete }], tab: 'development' },
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
  const lossStores = state.lastReport?.storeResults.filter(result => result.profit < 0 && state.stores.some(store => store.id === result.id)).length ?? 0;
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
  if (outlook.risk.debtLossPossible) recommendations.push({ title: '借入中の利益不足に注意', body: '営業結果によって利益がゼロ以下になる可能性があります。借入中に週末の実績利益がゼロ以下になると倒産します。直近の実績・契約費用・利息を確認し、返済も検討してください。', tab: 'finance', urgent: true });
  if (outlook.risk.cashShortfallPossible) recommendations.push({ title: '週末に現金が不足するおそれ', body: '週末の支払いで現金が不足する可能性があります。現在の資金と支出・返済を確認し、必要なら投資の見送りや資産売却を検討してください。', tab: 'finance', urgent: true });
  if (lossStores > 0) recommendations.push({ title: `直近の決算で赤字だった${lossStores}店舗を見直す`, body: `第${state.lastReport!.week}週に赤字だった営業中の店舗です。確定した売上・費用を読み、価格・品質・人員・販促を見直せます。変更後の結果は次の決算で確認しましょう。`, tab: 'stores' });
  if (unmanaged >= 3) recommendations.push({ title: `${unmanaged}店舗を手動で管理中`, body: '手動管理が3店舗を超えると経営者の管理負荷で運営能力（来店対応上限）が下がります。店長は管理負荷を減らし、価格・人員・販促を調整します。店長の週額費用と対応枠を確認し、導入後は実際の決算を振り返りましょう。', tab: 'stores' });
  if (summary.ipoEligible) recommendations.push({ title: '上場条件を満たしています', body: '公開する場合の調達資金と創業者持分を比較できます。公開せず、今の運営を続けることも選べます。', tab: 'group' });
  if (suspendedDistricts.length) recommendations.push({ title: '地区の稼働を再開する', body: `${suspendedDistricts.map(p => p.name).join('・')}には直接保有物件がありません。街で各地区の物件を1件以上取得すると、完成済みの開発が稼働を再開します。${completion.complete ? '達成記録は残っています。地区の稼働を戻して経営を続けられます。' : '全地区が稼働する黒字決算で最終目標を達成できます。'}`, tab: 'city' });
  const readyDevelopment = programs.find(p => p.choices.some(c => c.unlocked) && p.remainingWeeks === 0 && p.phase < 3);
  if (readyDevelopment && recommendations.length < 2) recommendations.push({ title: `${readyDevelopment.name}の次期開発を比較`, body: '着工できる計画があります。完成後の需要・賃貸収入と維持費を比較し、投資先を選びましょう。', tab: 'development' });
  if (state.listed && !allMarketOperating && recommendations.length < 2) recommendations.push({ title: '市場の企業を、次の事業に', body: `現在 ${marketGroup.operating} 事業が稼働中。株式市場の「友好的買収」で調査と取得条件を比較しましょう。`, tab: 'stocks' });
  if (!completion.complete && completion.readyToSettle && recommendations.length < 2) recommendations.push({ title: '全事業の営業を決算で確認', body: '所有と開発の条件がそろいました。全事業と全地区が稼働する週の営業を終了し、実際の黒字と決算後の現金を確認すると達成記録が残ります。', tab: 'city' });
  if (!recommendations.length && next) recommendations.push({ title: next.title, body: next.description, tab: next.tab });
  return { summary, forecast, outlook, roadmap, next, runway, reserve, districts, concentration, unmanaged, capital, recommendations, completion, suspendedDistricts };
}
