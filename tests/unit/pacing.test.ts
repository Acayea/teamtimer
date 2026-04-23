import { evenPaceTargets, negativeSplitTargets, validateCustomTargets } from '../../src/domain/pacing';

describe('evenPaceTargets', () => {
  it('generates evenly spaced cumulative targets', () => {
    const targets = evenPaceTargets(4, 240000);
    expect(targets).toHaveLength(4);
    expect(targets[0]).toBe(60000);
    expect(targets[1]).toBe(120000);
    expect(targets[3]).toBe(240000);
  });

  it('last target always equals goalMs', () => {
    const targets = evenPaceTargets(3, 190000);
    expect(targets[2]).toBe(190000);
  });
});

describe('negativeSplitTargets', () => {
  it('first half is slower than second half', () => {
    const targets = negativeSplitTargets(4, 240000, 0.02);
    const lap1 = targets[0];
    const lap3 = targets[2] - targets[1];
    expect(lap1).toBeGreaterThan(lap3);
  });

  it('total equals goalMs', () => {
    const targets = negativeSplitTargets(4, 240000, 0.02);
    expect(targets[3]).toBe(240000);
  });
});

describe('validateCustomTargets', () => {
  it('returns null for valid targets', () => {
    expect(validateCustomTargets([60000, 120000, 180000, 240000], 4)).toBeNull();
  });

  it('returns error for wrong length', () => {
    expect(validateCustomTargets([60000, 120000], 4)).not.toBeNull();
  });

  it('returns error for non-increasing targets', () => {
    expect(validateCustomTargets([60000, 120000, 110000, 240000], 4)).not.toBeNull();
  });
});
