import { CirclePlus, Coffee, CalendarCheck, ReceiptText, Settings, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import GameDialog from './GameDialog';
import './first-play-guide.css';

export type GuideDestination = 'sites' | 'stores' | 'report' | 'settings';
export interface GuideContext {
  storeCount: number;
  hasReport: boolean;
  ended: boolean;
}

export interface FirstPlayGuideProps {
  context: GuideContext;
  /** App owns the existing browser preference and may open this guide from Help. */
  onClose: () => void;
  /** A contextual action dismisses first, then opens an existing screen. */
  onNavigate?: (destination: GuideDestination) => void;
}

type GuideStage = 'ended' | 'reported' | 'empty' | 'operating';
interface GuideContent {
  stage: GuideStage;
  title: string;
  action: { destination: GuideDestination; label: string };
  steps: { icon: LucideIcon; title: string; text: string }[];
}

function guideContent(context: GuideContext): GuideContent {
  if (context.ended) return {
    stage: 'ended', title: '経営を終えた会社',
    action: { destination: 'settings', label: '設定・保存を開く' },
    steps: [
      { icon: CalendarCheck, title: '経営は終了しています', text: '店舗の設定変更や営業の進行はできません。記録は引き続き読めます。' },
      context.hasReport
        ? { icon: ReceiptText, title: '確定した結果を振り返る', text: '「経営 → 直近の営業結果」から、最後の決算を読めます。' }
        : { icon: ReceiptText, title: '会社データを残す', text: '設定から保存ファイルを書き出し、会社の記録を残せます。' },
      { icon: Settings, title: '保存・復元・新規設立', text: '「設定・保存」から保存履歴を復元する、新しい会社を始める操作も選べます。' },
    ],
  };
  if (context.hasReport) return {
    stage: 'reported', title: 'この会社で続ける',
    action: { destination: 'report', label: '営業結果を見る' },
    steps: [
      { icon: ReceiptText, title: '直近の結果を確認', text: '確定した利益と、この決算の現金増減を確認できます。' },
      context.storeCount > 0
        ? { icon: Coffee, title: '店の設定を考える', text: '営業中の店は、店舗一覧から設定を見直せます。今の計画を続けることも選べます。' }
        : { icon: Coffee, title: '会社の状況を確認', text: '営業中のカフェはありません。直近の結果を読み、次の判断を考えられます。' },
      { icon: HelpCircle, title: '次の選択は自由', text: '出店や投資も任意です。結果を読んでから、必要な操作だけ選べます。' },
    ],
  };
  if (context.storeCount === 0) return {
    stage: 'empty', title: '経営のはじめ方',
    action: { destination: 'sites', label: '出店場所を見る' },
    steps: [
      { icon: CirclePlus, title: '街から店舗を選ぶ', text: '営業中のカフェはありません。場所・スタイル・費用を比べて出店できます。' },
      { icon: Coffee, title: '店の設定を決める', text: '価格・品質・人員・広告を調整します。今の設定を続けることも選べます。' },
      { icon: CalendarCheck, title: '週末の実績を読む', text: '「週を終了」で利益と現金の増減が確定。結果を見て、次の判断を考えましょう。' },
    ],
  };
  return {
    stage: 'operating', title: '営業中の店から続ける',
    action: { destination: 'stores', label: '店舗を経営する' },
    steps: [
      { icon: Coffee, title: '営業中の店を確認', text: '店舗一覧から店を選び、今の設定を確認できます。' },
      { icon: Settings, title: '設定を選ぶ', text: '価格・品質・人員・広告を調整できます。今の設定を続けることも選べます。' },
      { icon: CalendarCheck, title: '週を終えて結果を見る', text: '「週を終了」で結果が確定します。営業前に見込みと支払いを確認できます。' },
    ],
  };
}

export default function FirstPlayGuide({ context, onClose, onNavigate }: FirstPlayGuideProps) {
  const guide = guideContent(context);
  return <GameDialog title={guide.title} close={onClose} className="first-play-guide">
    <ol className="first-play-steps" data-guide-context={guide.stage}>
      {guide.steps.map(({ icon: Icon, title, text }, index) => <li key={title}>
        <span className="first-play-step-icon"><Icon size={22} aria-hidden="true"/></span><div>
          <h3><span>{index + 1}</span> {title}</h3><p>{text}</p>
        </div>
      </li>)}
    </ol>
    {onNavigate && <button type="button" className="primary" data-guide-destination={guide.action.destination} onClick={() => { onClose(); onNavigate(guide.action.destination); }}>{guide.action.label}</button>}
    <button type="button" className={onNavigate ? 'text-button' : 'primary'} onClick={onClose}>説明を閉じる</button>
    <p className="first-play-guide-reopen">この説明は「経営 → 遊び方」からいつでも読めます。</p>
  </GameDialog>;
}
