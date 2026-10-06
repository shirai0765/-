import { describe, expect, it } from 'vitest';
import { PointerSelectionGesture } from '../src/city/pointerSelection';

const point = (pointerId = 1, clientX = 100, clientY = 100, pointerType = 'mouse', button = 0) => ({ pointerId, clientX, clientY, pointerType, button });

describe('map selection gestures', () => {
  it('accepts a primary mouse click and consumes it only once', () => {
    const gesture = new PointerSelectionGesture();
    gesture.start(point());
    expect(gesture.end(point())).toBe(true);
    expect(gesture.end(point())).toBe(false);
  });

  it('allows a small touch wobble but keeps the mouse threshold', () => {
    const gesture = new PointerSelectionGesture();
    gesture.start(point(1, 100, 100, 'touch'));
    gesture.move(point(1, 107, 104));
    expect(gesture.end(point(1, 107, 104))).toBe(true);
    gesture.start(point());
    expect(gesture.end(point(1, 107, 104))).toBe(false);
  });

  it('does not turn an orbit drag that returns to its origin into a click', () => {
    const gesture = new PointerSelectionGesture();
    gesture.start(point());
    gesture.move(point(1, 160));
    gesture.move(point());
    expect(gesture.end(point())).toBe(false);
  });

  it('ignores pointerup without its own pointerdown or with another id', () => {
    const gesture = new PointerSelectionGesture();
    expect(gesture.end(point())).toBe(false);
    gesture.start(point());
    expect(gesture.end(point(2))).toBe(false);
    expect(gesture.end(point())).toBe(true);
  });

  it('cancels selection for the whole two-finger gesture and allows the next tap', () => {
    const gesture = new PointerSelectionGesture();
    gesture.start(point(1, 100, 100, 'touch'));
    gesture.start(point(2, 130, 100, 'touch'));
    expect(gesture.end(point(2, 130))).toBe(false);
    expect(gesture.active).toBe(true);
    expect(gesture.end(point())).toBe(false);
    gesture.start(point(3, 100, 100, 'touch'));
    expect(gesture.end(point(3))).toBe(true);
  });

  it('does not select after pointercancel or leaving the canvas', () => {
    const gesture = new PointerSelectionGesture();
    gesture.start(point());
    gesture.cancel(1);
    expect(gesture.end(point())).toBe(false);
  });

  it('does not select with secondary mouse buttons', () => {
    const gesture = new PointerSelectionGesture();
    gesture.start(point(1, 100, 100, 'mouse', 2));
    expect(gesture.end(point())).toBe(false);
  });

  it('drops all old pointers on disposal/reset', () => {
    const gesture = new PointerSelectionGesture();
    gesture.start(point());
    gesture.reset();
    expect(gesture.active).toBe(false);
    expect(gesture.end(point())).toBe(false);
    gesture.start(point(2));
    expect(gesture.end(point(2))).toBe(true);
  });
});
