import { describe, expect, it } from 'vitest';
import { ffmpegArgs, MAX_SECONDS, RECORD_VIEWPORT, videoFilters } from './store-video.ts';

describe('videoFilters', () => {
  it('portrait game: 2:3 centre crop scaled to 1080x1620, landscape = blurred sides', () => {
    const f = videoFilters('portrait', 0);
    expect(f.portrait).toBe(
      "[0:v]crop='min(iw,ih*2/3)':'min(ih,iw*3/2)':(iw-ow)/2:(ih-oh)/2,scale=1080:1620:flags=lanczos,fps=60[v]",
    );
    expect(f.landscape).toContain('scale=1920:-2,crop=1920:1080,boxblur=30:3');
    expect(f.landscape).toContain('[a]scale=-2:1080');
    expect(f.landscape).toContain('overlay=(W-w)/2:0');
  });
  it('honours a top offset for phone recordings', () => {
    expect(videoFilters('portrait', 56).portrait).toContain(":(iw-ow)/2:'min(56,ih-oh)'");
  });
  it('landscape game: 16:9 crop for landscape, blurred top/bottom for portrait', () => {
    const f = videoFilters('landscape', 0);
    expect(f.landscape).toContain("crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'");
    expect(f.landscape).toContain('scale=1920:1080');
    expect(f.portrait).toContain('overlay=0:(H-h)/2');
  });
  it('records at the target aspect so the crop is a no-op', () => {
    expect(RECORD_VIEWPORT.portrait).toEqual({ width: 720, height: 1080 });
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
  it('omits audio when the source has none', () => expect(ffmpegArgs('in.webm', 'o.mp4', '[0:v]null[v]', false)).toContain('-an'));
});
