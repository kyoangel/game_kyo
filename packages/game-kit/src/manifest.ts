export const KNOWN_TARGETS = ['site', 'crazygames', 'gamedistribution'] as const;
export const RELEASE_STATUSES = ['todo', 'submitted', 'basic', 'live', 'full', 'rejected'] as const;
export const ORIENTATIONS = ['landscape', 'portrait', 'any'] as const;
export const CONTROLS = ['mouse', 'touch', 'keyboard'] as const;
/** Collide with existing gh-pages folders (legacy games) or site paths. */
export const RESERVED_SLUGS: readonly string[] = ['merge10', 'merge10x', 'pixel-squad', 'static', 'assets', 'play'];

export type Target = (typeof KNOWN_TARGETS)[number];
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];
export type Orientation = (typeof ORIENTATIONS)[number];
export type Control = (typeof CONTROLS)[number];
export type LocalizedText = { en: string } & Record<string, string>;

export interface Release {
  status: ReleaseStatus;
  version: string;
  submittedAt?: string;
  reason?: string;
}

export interface GameManifest {
  slug: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  instructions: LocalizedText;
  tags: string[];
  orientation: Orientation;
  controls: Control[];
  cover: string;
  targets: Target[];
  releases: Partial<Record<Target, Release>>;
}

export type ValidationResult = { ok: true; manifest: GameManifest } | { ok: false; errors: string[] };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const oneOf = (list: readonly string[], v: unknown): boolean => typeof v === 'string' && list.includes(v);

export function validateSlug(slug: unknown): string | null {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return `slug must be kebab-case (${SLUG_RE})`;
  if (RESERVED_SLUGS.includes(slug)) return `slug "${slug}" is reserved`;
  return null;
}

function checkLocalized(v: unknown, field: string, errors: string[]): void {
  if (!isObject(v) || Object.values(v).some((x) => typeof x !== 'string')) {
    errors.push(`${field} must be an object of locale -> string`);
    return;
  }
  if (typeof v.en !== 'string' || v.en.trim() === '') errors.push(`${field}.en is required`);
}

function checkReleases(v: unknown, errors: string[]): void {
  if (!isObject(v)) {
    errors.push('releases must be an object');
    return;
  }
  for (const [target, rel] of Object.entries(v)) {
    if (!oneOf(KNOWN_TARGETS, target)) {
      errors.push(`releases.${target}: unknown target`);
      continue;
    }
    if (!isObject(rel)) {
      errors.push(`releases.${target} must be an object`);
      continue;
    }
    if (!oneOf(RELEASE_STATUSES, rel.status)) errors.push(`releases.${target}.status must be one of ${RELEASE_STATUSES.join(', ')}`);
    if (typeof rel.version !== 'string' || !SEMVER_RE.test(rel.version)) errors.push(`releases.${target}.version must be semver`);
    if (rel.submittedAt !== undefined && (typeof rel.submittedAt !== 'string' || !DATE_RE.test(rel.submittedAt)))
      errors.push(`releases.${target}.submittedAt must be YYYY-MM-DD`);
    if (rel.status === 'rejected' && (typeof rel.reason !== 'string' || rel.reason.trim() === ''))
      errors.push(`releases.${target}.reason is required when rejected`);
  }
}

export function validateManifest(raw: unknown): ValidationResult {
  if (!isObject(raw)) return { ok: false, errors: ['manifest must be a JSON object'] };
  const m = raw;
  const errors: string[] = [];
  const slugErr = validateSlug(m.slug);
  if (slugErr) errors.push(slugErr);
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) errors.push('version must be semver x.y.z');
  checkLocalized(m.title, 'title', errors);
  checkLocalized(m.description, 'description', errors);
  checkLocalized(m.instructions, 'instructions', errors);
  if (!isStringArray(m.tags)) errors.push('tags must be an array of strings');
  if (!oneOf(ORIENTATIONS, m.orientation)) errors.push(`orientation must be one of ${ORIENTATIONS.join(', ')}`);
  if (!isStringArray(m.controls) || m.controls.length === 0 || m.controls.some((c) => !oneOf(CONTROLS, c)))
    errors.push(`controls must be a non-empty subset of ${CONTROLS.join(', ')}`);
  if (typeof m.cover !== 'string' || m.cover === '' || m.cover.includes('..') || m.cover.startsWith('/'))
    errors.push('cover must be a file name inside public/');
  if (!isStringArray(m.targets) || m.targets.length === 0 || m.targets.some((t) => !oneOf(KNOWN_TARGETS, t)))
    errors.push(`targets must be a non-empty subset of ${KNOWN_TARGETS.join(', ')}`);
  checkReleases(m.releases, errors);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest: m as unknown as GameManifest };
}
