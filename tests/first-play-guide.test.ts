import { Children, createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FirstPlayGuide, { type GuideContext, type GuideDestination } from '../src/ui/FirstPlayGuide';

const paths: { context: GuideContext; stage: string; destination: GuideDestination; action: string }[] = [
  { context: { storeCount: 0, hasReport: false, ended: false }, stage: 'empty', destination: 'sites', action: '出店場所を見る' },
  { context: { storeCount: 2, hasReport: false, ended: false }, stage: 'operating', destination: 'stores', action: '店舗を経営する' },
  { context: { storeCount: 2, hasReport: true, ended: false }, stage: 'reported', destination: 'report', action: '営業結果を見る' },
  { context: { storeCount: 0, hasReport: true, ended: false }, stage: 'reported', destination: 'report', action: '営業結果を見る' },
  { context: { storeCount: 2, hasReport: true, ended: true }, stage: 'ended', destination: 'settings', action: '設定・保存を開く' },
  { context: { storeCount: 0, hasReport: false, ended: true }, stage: 'ended', destination: 'settings', action: '設定・保存を開く' },
];

describe('contextual first-play guide', () => {
  it.each(paths)('renders the $stage context with $context.storeCount stores and the $destination entry', ({ context, stage, destination, action }) => {
    const original = structuredClone(context);
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const markup = renderToStaticMarkup(createElement(FirstPlayGuide, { context, onClose, onNavigate }));
    expect(markup).toContain(`data-guide-context="${stage}"`);
    expect(markup).toContain(`data-guide-destination="${destination}"`);
    expect(markup).toContain(action);
    expect(markup).toContain('説明を閉じる');
    expect(markup).not.toContain('1号店');
    expect(markup).not.toContain('次の出店へ進みましょう');
    expect((markup.match(/data-guide-destination=/g) ?? []).length).toBe(1);
    expect(context).toEqual(original);
    expect(onClose).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    if (stage === 'ended') {
      expect(markup).toContain('営業の進行はできません');
      expect(markup).not.toContain('出店できます');
      expect(markup.includes('直近の営業結果')).toBe(context.hasReport);
    }
    if (stage === 'reported') {
      expect(markup).toContain('出店や投資も任意です');
      expect(markup.includes('営業中のカフェはありません')).toBe(context.storeCount === 0);
    }
  });

  it('offers only dismissal when no navigation handler is supplied', () => {
    const markup = renderToStaticMarkup(createElement(FirstPlayGuide, {
      context: { storeCount: 3, hasReport: true, ended: false }, onClose: () => undefined,
    }));
    expect(markup).toContain('説明を閉じる');
    expect(markup).not.toContain('data-guide-destination');
  });

  it.each(paths)('dismisses before navigating to $destination without changing context', ({ context, destination }) => {
    const calls: string[] = [];
    const original = structuredClone(context);
    const element = FirstPlayGuide({ context, onClose: () => calls.push('close'), onNavigate: target => calls.push(target) });
    const action = Children.toArray(element.props.children).find(child =>
      isValidElement<{ 'data-guide-destination'?: GuideDestination }>(child) && child.props['data-guide-destination'] === destination);
    expect(isValidElement(action)).toBe(true);
    if (!isValidElement<{ onClick: () => void }>(action)) throw new Error('Missing contextual action');
    action.props.onClick();
    expect(calls).toEqual(['close', destination]);
    expect(context).toEqual(original);
  });
});
