// Portal preview videos: portrait 1080x1620 (2:3) and landscape 1920x1080 (16:9), under 20 s.
import type { Orientation } from '../packages/game-kit/src/manifest.ts';

/** Record at the target aspect so the centre crop is a no-op for recorded gameplay. */
export const RECORD_VIEWPORT = {
  portrait: { width: 720, height: 1080 },
  landscape: { width: 1280, height: 720 },
} as const;

const P = { w: 1080, h: 1620, a: '2/3', ia: '3/2' };
const L = { w: 1920, h: 1080, a: '16/9', ia: '9/16' };
const BLUR = 'boxblur=30:3,eq=brightness=-0.15';

/** Largest centred crop with aspect `a` (w/h); `top` > 0 pins the crop that many px from the top instead. */
const crop = (a: string, ia: string, top: number): string =>
  `crop='min(iw,ih*${a})':'min(ih,iw*${ia})':(iw-ow)/2:${top > 0 ? `'min(${top},ih-oh)'` : '(ih-oh)/2'}`;

/** ffmpeg -filter_complex graphs (output label [v]) for both portal videos. */
export function videoFilters(orientation: Orientation, top: number): { portrait: string; landscape: string } {
  if (orientation !== 'landscape') {
    const src = crop(P.a, P.ia, top);
    return {
      portrait: `[0:v]${src},scale=${P.w}:${P.h}:flags=lanczos,fps=60[v]`,
      landscape: `[0:v]${src},fps=60,split[a][b];[b]scale=${L.w}:-2,crop=${L.w}:${L.h},${BLUR}[bg];[a]scale=-2:${L.h}:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0[v]`,
    };
  }
  const src = crop(L.a, L.ia, top);
  return {
    landscape: `[0:v]${src},scale=${L.w}:${L.h}:flags=lanczos,fps=60[v]`,
    portrait: `[0:v]${src},fps=60,split[a][b];[b]scale=-2:${P.h},crop=${P.w}:${P.h},${BLUR}[bg];[a]scale=${P.w}:-2:flags=lanczos[fg];[bg][fg]overlay=0:(H-h)/2[v]`,
  };
}
