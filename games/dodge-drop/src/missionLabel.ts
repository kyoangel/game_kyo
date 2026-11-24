import { missionTarget, type Mission } from './missions.ts';

/** `<label>  n/t` where the template carries a `{t}` target placeholder and an optional `{es}` plural suffix. */
export function missionLabel(template: string, m: Mission, progress: number): string {
  const { text, n, t } = parts(template, m, progress);
  return `${text}  ${n}/${t}`;
}

/** Landscape side-panel block: the label on one line, progress on a consistent second line (never wraps mid-item). */
export function missionPanelText(template: string, m: Mission, progress: number): string {
  const { text, n, t } = parts(template, m, progress);
  return `${text}\n${n}/${t}`;
}

function parts(template: string, m: Mission, progress: number): { text: string; n: number; t: number } {
  const t = missionTarget(m);
  const n = Math.max(0, Math.min(Math.floor(progress), t));
  return { text: template.replace('{t}', String(t)).replace('{es}', t === 1 ? '' : 'es'), n, t };
}
