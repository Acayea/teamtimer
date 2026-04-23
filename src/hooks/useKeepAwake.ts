// src/hooks/useKeepAwake.ts
import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'TeamTimerRace';

export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (active) {
      activateKeepAwakeAsync(TAG);
    } else {
      deactivateKeepAwake(TAG);
    }
    return () => {
      deactivateKeepAwake(TAG);
    };
  }, [active]);
}
