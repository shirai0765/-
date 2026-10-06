import type { DistrictId, GameState, RailProjectChoiceId } from '../model';
import { DISTRICTS, LOTS } from '../data/district';
import { getDevelopmentEffects } from './development';

export interface RailProjectChoice {
  id: RailProjectChoiceId; name: string; description: string;
  cost: number; weeks: number; weeklyUpkeep: number; cafeDemandBonus: number; propertyYieldBonus: number;
}
/** Authored project costs, not quoted rail-company returns. One mutually exclusive choice per district. */
export const RAIL_PROJECT_CHOICES: readonly RailProjectChoice[] = [
  { id: 'commerce', name: '駅前回遊・商業パートナー', description: '駅から地区の店舗へ歩く動線を整備。自社店舗の需要を増やします。満席の店では利益が増えないことがあります。', cost: 6_000_000, weeks: 4, weeklyUpkeep: 6_000, cafeDemandBonus: .12, propertyYieldBonus: 0 },
  { id: 'rental', name: '駅近賃貸・生活パートナー', description: '駅を使う住民・働く人に向けた賃貸共同設備。地区内の直接保有する外部賃貸物件の収入を改善します。自用物件には追加賃料が生まれません。', cost: 8_000_000, weeks: 6, weeklyUpkeep: 4_000, cafeDemandBonus: 0, propertyYieldBonus: .16 },
];
const districtIds = Object.keys(DISTRICTS) as DistrictId[];
const ownedIn = (s: GameState, districtId: DistrictId) => s.properties.some(p => LOTS.find(l => l.id === p.lotId)?.district === districtId);
const projectIn = (s: GameState, districtId: DistrictId) => s.railProjects?.projects.find(p => p.districtId === districtId);
const choiceFor = (id: RailProjectChoiceId) => RAIL_PROJECT_CHOICES.find(c => c.id === id);

/** Incremental, additive bonuses: development + partnership never exceeds 40% demand / 50% rent. */
export function getRailProjectEffects(s: GameState, districtId: DistrictId) {
  const project = projectIn(s, districtId), choice = project && choiceFor(project.choiceId);
  if (!project || !choice || !ownedIn(s, districtId)) return { cafeDemandBonus: 0, propertyYieldBonus: 0, weeklyUpkeep: 0 };
  if (s.week < project.completeWeek) return { cafeDemandBonus: 0, propertyYieldBonus: 0, weeklyUpkeep: choice.weeklyUpkeep };
  const development = getDevelopmentEffects(s, districtId);
  return {
    cafeDemandBonus: Math.max(0, Math.min(choice.cafeDemandBonus, .4 - development.cafeDemandBonus)),
    propertyYieldBonus: Math.max(0, Math.min(choice.propertyYieldBonus, .5 - development.propertyYieldBonus)),
    weeklyUpkeep: choice.weeklyUpkeep,
  };
}

export function getRailProjectFinancials(s: GameState) {
  return {
    weeklyUpkeep: districtIds.reduce((sum, id) => sum + getRailProjectEffects(s, id).weeklyUpkeep, 0),
    bookValue: Math.round((s.railProjects?.projects ?? []).reduce((sum, p) => sum + (choiceFor(p.choiceId)?.cost ?? 0) * .5, 0)),
  };
}

export interface RailProjectView {
  districtId: DistrictId; name: string;
  status: 'available' | 'locked' | 'building' | 'operating' | 'suspended';
  choice?: RailProjectChoice; remainingWeeks: number;
  effects: ReturnType<typeof getRailProjectEffects>;
  options: (RailProjectChoice & { unlocked: boolean; reason: string })[];
}
export function getRailProjects(s: GameState): RailProjectView[] {
  return districtIds.map(districtId => {
    const project = projectIn(s, districtId), owned = ownedIn(s, districtId);
    const reason = s.gameOver ? 'ゲームは終了しています。' : project ? 'この地区では既に計画を選択済みです。' : !s.listed ? '上場後に共同開発を選べます。' : s.reputation < 45 ? '信用45以上が必要です。' : !owned ? 'この地区に物件を1件以上直接保有してください。' : '';
    return {
      districtId, name: DISTRICTS[districtId].name,
      status: project ? !owned ? 'suspended' : s.week < project.completeWeek ? 'building' : 'operating' : reason ? 'locked' : 'available',
      choice: project ? choiceFor(project.choiceId) : undefined,
      remainingWeeks: project ? Math.max(0, project.completeWeek - s.week) : 0,
      effects: getRailProjectEffects(s, districtId),
      options: project ? [] : RAIL_PROJECT_CHOICES.map(c => ({ ...c, unlocked: !reason && s.cash >= c.cost, reason: reason || (s.cash < c.cost ? '着工費を支払う現預金が不足しています。' : '') })),
    };
  });
}

export function startRailProject(state: GameState, districtId: DistrictId, choiceId: RailProjectChoiceId): GameState {
  const option = getRailProjects(state).find(p => p.districtId === districtId)?.options.find(c => c.id === choiceId);
  if (!option) throw new Error('この地区・計画では着工できません。既存計画の変更・重複着工はできません。');
  if (!option.unlocked) throw new Error(option.reason);
  const s = structuredClone(state);
  s.cash = Math.round(s.cash - option.cost);
  s.railProjects ??= { projects: [] };
  s.railProjects.projects.push({ districtId, choiceId, startWeek: s.week, completeWeek: s.week + option.weeks });
  return s;
}

/** The engine settles this exact current-week state; no hidden construction debit or future projection. */
export function railProjectHeadlines(s: GameState): string[] {
  return (s.railProjects?.projects ?? []).filter(p => p.completeWeek === s.week).map(p =>
    `${DISTRICTS[p.districtId].name}の「${choiceFor(p.choiceId)!.name}」が完成。${ownedIn(s, p.districtId) ? '今週から共同開発の効果を反映します。' : '保有物件がないため運営は休止中です。'}`);
}
