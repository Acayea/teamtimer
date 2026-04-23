import { STANDARD_DISTANCES, lapCount, formatDistanceLabel, isValidDistance } from '../../src/domain/distances';

describe('distances', () => {
  it('includes standard track distances', () => {
    expect(STANDARD_DISTANCES).toContain(800);
    expect(STANDARD_DISTANCES).toContain(1600);
    expect(STANDARD_DISTANCES).toContain(3200);
  });

  it('computes lap count correctly', () => {
    expect(lapCount(800, 400)).toBe(2);
    expect(lapCount(1600, 400)).toBe(4);
    expect(lapCount(3200, 400)).toBe(8);
    expect(lapCount(800, 200)).toBe(4);
  });

  it('formats distance label', () => {
    expect(formatDistanceLabel(1600)).toBe('1600m');
    expect(formatDistanceLabel(5000)).toBe('5000m');
  });

  it('validates distances', () => {
    expect(isValidDistance(800)).toBe(true);
    expect(isValidDistance(0)).toBe(false);
    expect(isValidDistance(99)).toBe(false);
    expect(isValidDistance(800.5)).toBe(false);
  });
});
