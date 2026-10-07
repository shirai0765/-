import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FinancialServicesPanel from '../src/ui/FinancialServicesPanel';
import CapitalPlanningPanel from '../src/ui/CapitalPlanningPanel';
import { applyAction, createGame } from '../src/sim/engine';

describe('physical financial service destinations', () => {
  it('opens a staged bank quote without borrowing or offering stock issuance', () => {
    const state = createGame('街の銀行を訪ねる', 1);
    const before = JSON.stringify(state);
    let actions = 0;
    const html = renderToStaticMarkup(<FinancialServicesPanel kind="bank" state={state} onAction={() => { actions++; }} onMarket={() => actions++}/>);
    expect(html).toContain('借入希望額（円）');
    expect(html).toContain('この条件で融資審査する');
    expect(html).toContain('data-loan-step="quote"');
    expect(html).not.toContain('data-loan-confirm');
    expect(html).toContain('10万円');
    expect(html).toContain('100万円');
    expect(html).toContain('300万円');
    expect(html).toContain('500万円');
    expect(html).toContain('契約の年利');
    expect(html).toContain('4.50%');
    expect(html).toContain('追加の初週利息');
    expect(html).toContain('利息総額 / 満期まで');
    expect(html).toContain('返済総額（元本＋利息）');
    expect(html).toContain('調達直後の手元資金');
    expect(html).toContain('¥15,000,000');
    expect(html).not.toContain('株式公開する');
    expect(html).not.toContain('今週の利益幅');
    expect(html).not.toContain('週末の現金の幅');
    expect(JSON.stringify(state)).toBe(before);
    expect(actions).toBe(0);
  });

  it('takes a young company directly to listing requirements and market entrances', () => {
    const state = createGame('証券市場を訪ねる', 2);
    const before = JSON.stringify(state);
    const html = renderToStaticMarkup(<FinancialServicesPanel kind="exchange" state={state} onAction={() => { throw new Error('No automatic listing'); }} onMarket={() => { throw new Error('No automatic purchase'); }}/>);
    expect(html).toContain('営業中 0 / 3店舗');
    expect(html).toContain('累計黒字 0 / 12週');
    expect(html).toContain('上場までの準備');
    expect(html).toContain('直近の決算が黒字：営業実績は未記録');
    expect(html).not.toContain('現在の営業計画が黒字');
    expect(html).toContain('他社の株式に投資する');
    expect(html).toContain('企業の買収を検討する');
    expect(html).not.toContain('借入希望額（円）');
    expect(html).not.toContain('不足額を借入希望額へ');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('shows an existing loan and its remaining principal without changing it', () => {
    const state = applyAction(createGame('返済を確認', 3), { type: 'borrow', amount: 100_000, weeks: 52 });
    const html = renderToStaticMarkup(<FinancialServicesPanel kind="bank" state={state} onAction={() => { throw new Error('No automatic repayment'); }} onMarket={() => {}}/>);
    expect(html).toContain('一括返済');
    expect(html).toContain('残り52週');
    expect(state.loans[0].remaining).toBe(100_000);
    expect(state.cash).toBe(12_100_000);
  });

  it('funding a café exposes transaction amounts, not an operating profit answer', () => {
    const state = createGame('出店資金の比較', 4);
    const html = renderToStaticMarkup(<CapitalPlanningPanel state={state} onAction={() => {}} onReturnToInvestment={() => {}} planningContext={{ id: 'site-plan', label: '駅前のカフェ', spending: 3_600_000, returnLabel: '出店へ戻る' }}/>);
    expect(html).toContain('出店へ戻る');
    expect(html).toContain('¥8,400,000');
    for (const label of ['営業利益の幅', '利息控除後の利益幅', '現金増減の幅', '週末の手元資金の幅', '今週の利益幅']) expect(html).not.toContain(label);
    expect(state.week).toBe(1);
    expect(state.stores).toHaveLength(0);
  });
});
