import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ActiveAnimationClock } from '../src/city/animationClock';
import { StoreActivityVisuals } from '../src/city/StoreActivityVisuals';
import { LOTS } from '../src/data/district';
import { advanceWeek, applyAction, createGame } from '../src/sim/engine';

describe('paused map animation time', () => {
  it('counts active frame intervals and excludes repeated modal or document-hidden gaps', () => {
    const clock = new ActiveAnimationClock();
    expect(clock.sample(1000)).toBe(0);
    expect(clock.sample(1016)).toBe(16);
    expect(clock.sample(1048)).toBe(48);
    clock.pause();
    clock.pause();
    expect(clock.sample(61048)).toBe(48);
    expect(clock.sample(61064)).toBe(64);
    clock.pause();
    expect(clock.sample(121064)).toBe(64);
    expect(clock.sample(121080)).toBe(80);
  });

  it('resumes the existing visitor pool at its last positions before normal movement continues', () => {
    const clock = new ActiveAnimationClock();
    const visual = new StoreActivityVisuals(LOTS, false);
    const state = advanceWeek(applyAction(createGame('pause QA', 812), { type: 'openStore', lotId: 'center-01', style: 'standard' }));
    visual.update(state, 'center-01');
    const bodies = visual.group.children[0] as THREE.InstancedMesh;
    const positions = () => Array.from(bodies.instanceMatrix.array);
    visual.animate(clock.sample(1000));
    visual.animate(clock.sample(2000));
    const before = positions(), count = bodies.count;
    clock.pause();
    visual.animate(clock.sample(602000));
    expect(visual.group.children[0]).toBe(bodies);
    expect(bodies.count).toBe(count);
    expect(positions()).toEqual(before);
    visual.animate(clock.sample(602016));
    expect(positions()).not.toEqual(before);
    visual.dispose();
  });
});
