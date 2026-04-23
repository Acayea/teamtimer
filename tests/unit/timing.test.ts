import {
  lapTimeMs,
  cumulativeMs,
  deltaMs,
  formatMs,
  formatDeltaMs,
  prMs,
} from '../../src/domain/timing';

const START = 1000000;
const TAPS  = [1062100, 1124500, 1188200, 1252000]; // 62.1s, 62.4s, 63.7s, 63.8s laps

describe('lapTimeMs', () => {
  it('returns time from start for first lap', () => {
    expect(lapTimeMs(TAPS, 0, START)).toBe(62100);
  });
  it('returns diff from previous tap for subsequent laps', () => {
    expect(lapTimeMs(TAPS, 1, START)).toBe(62400); // 1124500 - 1062100
  });
});

describe('cumulativeMs', () => {
  it('returns elapsed from start to tap', () => {
    expect(cumulativeMs(TAPS, 2, START)).toBe(188200); // 1188200 - 1000000
  });
});

describe('deltaMs', () => {
  it('returns positive when behind target', () => {
    const targets = [62000, 124000, 186000, 248000];
    expect(deltaMs(TAPS, 2, START, targets)).toBe(2200); // 188200 - 186000
  });
  it('returns negative when ahead of target', () => {
    const targets = [63000, 126000, 189000, 252000];
    expect(deltaMs(TAPS, 0, START, targets)).toBe(-900); // 62100 - 63000
  });
});

describe('formatMs', () => {
  it('formats sub-minute', () => {
    expect(formatMs(62100)).toBe('1:02.10');
  });
  it('formats over 10 minutes', () => {
    expect(formatMs(620000)).toBe('10:20.00');
  });
  it('formats zero', () => {
    expect(formatMs(0)).toBe('0:00.00');
  });
});

describe('formatDeltaMs', () => {
  it('formats positive delta with + sign', () => {
    expect(formatDeltaMs(1500)).toBe('+1.50');
  });
  it('formats negative delta with - sign', () => {
    expect(formatDeltaMs(-800)).toBe('-0.80');
  });
});

describe('prMs', () => {
  it('returns null for empty array', () => {
    expect(prMs([])).toBeNull();
  });
  it('returns the fastest finish time', () => {
    const races = [
      { capturedAts: [1062100, 1124500], startedAt: 1000000 }, // 124500ms total
      { capturedAts: [1061000, 1121000], startedAt: 1000000 }, // 121000ms total (faster)
    ];
    expect(prMs(races)).toBe(121000);
  });
});
