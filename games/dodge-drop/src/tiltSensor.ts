/** Runtime tilt (deviceorientation) detection and live reading. DOM access is injected via TiltEnv so it is testable. */
export interface TiltEnv {
  coarsePointer: boolean;
  hasOrientationEvent: boolean;
  /** Present on iOS 13+: must be called from a user gesture. */
  requestPermission?: () => Promise<'granted' | 'denied'>;
  listen(fn: (e: { gamma: number | null }) => void): () => void;
  /** How long to wait for a first reading (1000 in production). */
  timeoutMs: number;
}

export function browserTiltEnv(): TiltEnv {
  const w = window as unknown as {
    DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
  };
  const doe = w.DeviceOrientationEvent;
  const req = doe?.requestPermission;
  return {
    coarsePointer: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    hasOrientationEvent: doe !== undefined,
    requestPermission: typeof req === 'function' ? async () => ((await req.call(doe)) === 'granted' ? 'granted' : 'denied') : undefined,
    listen(fn) {
      const h = (e: Event): void => fn({ gamma: (e as DeviceOrientationEvent).gamma });
      window.addEventListener('deviceorientation', h);
      return () => window.removeEventListener('deviceorientation', h);
    },
    timeoutMs: 1000,
  };
}

function waitForGamma(env: TiltEnv): Promise<boolean> {
  return new Promise((resolve) => {
    let off: () => void = () => undefined;
    const timer = setTimeout(() => {
      off();
      resolve(false);
    }, env.timeoutMs);
    off = env.listen((e) => {
      if (e.gamma === null || e.gamma === undefined) return;
      clearTimeout(timer);
      off();
      resolve(true);
    });
  });
}

/** Whether to offer the Tilt option: touch device + DeviceOrientationEvent + a real reading (or iOS permission flow). */
export async function detectTilt(env: TiltEnv): Promise<{ available: boolean; needsPermission: boolean }> {
  if (!env.coarsePointer || !env.hasOrientationEvent) return { available: false, needsPermission: false };
  if (env.requestPermission) return { available: true, needsPermission: true };
  return { available: await waitForGamma(env), needsPermission: false };
}

/** Call from the tap that selects Tilt. True when readings will flow. */
export async function requestTilt(env: TiltEnv): Promise<boolean> {
  if (env.requestPermission) {
    try {
      if ((await env.requestPermission()) !== 'granted') return false;
    } catch {
      return false;
    }
  }
  return waitForGamma(env);
}

/** Latest gamma reading while started; neutral is captured by the caller. */
export class TiltReader {
  latest: number | null = null;
  private off: (() => void) | null = null;

  start(env: TiltEnv = browserTiltEnv()): void {
    if (this.off) return;
    this.off = env.listen((e) => {
      if (typeof e.gamma === 'number' && Number.isFinite(e.gamma)) this.latest = e.gamma;
    });
  }

  stop(): void {
    this.off?.();
    this.off = null;
    this.latest = null;
  }
}
