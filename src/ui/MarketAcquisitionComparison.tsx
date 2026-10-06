import { X } from 'lucide-react';
import { STOCKS } from '../data/stocks';
import type { MarketAcquisitionMode } from '../model';
import type { getAcquisitionComparison, previewAcquisitionComparison } from '../sim/acquisitionComparison';
import './market-acquisition-comparison.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;


const rangeYen = (range: { min: number; max: number }) => `約${yen(Math.floor(range.min / 1000) * 1000)}〜${yen(Math.ceil(range.max / 1000) * 1000)}`;

export type AcquisitionComparisonRow = ReturnType<typeof getAcquisitionComparison> & {
  forecast: ReturnType<typeof previewAcquisitionComparison>;
};

export interface MarketAcquisitionComparisonProps {
  comparisons: AcquisitionComparisonRow[];
  cash: number;
  onClear: () => void;
  onRemove: (stockId: string) => void;
  onModeChange: (stockId: string, mode: MarketAcquisitionMode) => void;
  onOpenDetails: (stockId: string, mode: MarketAcquisitionMode) => void;
  onRequestFunding?: (stockId: string, mode: MarketAcquisitionMode) => void;
}

export default function MarketAcquisitionComparison({ comparisons, cash, onClear, onRemove, onModeChange, onOpenDetails, onRequestFunding }: MarketAcquisitionComparisonProps) {
  return <section className="ma-comparison ma-comparison--compact" aria-labelledby="ma-comparison-title">
    <header>
      <div><span className="eyebrow">COMPARE BEFORE YOU COMMIT</span><h3 id="ma-comparison-title">次の一社を比較 · {comparisons.length} / 3</h3></div>
      {comparisons.length > 0 && <button type="button" className="secondary" onClick={onClear}>比較をクリア</button>}
    </header>
    <p>候補の「比較に追加」で最大3社を並べられます。各案は現在の同じ資金・保有株から、単独で取得する場合の比較です。</p>
    {!comparisons.length && <p className="ma-comparison-empty">必要な現金、稼働までの期間、利益の幅から次の一社を選びましょう。</p>}
    <div className="ma-comparison-grid">{comparisons.map(row => {
      const { target, choice, forecast } = row;
      const cashGap = Math.max(0, row.remainingCashBudget - cash);
      return <article className="ma-comparison-card" key={target.stockId}>
        <header><h4>{target.name}</h4><button type="button" className="icon-button" aria-label={`${target.name}を比較から外す`} onClick={() => onRemove(target.stockId)}><X size={16}/></button></header>
        <p className="ma-comparison-status">{STOCKS.find(stock => stock.id === target.stockId)?.sector} · {target.researched ? `調査済み / ${target.quality}` : '未調査 / 品質は未確認'}</p>
        <label className="ma-comparison-mode">運営方式<select aria-label={`${target.name}の比較運営方式`} value={choice.mode} onChange={event => onModeChange(target.stockId, event.target.value as MarketAcquisitionMode)}>{target.choices.map(option => <option key={option.mode} value={option.mode}>{option.name}</option>)}</select></label>

        <dl className="ma-comparison-priorities">
          <div className="ma-comparison-cash"><dt>必要現金（準備費込み）</dt><dd>{yen(row.remainingCashBudget)}</dd><small>未払調査費・株式精算・稼働までの準備費を反映。一括の支払額ではありません。</small></div>
          <div><dt>稼働開始まで</dt><dd>{choice.leadWeeks}<small>週</small></dd></div>
          <div><dt>稼働後の利益レンジ / 週<span>{target.researched ? '調査済みの試算' : '未調査の暫定幅'}</span></dt><dd className="ma-comparison-profit-range">{yen(choice.weeklyProfitRange.min)}<span>〜 {yen(choice.weeklyProfitRange.max)}</span></dd><small>今週の利益ではありません。収益・回収を保証するものではありません。</small></div>
        </dl>
        {cashGap > 0 ? <p className="ma-comparison-cash-warning" role="alert">準備費を確保するには、現金が{yen(cashGap)}不足しています。</p> : <p className="ma-comparison-headroom">準備費を確保した後の現金余力：{yen(cash - row.remainingCashBudget)}</p>}

        <div className="ma-comparison-forecast">
          {forecast ? <><strong>今週、取得した場合</strong><p>取得直後の現金：{yen(forecast.cashAfter)}</p><p>全社の今週利益幅（利息後）：{rangeYen(forecast.outlook.netProfit)}</p><p>取得しない場合の利益幅：{rangeYen(forecast.beforeOutlook.netProfit)}</p><p>週末の現金の幅：{rangeYen(forecast.outlook.cashAfter)}</p>{forecast.lostDividends > 0 && <p>取得で終了する株式配当：{yen(forecast.lostDividends)} / 週</p>}<p className="ma-comparison-time-note">今週は引継ぎ費用を計上し、稼働後の利益を先取りしません。幅は千円単位の概数です。実績は週末に確定します。</p></> : <><strong>今週の取得予測は未計算</strong><p>{target.reason || '選択した方式の統合費を含む資金が不足しています。'}</p></>}
        </div>
        {forecast?.debtFailure && <p className="ma-comparison-risk" role="alert">借入残高があり、見込み幅の下限で利益（利息後）が0以下になります。実績が0以下なら倒産するリスクがあります。</p>}
        {forecast?.cashFailure && <p className="ma-comparison-risk" role="alert">見込み幅の下限で週末現金が不足します。実績によって資金不足になるリスクがあります。</p>}
        <p className="ma-comparison-commit-note">取得後の取消・運営方式の変更・通常売却はできません。株式売買・配当は終了します。</p>
        <div className="ma-comparison-actions">
          <button type="button" className="secondary" onClick={() => onOpenDetails(target.stockId, choice.mode)}>この案の調査・取得を確認</button>
          {onRequestFunding && <button type="button" className="secondary" onClick={() => onRequestFunding(target.stockId, choice.mode)}>この案の資金調達を比較</button>}
        </div>

        <details className="ma-comparison-details">
          <summary>費用・精算の内訳と変動幅</summary>
          <dl className="ma-comparison-metrics">
            <div><dt>調査費（{target.researched ? '支払済' : '未払'}）</dt><dd>{yen(target.researchCost)}</dd></div>
            <div><dt>買収評価額 / 統合費</dt><dd>{yen(target.quotePrice)} / {yen(choice.integrationCost)}</dd></div>
            <div><dt>引継ぎ準備費（{choice.leadWeeks}週分）</dt><dd>{yen(row.preparationReserve)}</dd></div>
            <div><dt>総投資額（調査・準備費込み）</dt><dd>{yen(row.totalProjectCost)}</dd></div>
            <div><dt>充当する保有株式の時価</dt><dd>{yen(target.quotePrice + choice.integrationCost - choice.upfrontCost + choice.refund)}</dd></div>
            <div><dt>取得時の支払 / 超過分の受取</dt><dd>{yen(choice.upfrontCost)} / {yen(choice.refund)}</dd></div>
            <div><dt>基準収益からの業績変動幅</dt><dd>最大約{Math.round(row.risk * 100)}%</dd></div>
          </dl>
          <p>金額はゲーム内の評価です。総投資額には支払済みの調査費も含め、必要現金では除外します。準備費は毎週の支払いに備える確保額で、他事業の収支や返済を含みません。</p>
          <p>稼働後の利益幅はモデル上の試算です。追加取得による既存事業の管理費増加も別途生じます。変動幅は倒産確率ではありません。</p>
        </details>
      </article>;
    })}</div>
  </section>;
}
