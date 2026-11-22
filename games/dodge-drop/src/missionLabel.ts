import { missionTarget, type Mission } from './missions.ts';

/** `<label>  n/t` where the template carries a `{t}` target placeholder. */
export function missionLabel(template: string, m: Mission, progress: number): string {
  const t = missionTarget(m);
  const n = Math.max(0, Math.min(Math.floor(progress), t));
  return `${template.replace('{t}', String(t))}  ${n}/${t}`;
}
