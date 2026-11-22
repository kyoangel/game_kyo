import { describe, expect, it } from 'vitest';
import { markReleased } from './mark-released.ts';

const src =
  '{\n  "slug": "neo",\n  "version": "1.2.3",\n  "tags": [\n    "arcade"\n  ],\n  "releases": {\n    "crazygames": {\n      "status": "todo",\n      "version": "0.1.0"\n    }\n  }\n}\n';

describe('markReleased', () => {
  it('sets status, current version and date, keeping 2-space JSON and the trailing newline', () =>
    expect(markReleased(src, 'crazygames', 'submitted', '2026-11-22')).toBe(
      '{\n  "slug": "neo",\n  "version": "1.2.3",\n  "tags": [\n    "arcade"\n  ],\n  "releases": {\n    "crazygames": {\n      "status": "submitted",\n      "version": "1.2.3",\n      "submittedAt": "2026-11-22"\n    }\n  }\n}\n',
    ));
  it('records a rejection reason', () =>
    expect(JSON.parse(markReleased(src, 'crazygames', 'rejected', '2026-11-23', 'too slow')).releases.crazygames).toEqual({
      status: 'rejected',
      version: '1.2.3',
      submittedAt: '2026-11-23',
      reason: 'too slow',
    }));
  it('keeps the original submittedAt when a submitted version is later approved', () => {
    const submitted = markReleased(src, 'crazygames', 'submitted', '2026-11-22');
    expect(JSON.parse(markReleased(submitted, 'crazygames', 'basic', '2026-11-30')).releases.crazygames).toEqual({
      status: 'basic',
      version: '1.2.3',
      submittedAt: '2026-11-22',
    });
  });
  it('rejects an invalid date', () =>
    expect(() => markReleased(src, 'crazygames', 'submitted', '22/11/2026')).toThrow(/YYYY-MM-DD/));
  it('refuses rejected without a reason', () =>
    expect(() => markReleased(src, 'crazygames', 'rejected', '2026-11-22')).toThrow(/reason/));
});
