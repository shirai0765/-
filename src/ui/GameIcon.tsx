import type { CSSProperties } from 'react';
import './game-icons.css';

export const GAME_ICON_NAMES = [
  'wallet', 'trend-up', 'users', 'shop', 'coffee', 'bank', 'chart', 'news',
  'check', 'arrow-right', 'arrow-left', 'pin', 'coins', 'settings', 'building',
  'train', 'briefcase', 'close', 'search', 'warning', 'celebrate', 'volume',
  'play', 'pause', 'lightning',
] as const;

export type GameIconName = typeof GAME_ICON_NAMES[number];
export type GameIconTone = 'blue' | 'gold' | 'green' | 'red' | 'navy' | 'muted';

interface Props {
  name: GameIconName;
  size?: number;
  className?: string;
  tone?: GameIconTone;
}

/** Decorative Phosphor duotone icon. Put the accessible meaning on its label/button. */
export function GameIcon({ name, size = 24, className, tone }: Props) {
  const style = {
    width: size,
    height: size,
    '--game-icon-image': `url("${import.meta.env.BASE_URL}icons/phosphor/${name}.svg")`,
  } as CSSProperties;
  return <span aria-hidden="true" className={[
    'game-icon', tone && `game-icon--${tone}`, className,
  ].filter(Boolean).join(' ')} style={style} />;
}
