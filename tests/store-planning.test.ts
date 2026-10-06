import { describe, expect, it } from 'vitest';
import { LOTS } from '../src/data/district';
import { applyAction, createGame, previewWeek } from '../src/sim/engine';
import { getStoreOpeningPlans } from '../src/sim/storePlanning';

const sites = LOTS.filter(lot => lot.available).sort((a, b) => a.rent - b.rent);

describe('cash-funded store planning', () => {
  it('compares each executable opening including capital cash separately from weekly profit, without mutation', () => {
    const state = createGame();
    const original = structuredClone(state);
    for (const plan of getStoreOpeningPlans(state, sites[0].id)) {
      const opened = applyAction(state, { type: 'openStore', lotId: sites[0].id, style: plan.style });
      expect(plan.available).toBe(true);
      expect(plan.after).toEqual(previewWeek(opened));
      expect(plan.cashAfter).toBe(opened.cash);
      expect(plan.cashAfter).toBe(state.cash - plan.openingCost!);
      expect(plan.after!.cashChange).toBe(plan.after!.netProfit);
    }
    expect(state).toEqual(original);
  });

  it('marks unaffordable and illegal sites unavailable instead of forecasting a fabricated funded state', () => {
    const state = createGame(); state.cash = 3_000_000;
    const plans = getStoreOpeningPlans(state, sites[0].id);
    expect(plans.find(plan => plan.style === 'takeaway')!.available).toBe(true);
    expect(plans.find(plan => plan.style === 'premium')).toMatchObject({ available: false, cashAfter: null, after: null });
    expect(plans.find(plan => plan.style === 'premium')!.reason).toContain('現預金');
    expect(getStoreOpeningPlans(state, 'missing').every(plan => !plan.available && plan.after === null)).toBe(true);
    const opened = applyAction(state, { type: 'openStore', lotId: sites[0].id, style: 'takeaway' });
    expect(getStoreOpeningPlans(opened, sites[0].id).every(plan => !plan.available && plan.reason.includes('出店'))).toBe(true);
  });

  it('accounts for fourth-store management strain, head office, and existing store losses in the company delta', () => {
    let state = createGame(); state.cash = 50_000_000;
    for (const site of sites.slice(0, 3)) state = applyAction(state, { type: 'openStore', lotId: site.id, style: 'standard' });
    const plan = getStoreOpeningPlans(state, sites[3].id).find(plan => plan.style === 'standard')!;
    const newStore = plan.after!.storeResults.find(result => !state.stores.some(store => store.id === result.id))!;
    expect(plan.founderCapacity).toBeLessThan(1);
    expect(plan.overheadDelta).toBeGreaterThan(0);
    expect(plan.existingStoreProfitDelta).toBeLessThan(0);
    expect(plan.netProfitDelta).toBe(newStore.profit + plan.existingStoreProfitDelta! - plan.overheadDelta!);
    expect(plan.netProfitDelta).toBeLessThan(newStore.profit);
  });

  it('warns on debt-funded operating loss even with plenty of cash', () => {
    let state = applyAction(createGame(), { type: 'openStore', lotId: sites[0].id, style: 'standard' });
    state = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { staff: 30 } });
    state = applyAction(state, { type: 'borrow', amount: 1_000_000, weeks: 52 });
    const plan = getStoreOpeningPlans(state, sites[1].id)[0];
    expect(plan.available).toBe(true);
    expect(plan.cashAfter).toBeGreaterThan(1_000_000);
    expect(plan.after!.netProfit).toBeLessThanOrEqual(0);
    expect(plan.debtProfitRisk).toBe(true);
    expect(plan.cashRisk).toBe(false);
  });

  it('keeps repayment-driven cash shortage distinct from positive company profit', () => {
    let state = applyAction(createGame(), { type: 'openStore', lotId: sites[0].id, style: 'standard' });
    state = applyAction(state, { type: 'borrow', amount: 5_000_000, weeks: 13 });
    state.cash = 3_000_000;
    const plan = getStoreOpeningPlans(state, sites[1].id).find(plan => plan.style === 'takeaway')!;
    expect(plan.available).toBe(true);
    expect(plan.cashAfter).toBe(0);
    expect(plan.after!.netProfit).toBeGreaterThan(0);
    expect(plan.cashRisk).toBe(true);
    expect(plan.debtProfitRisk).toBe(false);
  });
});
