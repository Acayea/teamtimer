// src/hooks/useRaceClock.ts
import { useEffect, useRef, useState } from 'react';

/**
 * Returns elapsed milliseconds since startedAt.
 * Updates at ~10 Hz. Derived from startedAt each tick so it stays
 * correct even if the JS thread is briefly suspended.
 * Pass null startedAt to pause (returns 0).
 */
export function useRaceClock(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    intervalRef.current = setInterval(tick, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  return elapsed;
}
