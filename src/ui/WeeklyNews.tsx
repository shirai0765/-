import type { WeeklyReport } from '../model';
import { STOCKS } from '../data/stocks';
import './weekly-news.css';

interface Props { report: WeeklyReport }
const price = (value: number) => `¥${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`;
const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const index = (value: number) => (value * 100).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Displays this saved settlement only, including when the report is reopened. */
export default function WeeklyNews({ report }: Props) {
  const news = report.news;
  if (!news) return <section className="weekly-news weekly-news-legacy" aria-label={`第${report.week}週のニュース`} data-news-week={report.week}>
    <p className="weekly-news-source">この保存データには市場ニュースの記録がありません。決算時に保存した出来事を表示します。</p>
    {report.headlines.length ? <ul className="weekly-news-legacy-list">{report.headlines.slice(0, 3).map((text, i) => <li key={i}>{text}</li>)}</ul>
      : <p>この週の出来事は記録されていません。</p>}
    {report.headlines.length > 3 && <details className="weekly-news-details"><summary>この週のほかの出来事</summary><ul>{report.headlines.slice(3).map((text, i) => <li key={i}>{text}</li>)}</ul></details>}
  </section>;

  const { current, previous } = news.city;
  const demandChange = previous ? (current.demand / previous.demand - 1) * 100 : null;
  const cityEvents = news.events.filter(event => event.category === 'city');
  const cityTitle = cityEvents.length ? '地区の開発が完成'
    : demandChange !== null && Math.abs(demandChange) > .001 ? `街のカフェ需要が前週より${demandChange > 0 ? '増加' : '減少'}`
      : '街のカフェ需要は基準並み';
  const marketTitle = news.market.advances > news.market.declines ? '上昇銘柄が下落銘柄を上回る'
    : news.market.advances < news.market.declines ? '下落銘柄が上昇銘柄を上回る' : '上昇と下落は同数';

  return <section className="weekly-news" aria-label={`第${news.week}週のニュース`} data-news-week={news.week}>
    <p className="weekly-news-source">ゲーム内 · 第{news.week}週に確定した街と市場の動き</p>
    <div className="weekly-news-cards">
      <article className="weekly-news-card" data-news-category="city" aria-label="街のニュース">
        <span className="weekly-news-category">街</span><h4>{cityTitle}</h4>
        {cityEvents.length > 0 && <p className="weekly-news-event">{cityEvents[0].text}</p>}
        <p>今週の街全体のカフェ需要{demandChange !== null ? <>は前週比 <strong>{percent(demandChange)}</strong>。</> : 'は開始時の水準でした。'}</p>
        <details className="weekly-news-details"><summary>この週の営業環境{cityEvents.length > 1 ? `・ほか${cityEvents.length - 1}件の完成` : ''}</summary>
          <p>開始時を100とした水準です。店ごとの客足には立地や運営状況も影響します。</p>
          <dl className="weekly-news-conditions"><div><dt>カフェ需要</dt><dd>{index(current.demand)}</dd></div><div><dt>人件費</dt><dd>{index(current.wages)}</dd></div><div><dt>賃料</dt><dd>{index(current.rents)}</dd></div></dl>
          {cityEvents.length > 1 && <ul>{cityEvents.slice(1).map((event, i) => <li key={i}>{event.text}</li>)}</ul>}
        </details>
      </article>

      <article className="weekly-news-card" data-news-category="market" aria-label="市場のニュース">
        <span className="weekly-news-category">市場</span><h4>{marketTitle}</h4>
        <p>週末のゲーム内株価は <strong>{news.market.advances}銘柄が上昇</strong>、{news.market.declines}銘柄が下落。{news.market.unchanged > 0 && `横ばいは${news.market.unchanged}銘柄。`}</p>
      </article>

      <article className="weekly-news-card" data-news-category="company" aria-label="他社のニュース">
        <span className="weekly-news-category">他社</span><h4>他社の株価の動き</h4>
        {news.companies.length ? <ul className="weekly-news-companies">{news.companies.map(row => {
          const stock = STOCKS.find(stock => stock.id === row.stockId)!;
          return <li key={row.stockId} data-news-stock-id={row.stockId}>
            <div><strong>{stock.name}</strong><b className={row.percentChange > 0 ? 'positive' : row.percentChange < 0 ? 'negative' : ''}>{percent(row.percentChange)}</b></div>
            <span>{stock.sector} · {price(row.previousPrice)} <span aria-label="から">→</span> {price(row.currentPrice)}</span>
          </li>;
        })}</ul> : <p>この週は比較できる他社の株価が記録されていません。</p>}
        <p className="weekly-news-caption">週初から週末の価格変化。</p>
      </article>
    </div>
    {news.events.some(event => event.category === 'company') && <details className="weekly-news-details weekly-news-group-events"><summary>グループ企業の進展</summary><ul>{news.events.filter(event => event.category === 'company').map((event, i) => <li key={i}>{event.text}</li>)}</ul></details>}
  </section>;
}
