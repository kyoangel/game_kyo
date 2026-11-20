export interface AdEvents {
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  emitPause(): void;
  emitResume(): void;
}

function safeCall(cb: () => void): void {
  try {
    cb();
  } catch (e) {
    console.error('[platform] ad listener failed', e);
  }
}

export function createAdEvents(): AdEvents {
  const pause: Array<() => void> = [];
  const resume: Array<() => void> = [];
  return {
    onPause: (cb) => { pause.push(cb); },
    onResume: (cb) => { resume.push(cb); },
    emitPause: () => { for (const cb of pause) safeCall(cb); },
    emitResume: () => { for (const cb of resume) safeCall(cb); },
  };
}
