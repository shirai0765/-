/** Advisory human-time budget, NOT a simulation result, completion gate or timer.
 * Run: npx vite-node scripts/campaign-budget.ts
 * No state mutations, economic changes or runtime dependencies. */
export interface CampaignStageBudget {
  id: string;
  title: string;
  meaningfulDecisions: number;
  assumedMinutesPerDecision: number;
  assumedInspectionMinutes: number;
  decisionExamples: string[];
}
export const CAMPAIGN_STAGES: readonly CampaignStageBudget[] = [
  { id: 'founding', title: '創業・最初の利益', meaningfulDecisions: 12, assumedMinutesPerDecision: 4, assumedInspectionMinutes: 12, decisionExamples: ['候補立地と店舗形式の比較', '品質・価格・人員の組合せ', '初期営業提案の調査と採否'] },
  { id: 'ipo', title: 'チェーン・店長・IPO', meaningfulDecisions: 18, assumedMinutesPerDecision: 4, assumedInspectionMinutes: 18, decisionExamples: ['競合を含む出店比較', '店長委任と本部負担', '借入とIPOの資本計画'] },
  { id: 'property', title: '物件・地区開発の基盤', meaningfulDecisions: 50, assumedMinutesPerDecision: 5, assumedInspectionMinutes: 50, decisionExamples: ['自用と賃貸の比較', '地区計画の用途・規模・資金配分', '工事と既存店舗の営業計画'] },
  { id: 'group', title: '企業グループ・買収統合', meaningfulDecisions: 60, assumedMinutesPerDecision: 5, assumedInspectionMinutes: 90, decisionExamples: ['買収順序と統合方式', 'グループ横断の調達・品質投資', '希薄化・配当・投資余力の配分'] },
  { id: 'rail', title: '鉄道・沿線の成長', meaningfulDecisions: 70, assumedMinutesPerDecision: 5.5, assumedInspectionMinutes: 95, decisionExamples: ['沿線地区への商業・住宅・交通投資', '安全な利益余力を残す更新計画', '他事業との需要・混雑の調整'] },
  { id: 'completion', title: '全社取得・街の完成', meaningfulDecisions: 70, assumedMinutesPerDecision: 5.5, assumedInspectionMinutes: 95, decisionExamples: ['未取得企業と未完成地区の優先順位', '不振資産の再編と事業の安定化', '完成形を比較する最終資本配分'] },
];
const PACES = {
  brisk: { decisionMultiplier: .6, inspectionMultiplier: .5 },
  designBaseline: { decisionMultiplier: 1, inspectionMultiplier: 1 },
  considered: { decisionMultiplier: 1.5, inspectionMultiplier: 1.4 },
} as const;
export function campaignBudget(pace: keyof typeof PACES = 'designBaseline') {
  const p = PACES[pace]; let cumulativeMinutes = 0;
  const stages = CAMPAIGN_STAGES.map(stage => {
    const decisionMinutes = stage.meaningfulDecisions * stage.assumedMinutesPerDecision * p.decisionMultiplier;
    const inspectionMinutes = stage.assumedInspectionMinutes * p.inspectionMultiplier;
    cumulativeMinutes += decisionMinutes + inspectionMinutes;
    return { ...stage, decisionMinutes, inspectionMinutes, stageHours: (decisionMinutes + inspectionMinutes) / 60, cumulativeHours: cumulativeMinutes / 60 };
  });
  return { kind: 'unvalidated-design-assumptions', pace, meaningfulDecisions: stages.reduce((sum, s) => sum + s.meaningfulDecisions, 0), targetHours: cumulativeMinutes / 60, ipoHours: stages[1].cumulativeHours, stages };
}
const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
if (!runtime.process?.env?.VITEST) console.log(JSON.stringify({
  warning: 'Design budget only. Human playtime and 280 meaningful choices have NOT been measured or implemented.',
  currentMeasuredGameWeeks: { source: 'docs/campaign-report.md, seeds 1–8', allEightAcquisitions: [317, 417], longestInvestmentGap: [96, 208], ipo: 21 },
  scenarios: Object.keys(PACES).map(p => campaignBudget(p as keyof typeof PACES)),
}, null, 2));
