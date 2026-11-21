import { describe, expect, it } from 'vitest';
import { validateManifest, validateSlug } from './manifest.ts';

const valid = () => ({
  slug: 'dodge-drop',
  version: '0.1.0',
  title: { en: 'Dodge Drop', 'zh-TW': '閃避落塊' },
  description: { en: 'Dodge blocks.' },
  instructions: { en: 'Move left and right.' },
  tags: ['arcade'],
  orientation: 'portrait',
  controls: ['mouse', 'touch', 'keyboard'],
  cover: 'cover.svg',
  targets: ['site', 'crazygames'],
  releases: { site: { status: 'live', version: '0.1.0' } },
});

const errorsOf = (raw: unknown): string[] => {
  const r = validateManifest(raw);
  return r.ok ? [] : r.errors;
};

describe('validateSlug', () => {
  it('accepts kebab-case', () => expect(validateSlug('dodge-drop')).toBeNull());
  it.each(['Dodge', 'dodge_drop', '-x', 'x-', '', 42])('rejects %s', (s) => expect(validateSlug(s)).not.toBeNull());
  it.each(['merge10', 'merge10x', 'pixel-squad', 'static', 'assets', 'play'])('rejects reserved %s', (s) =>
    expect(validateSlug(s)).toMatch(/reserved/),
  );
});

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const r = validateManifest(valid());
    expect(r.ok).toBe(true);
  });

  it('rejects non-objects', () => expect(errorsOf([])).toEqual(['manifest must be a JSON object']));

  it('requires semver version', () => expect(errorsOf({ ...valid(), version: '1.0' }).join()).toMatch(/version/));

  it('requires en in localized fields', () =>
    expect(errorsOf({ ...valid(), title: { 'zh-TW': '標題' } }).join()).toMatch(/title\.en/));

  it('validates orientation, controls, cover, targets', () => {
    const errs = errorsOf({ ...valid(), orientation: 'diagonal', controls: [], cover: '../x.png', targets: ['poki'] });
    expect(errs).toHaveLength(4);
  });

  it('rejects unknown release targets and statuses', () => {
    expect(errorsOf({ ...valid(), releases: { poki: { status: 'live', version: '1.0.0' } } }).join()).toMatch(/poki/);
    expect(errorsOf({ ...valid(), releases: { site: { status: 'done', version: '1.0.0' } } }).join()).toMatch(/status/);
  });

  it('requires reason when rejected', () =>
    expect(
      errorsOf({ ...valid(), releases: { crazygames: { status: 'rejected', version: '0.1.0' } } }).join(),
    ).toMatch(/reason/));

  it('validates submittedAt format', () =>
    expect(
      errorsOf({ ...valid(), releases: { crazygames: { status: 'submitted', version: '0.1.0', submittedAt: '12/01' } } }).join(),
    ).toMatch(/submittedAt/));

  it('accepts optional portalIds.gamedistribution', () => {
    expect(validateManifest({ ...valid(), portalIds: { gamedistribution: 'abc123' } }).ok).toBe(true);
    expect(validateManifest({ ...valid(), portalIds: {} }).ok).toBe(true);
  });

  it('rejects malformed portalIds', () => {
    expect(errorsOf({ ...valid(), portalIds: 'abc' }).join()).toMatch(/portalIds must be an object/);
    expect(errorsOf({ ...valid(), portalIds: { gamedistribution: '' } }).join()).toMatch(/portalIds\.gamedistribution/);
    expect(errorsOf({ ...valid(), portalIds: { gamedistribution: 42 } }).join()).toMatch(/portalIds\.gamedistribution/);
    expect(errorsOf({ ...valid(), portalIds: { poki: 'x' } }).join()).toMatch(/portalIds\.poki: unknown portal/);
  });
});
