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

/** Portals cap preview videos at 20 s; stay just under it. */
export const MAX_SECONDS = 19.9;

/** Full ffmpeg argument list: trim, 0.5 s fade-out, h264/yuv420p, aac, web-friendly (faststart). */
export function ffmpegArgs(input: string, output: string, filter: string, hasAudio: boolean): string[] {
  const st = (MAX_SECONDS - 0.5).toFixed(1);
  const audio = hasAudio ? ['-map', '0:a?', '-af', `afade=t=out:st=${st}:d=0.5`, '-c:a', 'aac', '-b:a', '128k'] : ['-an'];
  return [
    '-v', 'error', '-y', '-i', input, '-t', String(MAX_SECONDS),
    '-filter_complex', `${filter};[v]fade=t=out:st=${st}:d=0.5,format=yuv420p[out]`, '-map', '[out]',
    ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', output,
  ];
}

/** Problems with an encoded video, from `ffprobe -show_streams -show_format -of json` output. */
export function videoProblems(ffprobeJson: string, w: number, h: number): string[] {
  const j = JSON.parse(ffprobeJson) as {
    streams: Array<{ codec_type: string; width?: number; height?: number }>;
    format: { duration: string };
  };
  const v = j.streams.find((s) => s.codec_type === 'video');
  const out: string[] = [];
  if (!v || v.width !== w || v.height !== h) out.push(`size ${v?.width}x${v?.height}, expected ${w}x${h}`);
  if (Number(j.format.duration) > 20) out.push(`duration ${j.format.duration} s exceeds 20 s`);
  return out;
}
