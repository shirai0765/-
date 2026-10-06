import { CirclePlus, Coffee, CalendarCheck } from 'lucide-react';
import GameDialog from './GameDialog';
import './first-play-guide.css';

export interface FirstPlayGuideProps {
  /** App owns first-visit persistence and may also open this guide from Help. */
  onClose: () => void;
}

export default function FirstPlayGuide({ onClose }: FirstPlayGuideProps) {
  return <GameDialog title="経営のはじめ方" close={onClose} className="first-play-guide">
    <ol className="first-play-steps">
      <li><span className="first-play-step-icon"><CirclePlus size={22} aria-hidden="true"/></span><div>
        <h3><span>1</span> 街の「＋」から出店</h3>
        <p>場所と店のスタイルを選び、1号店を開きます。</p>
      </div></li>
      <li><span className="first-play-step-icon"><Coffee size={22} aria-hidden="true"/></span><div>
        <h3><span>2</span> 店に入って経営</h3>
        <p>価格・品質・人員・広告を決めます。店長に任せると、人員・広告の配分枠でこの4つを調整。出店・改装は自分で決めます。</p>
      </div></li>
      <li><span className="first-play-step-icon"><CalendarCheck size={22} aria-hidden="true"/></span><div>
        <h3><span>3</span> 週を終えて結果を見る</h3>
        <p>「週を終了」で客数と利益が確定。実績を見て店を調整し、次の出店へ進みましょう。</p>
      </div></li>
    </ol>
    <button type="button" className="primary" onClick={onClose}>街で始める</button>
    <p className="first-play-guide-reopen">この説明は「経営 → 遊び方」からいつでも読めます。</p>
  </GameDialog>;
}
