import { describe, expect, it } from 'vitest';
import { ffmpegArgs, MAX_SECONDS, RECORD_VIEWPORT, videoFilters, videoProblems } from './store-video.ts';

describe('videoFilters', () => {
  const fit = (w: number, h: number) =>
    `split[a][b];[b]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=30:3,eq=brightness=-0.15[bg];` +
    `[a]scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`;
  it('fits the whole frame into 2:3 over a blurred fill', () =>
    expect(videoFilters({ top: 0, bottom: 0 }).portrait).toBe(`[0:v]fps=60,${fit(1080, 1620)}`));
  it('fits the whole frame into 16:9 over a blurred fill', () =>
    expect(videoFilters({ top: 0, bottom: 0 }).landscape).toBe(`[0:v]fps=60,${fit(1920, 1080)}`));
  it('trims browser chrome from a phone recording first', () =>
    expect(videoFilters({ top: 56, bottom: 10 }).portrait).toBe(`[0:v]crop=iw:ih-66:0:56,fps=60,${fit(1080, 1620)}`));
  it('records portrait games at 9:16, the common mobile design size', () => {
    expect(RECORD_VIEWPORT.portrait).toEqual({ width: 720, height: 1280 });
    expect(RECORD_VIEWPORT.landscape).toEqual({ width: 1280, height: 720 });
  });
});

describe('ffmpegArgs', () => {
  const args = ffmpegArgs('in.webm', 'out.mp4', '[0:v]null[v]', true);
  it('trims under the 20 s cap', () => {
    expect(MAX_SECONDS).toBe(19.9);
    expect(args).toEqual(expect.arrayContaining(['-t', '19.9']));
  });
  it('fades out video and audio', () => {
    expect(args[args.indexOf('-filter_complex') + 1]).toBe('[0:v]null[v];[v]fade=t=out:st=19.4:d=0.5,format=yuv420p[out]');
    expect(args).toEqual(expect.arrayContaining(['-af', 'afade=t=out:st=19.4:d=0.5', '-map', '0:a?']));
  });
  it('encodes h264 + faststart, overwrites output', () => {
    expect(args).toEqual(expect.arrayContaining(['-y', '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart']));
    expect(args.at(-1)).toBe('out.mp4');
  });
  it('seeks past the title screen before the input when startAt is given', () => {
    const a = ffmpegArgs('in.webm', 'o.mp4', '[0:v]null[v]', false, 2.25);
    expect(a.slice(a.indexOf('-ss'), a.indexOf('-ss') + 4)).toEqual(['-ss', '2.25', '-i', 'in.webm']);
  });
  it('does not seek by default', () => expect(args).not.toContain('-ss'));
  it('omits audio when the source has none', () => expect(ffmpegArgs('in.webm', 'o.mp4', '[0:v]null[v]', false)).toContain('-an'));
});

describe('videoProblems', () => {
  const probe = (w: number, h: number, d: string) =>
    JSON.stringify({ streams: [{ codec_type: 'video', codec_name: 'h264', width: w, height: h }], format: { duration: d } });
  it('passes a correct file', () => expect(videoProblems(probe(1080, 1620, '19.9'), 1080, 1620)).toEqual([]));
  it('flags wrong size', () =>
    expect(videoProblems(probe(720, 1264, '19.9'), 1080, 1620)).toEqual(['size 720x1264, expected 1080x1620']));
  it('flags > 20 s', () => expect(videoProblems(probe(1080, 1620, '21.0'), 1080, 1620)).toEqual(['duration 21.0 s exceeds 20 s']));
});
