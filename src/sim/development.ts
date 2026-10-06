import type { DevelopmentChoice, DevelopmentProgram, DistrictId, GameState } from '../model';
import { DISTRICTS, LOTS } from '../data/district';
const districtIds = Object.keys(DISTRICTS) as DistrictId[];
const districtOf = (lotId: string) => LOTS.find(l => l.id === lotId)?.district;
export const DEVELOPMENT_CHOICES: readonly DevelopmentChoice[] = districtIds.flatMap((districtId, districtIndex) => [0, 1, 2].flatMap(phase => [
  { id: `${districtId}-${phase}-commerce`, districtId, phase, name: ['歩行者とカフェの回遊整備', '商業動線と滞在空間', '沿線商業の共同拠点'][phase], description: '店舗へ来る人を増やす商業計画。既に満席の店では、人員・設備・価格の再検討が必要です。', cost: [2400000, 6500000, 18000000][phase] * (1 + districtIndex * .05), weeks: [3, 6, 10][phase], weeklyUpkeep: [4000, 8000, 16000][phase], cafeDemandBonus: [.06, .09, .12][phase], propertyYieldBonus: [.01, .015, .02][phase] },
  { id: `${districtId}-${phase}-property`, districtId, phase, name: ['賃貸共用部と生活環境', 'オフィス・住宅の共同設備', '複合不動産の地域拠点'][phase], description: '地区内の外部賃貸物件の収入を改善。自用物件だけでは追加賃料は生まれません。', cost: [3000000, 8000000, 22000000][phase] * (1 + districtIndex * .05), weeks: [4, 7, 12][phase], weeklyUpkeep: [2500, 5000, 10000][phase], cafeDemandBonus: [.01, .015, .02][phase], propertyYieldBonus: [.06, .10, .15][phase] },
])).map(choice => ({ ...choice, cost: Math.round(choice.cost) }));
const choiceFor = (id: string) => DEVELOPMENT_CHOICES.find(c => c.id === id);
const ownedIn = (s: GameState, id: DistrictId) => s.properties.some(p => districtOf(p.lotId) === id);
function rowFor(s: GameState, id: DistrictId): DevelopmentProgram { return s.development?.programs.find(p => p.districtId === id) ?? { districtId: id, completedChoiceIds: [] }; }
function effectiveChoices(s: GameState, p: DevelopmentProgram) {
  const ids = [...p.completedChoiceIds];
  if (p.construction && s.week >= p.construction.completeWeek) ids.push(p.construction.choiceId);
  return ids.map(id => choiceFor(id)!).filter(Boolean);
}
export function getDevelopmentEffects(s: GameState, districtId: DistrictId) {
  if (!ownedIn(s, districtId)) return { cafeDemandBonus: 0, propertyYieldBonus: 0, weeklyUpkeep: 0 };
  const choices = effectiveChoices(s, rowFor(s, districtId));
  return { cafeDemandBonus: Math.min(.3, choices.reduce((n, c) => n + c.cafeDemandBonus, 0)), propertyYieldBonus: Math.min(.35, choices.reduce((n, c) => n + c.propertyYieldBonus, 0)), weeklyUpkeep: choices.reduce((n, c) => n + c.weeklyUpkeep, 0) };
}
export function getDevelopmentFinancials(s: GameState) {
  const weeklyUpkeep = districtIds.reduce((n, id) => n + getDevelopmentEffects(s, id).weeklyUpkeep, 0);
  const bookValue = (s.development?.programs ?? []).reduce((n, p) => n + [...p.completedChoiceIds, ...(p.construction ? [p.construction.choiceId] : [])].reduce((sum, id) => sum + (choiceFor(id)?.cost ?? 0) * .5, 0), 0);
  return { weeklyUpkeep, bookValue: Math.round(bookValue) };
}
export interface DevelopmentProgramView {
  districtId: DistrictId; name: string; phase: number; status: 'available' | 'locked' | 'building' | 'complete' | 'suspended'; remainingWeeks: number;
  choices: (DevelopmentChoice & { unlocked: boolean; reason: string })[];
  effects: ReturnType<typeof getDevelopmentEffects>; active: boolean;
}
export function getDevelopmentPrograms(s: GameState): DevelopmentProgramView[] {
  return districtIds.map(districtId => {
    const row = rowFor(s, districtId), phase = row.completedChoiceIds.length, active = ownedIn(s, districtId);
    const reason = s.gameOver ? 'ゲームは終了しています。' : row.construction ? '現在の工事が完了してから次の段階へ進めます。' : phase >= 3 ? '地区計画は完成しています。' : !active ? 'この地区に物件を1件以上保有してください。' : !s.stores.length ? '最初の店舗を開いてください。' : phase >= 1 && !s.listed ? '第2段階以降には上場が必要です。' : s.reputation < [15, 35, 60][phase] ? `信用${[15, 35, 60][phase]}以上が必要です。` : '';
    return { districtId, name: DISTRICTS[districtId].name, phase, active, status: row.construction ? 'building' : !active && phase > 0 ? 'suspended' : phase >= 3 ? 'complete' : reason ? 'locked' : 'available', remainingWeeks: row.construction ? Math.max(0, row.construction.completeWeek - s.week) : 0,
      choices: DEVELOPMENT_CHOICES.filter(c => c.districtId === districtId && c.phase === phase).map(c => ({ ...c, unlocked: !reason && s.cash >= c.cost, reason: reason || (s.cash < c.cost ? '初期投資に必要な現預金が不足しています。' : '') })), effects: getDevelopmentEffects(s, districtId) };
  });
}
export function startDevelopment(state: GameState, districtId: DistrictId, choiceId: string): GameState {
  const program = getDevelopmentPrograms(state).find(p => p.districtId === districtId);
  const choice = program?.choices.find(c => c.id === choiceId);
  if (!choice) throw new Error('この地区・段階では選べない開発計画です。');
  if (!choice.unlocked) throw new Error(choice.reason);
  const s = structuredClone(state); s.development ??= { programs: [] };
  let row = s.development.programs.find(p => p.districtId === districtId);
  if (!row) { row = { districtId, completedChoiceIds: [] }; s.development.programs.push(row); }
  s.cash -= choice.cost;
  row.construction = { choiceId, startWeek: s.week, completeWeek: s.week + choice.weeks };
  return s;
}
/** A funded project finishes in game weeks. No cash debit here; the engine settles upkeep once. */
export function tickDevelopment(state: GameState): GameState {
  const s = structuredClone(state);
  for (const p of s.development?.programs ?? []) if (p.construction && s.week >= p.construction.completeWeek) {
    p.completedChoiceIds.push(p.construction.choiceId); delete p.construction;
  }
  return s;
}
export function developmentHeadlines(s: GameState): string[] {
  return (s.development?.programs ?? []).filter(p => p.construction && s.week === p.construction.completeWeek).map(p => `${DISTRICTS[p.districtId].name}の「${choiceFor(p.construction!.choiceId)!.name}」が完成。${ownedIn(s, p.districtId) ? '今週から効果と維持費を反映します。' : '保有物件がないため運営は休止中です。'}`);
}
