import { missionTarget, type Mission } from './missions.ts';

/** `<label>  n/t` where the template carries a `{t}` target placeholder and an optional `{es}` plural suffix. */
export function missionLabel(template: string, m: Mission, progress: number): string {
  const t = missionTarget(m);
  const n = Math.max(0, Math.min(Math.floor(progress), t));
  const text = template.replace('{t}', String(t)).replace('{es}', t === 1 ? '' : 'es');
  return `${text}  ${n}/${t}`;
}
