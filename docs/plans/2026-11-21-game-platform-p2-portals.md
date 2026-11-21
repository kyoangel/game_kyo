# Game Platform P2 — Portals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status (2026-11-21):** All 8 tasks complete (commits c905229..HEAD of the P2 series). Manual submission steps remain with the user (see Task 8 Step 8).

**Goal:** Add the `crazygames` and `gamedistribution` platform adapters, build-artifact checks, per-portal zips published as GitHub Releases, a release-status command, per-platform submission checklists and store covers, so `dodge-drop` is ready for its first manual submission.

**Architecture:** Each adapter lives in `packages/platform/src/adapters/<id>.ts`, loads its portal SDK from the portal CDN through a shared never-rejecting `loadScript`, and degrades (ads `'unavailable'`, localStorage storage) whenever the SDK is missing, times out or is disabled. `scripts/build-portals.ts` reuses `buildGames` to build each portal target into `dist/portals/<platform>/<slug>`, runs `checkArtifact` (size, relative paths, external-URL allowlist, foreign-SDK ban), and zips with the system `zip` CLI into `dist/release/`. A new CI job `release-portals` publishes one GitHub Release per `<slug>-v<version>`. Playwright portal smoke tests serve the builds with the real SDK URLs intercepted by tiny fake SDK scripts.

**Tech Stack:** Same as P1 (TypeScript 5.8+, Vite 6, Vitest 3 + jsdom, Playwright 1.48+, Node 24 in CI / Node 26 locally), plus the system `zip` / `unzip` CLIs (present on macOS and `ubuntu-latest`) and `gh` in CI.

**Specs / inputs:** `docs/specs/game-platform/architecture.md` (§3.1, §5.2–5.4, §6, §7, §8 steps 4–5). Design decisions (binding): `.superpowers/sdd/p2-decisions.md`. Portal SDK facts (exact API names, UNVERIFIED markers): `.superpowers/sdd/p2-research.md`. Foundation this builds on: `docs/plans/2026-11-20-game-platform-p1-foundation.md` (complete).
**Next plan (not here):** P3 — second-priority portals (GamePix, Playgama, Yandex) and the custom-domain / AdSense phase (`site` adapter ads).

## Global Constraints

All P1 Global Constraints still apply. Restated where they bite in P2:

- Existing games (`workspace/`, `workspace-merge10x/`, `workspace-pixel-squad/`) are untouched.
- Node scripts run as `node scripts/<name>.ts` (type stripping): erasable TS only — no `enum`, no `namespace`, no constructor parameter properties; type-only imports use `import type`. Relative TS imports always include the `.ts` extension.
- Game code and `packages/game-kit/src` MUST NOT branch on platform id. Adapters under `packages/platform` MAY know their own id; `scripts/rules.test.ts` does not scan `packages/platform` and must stay that way.
- Ad calls never reject; every failure resolves `'unavailable'`. Interstitials never resolve `'rewarded'`/`'skipped'`; rewarded never resolves `'shown'`.
- All URLs in game output are relative. The only absolute URL a portal build may fetch at runtime is that portal's SDK URL.
- Storage keys keep the `gk:` prefix in every adapter.
- Portal facts marked UNVERIFIED in `.superpowers/sdd/p2-research.md` must not become hard requirements in code; they appear only as manual checklist items (Task 7).
- Unit tests run under the existing `vitest.config.ts` (forks already get `--no-experimental-webstorage`). Adapter tests start with `// @vitest-environment jsdom`, install mock SDKs on `globalThis` with `vi.stubGlobal`, and inject a fake `loadScript` through adapter options — never the network.
- Baseline before P2: `npm run typecheck` clean; `npm test` = 13 files / 99 tests passing. Every task must leave both green.
- Commit and push after every task. Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Never `git add -A` / `git add .`** — stage the explicit paths listed in each task. The working tree has an unrelated modified file `workspace-pixel-squad/run_aoa_tests.sh`; it must never be staged or committed.
- Every commit step is followed by `git push origin master` (project memory: push directly, no confirmation).
- Do not modify any database (none are involved). Do not run anything against real portal accounts.

## File Structure

```
packages/platform/src/
  env.d.ts                         NEW  declare const __GK_GD_GAME_ID__: string
  loadScript.ts (+ .test.ts)       NEW  loadScript(url, timeoutMs, id?): Promise<boolean>
  withTimeout.ts (+ .test.ts)      NEW  withTimeout(promise, ms, fallback)
  index.ts                         MOD  re-export loadScript, withTimeout
  adapters/crazygames.ts (+ .test.ts)       NEW
  adapters/gamedistribution.ts (+ .test.ts) NEW
packages/game-kit/
  vite-config.ts (+ viteConfig.test.ts)     MOD  define __GK_GD_GAME_ID__ from env GD_GAME_ID
  src/manifest.ts (+ manifest.test.ts)      MOD  optional portalIds
vitest.config.ts                   MOD  define __GK_GD_GAME_ID__: '""'
scripts/
  check-artifact.ts (+ .test.ts)   NEW  checkArtifact(dir, platform): string[]
  build-games.ts                   MOD  optional 4th param { only, env } (backward compatible)
  build-portals.ts (+ .test.ts)    NEW  buildPortals, selectGames, zipDirectory, CLI (--smoke)
  release-portals.ts (+ .test.ts)  NEW  groupReleases + gh release create
  workflow.test.ts                 NEW  guards deploy.yml shape
  release-status.ts (+ .test.ts)   NEW  renderStatusTable + CLI
  render-covers.ts (+ .test.ts)    NEW  cover PNG renderer
e2e/
  portals.spec.ts                  NEW  portal smoke with fake SDKs
  fixtures/fake-crazygames-sdk.js  NEW
  fixtures/fake-gd-sdk.js          NEW
playwright.config.ts               MOD  webServer array (5180 local, 5181 crazygames, 5182 gamedistribution)
package.json                       MOD  scripts build:portals, test:portals, release-status, covers
.github/workflows/deploy.yml       MOD  + release-portals job
docs/specs/game-platform/checklists/crazygames.md        NEW
docs/specs/game-platform/checklists/gamedistribution.md  NEW
games/dodge-drop/game.json         MOD  releases todo entries
games/dodge-drop/store/*.png       NEW  committed store covers
```

---

### Task 1: `loadScript`, `withTimeout`, manifest `portalIds`, env defines

**Files:**
- Create: `packages/platform/src/loadScript.ts`, `packages/platform/src/loadScript.test.ts`, `packages/platform/src/withTimeout.ts`, `packages/platform/src/withTimeout.test.ts`, `packages/platform/src/env.d.ts`
- Modify: `packages/platform/src/index.ts`, `packages/game-kit/vite-config.ts`, `packages/game-kit/src/viteConfig.test.ts`, `packages/game-kit/src/manifest.ts`, `packages/game-kit/src/manifest.test.ts`, `vitest.config.ts`

**Interfaces:**
- Produces: `loadScript(url: string, timeoutMs: number, id?: string): Promise<boolean>` (never rejects; `false` on error, timeout, or no `document`); `withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T>` (resolves `fallback` on timeout, propagates rejection, always clears its timer); global `__GK_GD_GAME_ID__: string` (Vite/Vitest define); `GameManifest.portalIds?: { gamedistribution?: string }`; `createGameViteConfig` defines `__GK_GD_GAME_ID__` from env `GD_GAME_ID` (`''` when unset).
- Consumes: existing `GameManifest`, `validateManifest`, `createGameViteConfig(gameDir, env)`.

- [ ] **Step 1: Write the failing tests**

`packages/platform/src/withTimeout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { withTimeout } from './withTimeout.ts';

describe('withTimeout', () => {
  it('resolves with the promise value when it settles first', async () => {
    expect(await withTimeout(Promise.resolve('ok'), 1000, 'fallback')).toBe('ok');
  });

  it('resolves the fallback when the promise never settles', async () => {
    expect(await withTimeout(new Promise<string>(() => {}), 10, 'fallback')).toBe('fallback');
  });

  it('propagates rejections', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'fallback')).rejects.toThrow('boom');
  });
});
```

`packages/platform/src/loadScript.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScript } from './loadScript.ts';

const URL_A = 'https://sdk.example.test/a.js';
const find = (url: string) => document.head.querySelector<HTMLScriptElement>(`script[src="${url}"]`);

afterEach(() => {
  document.head.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('loadScript', () => {
  it('injects an async script tag and resolves true on load', async () => {
    const p = loadScript(URL_A, 1000);
    const el = find(URL_A);
    expect(el).not.toBeNull();
    expect(el!.async).toBe(true);
    el!.dispatchEvent(new Event('load'));
    expect(await p).toBe(true);
  });

  it('applies the optional element id', async () => {
    const p = loadScript(URL_A, 1000, 'my-sdk');
    expect(document.getElementById('my-sdk')).toBe(find(URL_A));
    find(URL_A)!.dispatchEvent(new Event('load'));
    await p;
  });

  it('resolves false (never rejects) on a script error and removes the tag', async () => {
    const p = loadScript(URL_A, 1000);
    find(URL_A)!.dispatchEvent(new Event('error'));
    expect(await p).toBe(false);
    expect(find(URL_A)).toBeNull();
  });

  it('resolves false on timeout', async () => {
    expect(await loadScript(URL_A, 10)).toBe(false);
    expect(find(URL_A)).toBeNull();
  });

  it('resolves false when there is no document', async () => {
    vi.stubGlobal('document', undefined);
    expect(await loadScript(URL_A, 10)).toBe(false);
  });
});
```

Append a test inside the `describe('validateManifest', ...)` block of `packages/game-kit/src/manifest.test.ts` — use the Edit tool with this exact anchor, which occurs once at the end of the file:

old_string:
```
    ).toMatch(/submittedAt/));
});
```
new_string:
```
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
```

Edit `packages/game-kit/src/viteConfig.test.ts` — old_string:
```
  it('defaults PLATFORM to local', () => {
    expect(createGameViteConfig('/tmp/g', {}).define?.__GK_TEST_HOOKS__).toBe('true');
  });
```
new_string:
```
  it('defaults PLATFORM to local', () => {
    expect(createGameViteConfig('/tmp/g', {}).define?.__GK_TEST_HOOKS__).toBe('true');
  });

  it('defines __GK_GD_GAME_ID__ from GD_GAME_ID, empty by default', () => {
    expect(createGameViteConfig('/tmp/g', {}).define?.__GK_GD_GAME_ID__).toBe('""');
    expect(createGameViteConfig('/tmp/g', { GD_GAME_ID: 'abc123' }).define?.__GK_GD_GAME_ID__).toBe('"abc123"');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/platform/src/withTimeout.test.ts packages/platform/src/loadScript.test.ts packages/game-kit/src/manifest.test.ts packages/game-kit/src/viteConfig.test.ts`
Expected: FAIL — `withTimeout.ts` / `loadScript.ts` cannot be resolved; manifest and vite-config new tests fail on assertions.

- [ ] **Step 3: Implement**

`packages/platform/src/withTimeout.ts`:
```ts
/** Resolves `fallback` if `promise` has not settled after `ms`. Rejections propagate. The timer is always cleared. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

`packages/platform/src/loadScript.ts`:
```ts
/**
 * Injects `<script src=url async>` into <head>. Resolves true on load, false on error, timeout or when there is
 * no DOM. Never rejects. On failure the tag is removed so a later retry starts clean.
 */
export function loadScript(url: string, timeoutMs: number, id?: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      if (typeof document === 'undefined') {
        resolve(false);
        return;
      }
      const el = document.createElement('script');
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (!ok) el.remove();
        resolve(ok);
      };
      timer = setTimeout(() => finish(false), timeoutMs);
      el.src = url;
      el.async = true;
      if (id) el.id = id;
      el.onload = () => finish(true);
      el.onerror = () => finish(false);
      document.head.appendChild(el);
    } catch {
      resolve(false);
    }
  });
}
```

`packages/platform/src/env.d.ts`:
```ts
/** GameDistribution game id, injected by Vite `define` (env GD_GAME_ID); '' when absent. */
declare const __GK_GD_GAME_ID__: string;
```

Append to `packages/platform/src/index.ts`:
```ts
export { loadScript } from './loadScript.ts';
export { withTimeout } from './withTimeout.ts';
```

Edit `vitest.config.ts` — old_string `define: { __GK_TEST_HOOKS__: 'false' },` new_string:
```ts
define: { __GK_TEST_HOOKS__: 'false', __GK_GD_GAME_ID__: '""' },
```

Edit `packages/game-kit/vite-config.ts` — old_string `    define: { __GK_TEST_HOOKS__: JSON.stringify(platform === 'local') },` new_string:
```ts
    define: {
      __GK_TEST_HOOKS__: JSON.stringify(platform === 'local'),
      __GK_GD_GAME_ID__: JSON.stringify(env.GD_GAME_ID ?? ''),
    },
```

Edit `packages/game-kit/src/manifest.ts`:

1. old_string `export type LocalizedText = { en: string } & Record<string, string>;` new_string:
```ts
export type LocalizedText = { en: string } & Record<string, string>;
export const PORTAL_ID_KEYS = ['gamedistribution'] as const;
export interface PortalIds {
  gamedistribution?: string;
}
```
2. old_string `  releases: Partial<Record<Target, Release>>;\n}` new_string:
```ts
  releases: Partial<Record<Target, Release>>;
  /** Ids issued by a portal dashboard; GameDistribution needs its gameId at build time. */
  portalIds?: PortalIds;
}
```
3. old_string `export function validateManifest(raw: unknown): ValidationResult {` new_string:
```ts
function checkPortalIds(v: unknown, errors: string[]): void {
  if (v === undefined) return;
  if (!isObject(v)) {
    errors.push('portalIds must be an object');
    return;
  }
  for (const [portal, id] of Object.entries(v)) {
    if (!oneOf(PORTAL_ID_KEYS, portal)) {
      errors.push(`portalIds.${portal}: unknown portal`);
      continue;
    }
    if (typeof id !== 'string' || id.trim() === '') errors.push(`portalIds.${portal} must be a non-empty string`);
  }
}

export function validateManifest(raw: unknown): ValidationResult {
```
4. old_string `  checkReleases(m.releases, errors);\n  return errors` new_string:
```ts
  checkReleases(m.releases, errors);
  checkPortalIds(m.portalIds, errors);
  return errors
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run packages/platform/src/withTimeout.test.ts packages/platform/src/loadScript.test.ts packages/game-kit/src/manifest.test.ts packages/game-kit/src/viteConfig.test.ts && npm run typecheck && npm test`
Expected: all PASS, typecheck prints no errors, full suite green (previous 99 tests plus the new ones).

- [ ] **Step 5: Commit and push**

```bash
git add packages/platform/src/loadScript.ts packages/platform/src/loadScript.test.ts packages/platform/src/withTimeout.ts packages/platform/src/withTimeout.test.ts packages/platform/src/env.d.ts packages/platform/src/index.ts packages/game-kit/vite-config.ts packages/game-kit/src/viteConfig.test.ts packages/game-kit/src/manifest.ts packages/game-kit/src/manifest.test.ts vitest.config.ts
git commit -m "$(cat <<'EOF'
feat(platform): add loadScript, withTimeout, manifest portalIds and GD game id define

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

---

### Task 2: `crazygames` adapter

**Files:**
- Create: `packages/platform/src/adapters/crazygames.ts`, `packages/platform/src/adapters/crazygames.test.ts`

**Interfaces:**
- Produces: `createPlatform(opts?: CrazyGamesOptions): Platform` and `CG_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'` exported from `adapters/crazygames.ts`. `CrazyGamesOptions = { loadScript?: (url: string, timeoutMs: number) => Promise<boolean>; loadTimeoutMs?: number /*8000*/; initTimeoutMs?: number /*8000*/; adTimeoutMs?: number /*60000*/; interstitialMinIntervalMs?: number /*60000*/; now?: () => number }`. Vite alias `@platform/active` picks it up automatically (`availablePlatforms()` lists files in `adapters/`).
- Consumes: `createAdEvents`, `createIntervalGate`, `createSafeLocalStorage`, `detectLocale`, `loadScript`, `withTimeout`, `runPlatformContract(name, { normal, failingAds })` (both factories return a `Platform`).

Behaviour (spec §3.1/§6, decisions): load SDK at `init()`; `await SDK.init()` inside try/catch; load failure, init failure/timeout or `SDK.environment === 'disabled'` → degraded (ads `'unavailable'`, storage `createSafeLocalStorage('gk:')`). Active: `ad.requestAd('midgame'|'rewarded', {adStarted, adFinished, adError})` wrapped in a Promise; `adStarted` → `emitPause`; `adFinished`/`adError` → `emitResume` only if paused; 60 s safety timeout → `'unavailable'`; interstitial gated 60 s in the adapter. `loadingProgress` first call → `game.loadingStart()`, `loadingDone` → `game.loadingStop()` (only if started); `gameplayStart/Stop` → `game.gameplayStart/Stop`. Storage uses `SDK.data` only when `environment === 'crazygames'` (keys `gk:<key>`), with localStorage as read fallback / write-through (this also migrates returning players' old keys). Every SDK call is try/catch-wrapped. `features = { externalLinks: false, leaderboard: false }`.

- [ ] **Step 1: Write the failing tests**

`packages/platform/src/adapters/crazygames.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { CG_SDK_URL, createPlatform, type CrazyGamesOptions } from './crazygames.ts';

type AdBehaviour = 'finish' | 'error' | 'throw' | 'silent';
interface MockOptions {
  environment?: string;
  ads?: AdBehaviour;
  initFails?: boolean;
  initHangs?: boolean;
  gameThrows?: boolean;
  dataThrows?: boolean;
}

function installMock(o: MockOptions = {}) {
  const calls: string[] = [];
  const data = new Map<string, string>();
  const game = (name: string) => () => {
    calls.push(name);
    if (o.gameThrows) throw new Error('SDK disabled');
  };
  const sdk = {
    environment: o.environment ?? 'crazygames',
    async init() {
      calls.push('init');
      if (o.initFails) throw new Error('init failed');
      if (o.initHangs) await new Promise<void>(() => {});
    },
    game: {
      loadingStart: game('game.loadingStart'),
      loadingStop: game('game.loadingStop'),
      gameplayStart: game('game.gameplayStart'),
      gameplayStop: game('game.gameplayStop'),
    },
    ad: {
      requestAd(
        type: string,
        cb: { adStarted(): void; adFinished(): void; adError(e: { code: string; message: string }): void },
      ) {
        calls.push(`ad.requestAd:${type}`);
        const mode = o.ads ?? 'finish';
        if (mode === 'throw') throw new Error('SDK disabled');
        queueMicrotask(() => {
          if (mode === 'silent') return;
          if (mode === 'error') {
            cb.adError({ code: 'unfilled', message: 'no fill' });
            return;
          }
          cb.adStarted();
          cb.adFinished();
        });
      },
    },
    data: {
      getItem(key: string) {
        if (o.dataThrows) throw new Error('data disabled');
        return data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (o.dataThrows) throw new Error('data disabled');
        data.set(key, value);
      },
    },
  };
  vi.stubGlobal('CrazyGames', { SDK: sdk });
  return { calls, data, sdk };
}

const make = (o: MockOptions = {}, p: CrazyGamesOptions = {}) => {
  const mock = installMock(o);
  const platform = createPlatform({ loadScript: async () => true, ...p });
  return { mock, platform };
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

runPlatformContract('crazygames', {
  normal: () => make().platform,
  failingAds: () => make({ ads: 'throw' }).platform,
});

describe('crazygames adapter specifics', () => {
  it('has id crazygames, no external links, no leaderboard', () => {
    const { platform } = make();
    expect(platform.id).toBe('crazygames');
    expect(platform.features).toEqual({ externalLinks: false, leaderboard: false });
  });

  it('loads the SDK script once and inits the SDK once even if init is called twice', async () => {
    const mock = installMock();
    const loadScript = vi.fn(async (_url: string, _ms: number) => true);
    const p = createPlatform({ loadScript });
    await p.init();
    await p.init();
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(loadScript).toHaveBeenCalledWith(CG_SDK_URL, expect.any(Number));
    expect(mock.calls.filter((c) => c === 'init')).toHaveLength(1);
  });

  describe('degraded mode', () => {
    it('script load failure: ads unavailable, storage via localStorage, SDK untouched', async () => {
      const mock = installMock();
      const p = createPlatform({ loadScript: async () => false });
      const log: string[] = [];
      p.onAdPause(() => log.push('pause'));
      await p.init();
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(await p.showRewarded()).toBe('unavailable');
      expect(log).toEqual([]);
      await p.storage.set('k', 'v');
      expect(localStorage.getItem('gk:k')).toBe('v');
      p.loadingProgress(0.5);
      p.gameplayStart();
      expect(mock.calls).toEqual([]);
    });

    it('window.CrazyGames missing after load (adblock) is degraded, not an error', async () => {
      const p = createPlatform({ loadScript: async () => true });
      await p.init();
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it('SDK.init rejecting is degraded', async () => {
      const mock = installMock({ initFails: true });
      const p = createPlatform({ loadScript: async () => true });
      await expect(p.init()).resolves.toBeUndefined();
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(mock.calls).toEqual(['init']);
    });

    it('SDK.init hanging past initTimeoutMs is degraded', async () => {
      installMock({ initHangs: true });
      const p = createPlatform({ loadScript: async () => true, initTimeoutMs: 20 });
      await p.init();
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it("environment 'disabled' is degraded and never requests ads", async () => {
      const mock = installMock({ environment: 'disabled' });
      const p = createPlatform({ loadScript: async () => true });
      await p.init();
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(await p.showRewarded()).toBe('unavailable');
      expect(mock.calls.filter((c) => c.startsWith('ad.'))).toEqual([]);
      await p.storage.set('a', '1');
      expect(localStorage.getItem('gk:a')).toBe('1');
    });
  });

  describe('ads', () => {
    it('midgame resolves shown and rewarded resolves rewarded on adFinished, with pause then resume', async () => {
      const { mock, platform } = make();
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(await platform.showRewarded()).toBe('rewarded');
      expect(log).toEqual(['pause', 'resume', 'pause', 'resume']);
      expect(mock.calls).toContain('ad.requestAd:midgame');
      expect(mock.calls).toContain('ad.requestAd:rewarded');
    });

    it('adError resolves unavailable for both kinds and emits no pause/resume', async () => {
      const { platform } = make({ ads: 'error' });
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(await platform.showRewarded()).toBe('unavailable');
      expect(log).toEqual([]);
    });

    it('safety timeout resolves unavailable when the SDK never calls back', async () => {
      const { platform } = make({ ads: 'silent' }, { adTimeoutMs: 20 });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
    });

    it('resumes if the safety timeout fires after adStarted', async () => {
      installMock();
      const sdk = (globalThis as unknown as { CrazyGames: { SDK: { ad: { requestAd: (t: string, cb: { adStarted(): void }) => void } } } })
        .CrazyGames.SDK;
      sdk.ad.requestAd = (_t, cb) => cb.adStarted();
      const p = createPlatform({ loadScript: async () => true, adTimeoutMs: 20 });
      const log: string[] = [];
      p.onAdPause(() => log.push('pause'));
      p.onAdResume(() => log.push('resume'));
      await p.init();
      expect(await p.showRewarded()).toBe('unavailable');
      expect(log).toEqual(['pause', 'resume']);
    });

    it('gates interstitials at 60 s but never gates rewarded', async () => {
      let t = 0;
      const { mock, platform } = make({}, { now: () => t });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      t = 59_999;
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(await platform.showRewarded()).toBe('rewarded');
      expect(mock.calls.filter((c) => c === 'ad.requestAd:midgame')).toHaveLength(1);
      t = 60_000;
      expect(await platform.showInterstitial()).toBe('shown');
    });
  });

  describe('lifecycle', () => {
    it('maps loading and gameplay calls onto the SDK game module', async () => {
      const { mock, platform } = make();
      await platform.init();
      platform.loadingProgress(0.1);
      platform.loadingProgress(0.6);
      platform.loadingDone();
      platform.gameplayStart();
      platform.gameplayStop();
      expect(mock.calls).toEqual(['init', 'game.loadingStart', 'game.loadingStop', 'game.gameplayStart', 'game.gameplayStop']);
    });

    it('loadingDone without any progress does not call loadingStop', async () => {
      const { mock, platform } = make();
      await platform.init();
      platform.loadingDone();
      expect(mock.calls).toEqual(['init']);
    });

    it('swallows SDK exceptions from the game module', async () => {
      const { platform } = make({ gameThrows: true });
      await platform.init();
      expect(() => {
        platform.loadingProgress(0.5);
        platform.loadingDone();
        platform.gameplayStart();
        platform.gameplayStop();
      }).not.toThrow();
    });
  });

  describe('storage', () => {
    it("uses SDK.data with the gk: prefix when environment is 'crazygames'", async () => {
      const { mock, platform } = make();
      await platform.init();
      await platform.storage.set('a', '1');
      expect(mock.data.get('gk:a')).toBe('1');
      mock.data.set('gk:b', '2');
      expect(await platform.storage.get('b')).toBe('2');
    });

    it("uses localStorage (not SDK.data) when environment is 'local'", async () => {
      const { mock, platform } = make({ environment: 'local' });
      await platform.init();
      await platform.storage.set('a', '1');
      expect(mock.data.size).toBe(0);
      expect(localStorage.getItem('gk:a')).toBe('1');
    });

    it('reads a pre-existing localStorage value when SDK.data has none (migration)', async () => {
      const { platform } = make();
      await platform.init();
      localStorage.setItem('gk:old', '9');
      expect(await platform.storage.get('old')).toBe('9');
    });

    it('falls back to localStorage when SDK.data throws', async () => {
      const { platform } = make({ dataThrows: true });
      await platform.init();
      await expect(platform.storage.set('k', 'v')).resolves.toBeUndefined();
      expect(await platform.storage.get('k')).toBe('v');
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/platform/src/adapters/crazygames.test.ts`
Expected: FAIL — cannot resolve `./crazygames.ts`.

- [ ] **Step 3: Implement the adapter**

`packages/platform/src/adapters/crazygames.ts`:
```ts
import { createAdEvents } from '../adEvents.ts';
import { createIntervalGate } from '../intervalGate.ts';
import { loadScript as defaultLoadScript } from '../loadScript.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { AdResult, Platform } from '../types.ts';
import { withTimeout } from '../withTimeout.ts';

export const CG_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

interface CgAdCallbacks {
  adStarted(): void;
  adFinished(): void;
  adError(error?: unknown): void;
}

/** Subset of window.CrazyGames.SDK (v3) used here. Every member may throw when the SDK is disabled. */
interface CgSdk {
  environment?: string;
  init(): Promise<void>;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
  };
  ad: { requestAd(type: 'midgame' | 'rewarded', callbacks: CgAdCallbacks): void };
  data: { getItem(key: string): unknown; setItem(key: string, value: string): unknown };
}

export interface CrazyGamesOptions {
  loadScript?: (url: string, timeoutMs: number) => Promise<boolean>;
  loadTimeoutMs?: number;
  initTimeoutMs?: number;
  /** Safety net if the SDK never calls back (default 60 s). */
  adTimeoutMs?: number;
  interstitialMinIntervalMs?: number;
  now?: () => number;
}

const readSdk = (): CgSdk | null =>
  (globalThis as unknown as { CrazyGames?: { SDK?: CgSdk } }).CrazyGames?.SDK ?? null;

export function createPlatform(opts: CrazyGamesOptions = {}): Platform {
  const events = createAdEvents();
  const gate = createIntervalGate(opts.interstitialMinIntervalMs ?? 60_000, opts.now);
  const load = opts.loadScript ?? defaultLoadScript;
  const fallback = createSafeLocalStorage('gk:');
  const adTimeoutMs = opts.adTimeoutMs ?? 60_000;

  /** Non-null only when the SDK initialised and is not disabled. */
  let sdk: CgSdk | null = null;
  let useSdkData = false;
  let loadingStarted = false;
  let initPromise: Promise<void> | null = null;

  async function doInit(): Promise<void> {
    try {
      if (!(await load(CG_SDK_URL, opts.loadTimeoutMs ?? 8000))) return;
      const candidate = readSdk();
      if (!candidate) return;
      const ok = await withTimeout(candidate.init().then(() => true), opts.initTimeoutMs ?? 8000, false);
      if (!ok || candidate.environment === 'disabled') return;
      sdk = candidate;
      useSdkData = candidate.environment === 'crazygames';
    } catch {
      sdk = null;
      useSdkData = false;
    }
  }

  const callSdk = (fn: (s: CgSdk) => void): void => {
    if (!sdk) return;
    try {
      fn(sdk);
    } catch {
      // The SDK throws when disabled; never let that reach the game.
    }
  };

  function requestAd(type: 'midgame' | 'rewarded'): Promise<AdResult> {
    const active = sdk;
    if (!active) return Promise.resolve('unavailable');
    return new Promise<AdResult>((resolve) => {
      let settled = false;
      let paused = false;
      const timer = setTimeout(() => settle('unavailable'), adTimeoutMs);
      const settle = (result: AdResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (paused) {
          paused = false;
          events.emitResume();
        }
        resolve(result);
      };
      try {
        active.ad.requestAd(type, {
          adStarted: () => {
            if (settled || paused) return;
            paused = true;
            events.emitPause();
          },
          adFinished: () => settle(type === 'rewarded' ? 'rewarded' : 'shown'),
          adError: () => settle('unavailable'),
        });
      } catch {
        settle('unavailable');
      }
    });
  }

  return {
    id: 'crazygames',
    features: { externalLinks: false, leaderboard: false },
    init() {
      initPromise ??= doInit();
      return initPromise;
    },
    loadingProgress() {
      if (loadingStarted) return;
      loadingStarted = true;
      callSdk((s) => s.game.loadingStart());
    },
    loadingDone() {
      if (!loadingStarted) return;
      callSdk((s) => s.game.loadingStop());
    },
    gameplayStart: () => callSdk((s) => s.game.gameplayStart()),
    gameplayStop: () => callSdk((s) => s.game.gameplayStop()),
    async showInterstitial() {
      if (!sdk) return 'unavailable';
      if (!gate.tryPass()) return 'unavailable';
      return requestAd('midgame');
    },
    async showRewarded() {
      if (!sdk) return 'unavailable';
      return requestAd('rewarded');
    },
    storage: {
      async get(key) {
        const active = sdk;
        if (useSdkData && active) {
          try {
            const v = await active.data.getItem(`gk:${key}`);
            if (typeof v === 'string') return v;
          } catch {
            // fall through to the local copy
          }
        }
        return fallback.get(key);
      },
      async set(key, value) {
        await fallback.set(key, value);
        const active = sdk;
        if (useSdkData && active) {
          try {
            await active.data.setItem(`gk:${key}`, value);
          } catch {
            // local copy already stored
          }
        }
      },
    },
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
```

- [ ] **Step 4: Run tests, typecheck, and verify a real crazygames build**

Run: `npx vitest run packages/platform/src/adapters/crazygames.test.ts && npm run typecheck && npm test`
Expected: all PASS (contract suite for `crazygames` plus the specific tests), typecheck clean.

Then verify the Vite alias picks the new adapter and only it:
```bash
node scripts/build-games.ts crazygames
grep -l "sdk.crazygames.com" dist/crazygames/dodge-drop/assets/*.js
grep -L "html5.api.gamedistribution.com" dist/crazygames/dodge-drop/assets/*.js
```
Expected: first grep prints the bundle path (SDK URL present); second grep also prints the bundle path (`-L` lists files WITHOUT the GD host, i.e. no GameDistribution code leaked). Output of the build script ends with `[build] 1 game(s) built for crazygames`.

- [ ] **Step 5: Commit and push**

```bash
git add packages/platform/src/adapters/crazygames.ts packages/platform/src/adapters/crazygames.test.ts
git commit -m "$(cat <<'EOF'
feat(platform): add crazygames adapter with degraded mode and ad/data mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

---

### Task 3: `gamedistribution` adapter

**Files:**
- Create: `packages/platform/src/adapters/gamedistribution.ts`, `packages/platform/src/adapters/gamedistribution.test.ts`
- Modify: `packages/game-kit/src/viteConfig.test.ts` (adapter list)

**Interfaces:**
- Produces: `createPlatform(opts?: GameDistributionOptions): Platform` and `GD_SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js'`. `GameDistributionOptions = { gameId?: string /*default __GK_GD_GAME_ID__*/; loadScript?: (url: string, timeoutMs: number) => Promise<boolean>; loadTimeoutMs?: number /*8000*/; readyTimeoutMs?: number /*8000*/; adTimeoutMs?: number /*60000*/; interstitialMinIntervalMs?: number /*60000*/; now?: () => number }`.
- Consumes: Task 1 (`__GK_GD_GAME_ID__`, `loadScript`, `withTimeout`), `runPlatformContract`.

Behaviour (decisions + research B1–B3): empty `gameId` → degraded without loading any script. Otherwise set `globalThis.GD_OPTIONS = { gameId, onEvent }` BEFORE `loadScript(GD_SDK_URL)`; wait for the `SDK_READY` event (timeout → degraded). `onEvent`: `SDK_GAME_PAUSE` → `emitPause` (once), `SDK_GAME_START` → `emitResume` only if paused, `SDK_REWARDED_WATCH_COMPLETE` → remembered only while a rewarded call is in flight. Interstitial: `gdsdk.showAd()` → `'shown'`; any error/timeout → `'unavailable'`. Rewarded: `preloadAd('rewarded')` (reject → `'unavailable'`), then `showAd('rewarded')`; `'rewarded'` ONLY if `SDK_REWARDED_WATCH_COMPLETE` fired during that call, else `'skipped'`; any error → `'unavailable'`. After any ad settles, if still paused, resume (never leave the game frozen). Interstitial gate 60 s. Storage = safe localStorage `gk:`. `features = { externalLinks: false, leaderboard: false }`.

- [ ] **Step 1: Write the failing tests**

`packages/platform/src/adapters/gamedistribution.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { GD_SDK_URL, createPlatform, type GameDistributionOptions } from './gamedistribution.ts';

interface EnvOptions {
  ready?: boolean;
  loadOk?: boolean;
  showAd?: 'ok' | 'reject' | 'hang';
  /** Fire SDK_REWARDED_WATCH_COMPLETE during a rewarded showAd. */
  watch?: boolean;
  /** Fire SDK_GAME_START after the ad (real SDK does; a broken one may not). */
  sendStart?: boolean;
  preload?: 'ok' | 'reject';
}

type GdOptionsGlobal = { GD_OPTIONS?: { gameId: string; onEvent(e: { name: string }): void } };
const emit = (name: string): void => (globalThis as unknown as GdOptionsGlobal).GD_OPTIONS!.onEvent({ name });

function makeEnv(o: EnvOptions = {}) {
  const calls: string[] = [];
  const urls: string[] = [];
  let optionsAtLoad: GdOptionsGlobal['GD_OPTIONS'];
  const gdsdk = {
    async preloadAd(type: string) {
      calls.push(`preloadAd:${type}`);
      if (o.preload === 'reject') throw new Error('no ad');
    },
    async showAd(type?: string) {
      calls.push(`showAd:${type ?? 'interstitial'}`);
      emit('SDK_GAME_PAUSE');
      if (o.showAd === 'hang') return new Promise<void>(() => {});
      if (o.showAd === 'reject') throw new Error('ad error');
      if (type === 'rewarded' && o.watch) emit('SDK_REWARDED_WATCH_COMPLETE');
      if (o.sendStart !== false) emit('SDK_GAME_START');
    },
  };
  const loadScript = async (url: string, _ms: number): Promise<boolean> => {
    urls.push(url);
    optionsAtLoad = (globalThis as unknown as GdOptionsGlobal).GD_OPTIONS;
    if (o.loadOk === false) return false;
    vi.stubGlobal('gdsdk', gdsdk);
    if (o.ready !== false) setTimeout(() => emit('SDK_READY'), 0);
    return true;
  };
  return { calls, urls, loadScript, optionsAtLoad: () => optionsAtLoad };
}

const make = (o: EnvOptions = {}, p: GameDistributionOptions = {}) => {
  const env = makeEnv(o);
  const platform = createPlatform({ gameId: 'test-game-id', loadScript: env.loadScript, ...p });
  return { env, platform };
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as unknown as GdOptionsGlobal).GD_OPTIONS;
  localStorage.clear();
});

runPlatformContract('gamedistribution', {
  normal: () => make({ watch: true }).platform,
  failingAds: () => make({ showAd: 'reject', preload: 'reject' }).platform,
});

describe('gamedistribution adapter specifics', () => {
  it('has id gamedistribution, no external links, no leaderboard', () => {
    const { platform } = make();
    expect(platform.id).toBe('gamedistribution');
    expect(platform.features).toEqual({ externalLinks: false, leaderboard: false });
  });

  it('sets GD_OPTIONS (gameId + onEvent) BEFORE loading the SDK script', async () => {
    const { env, platform } = make();
    await platform.init();
    expect(env.urls).toEqual([GD_SDK_URL]);
    const opts = env.optionsAtLoad();
    expect(opts?.gameId).toBe('test-game-id');
    expect(typeof opts?.onEvent).toBe('function');
  });

  describe('degraded mode', () => {
    it('empty gameId: never loads the script, ads unavailable', async () => {
      const env = makeEnv();
      const p = createPlatform({ gameId: '', loadScript: env.loadScript });
      await p.init();
      expect(env.urls).toEqual([]);
      expect(await p.showInterstitial()).toBe('unavailable');
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it('the build-time default gameId is empty under test, hence degraded', async () => {
      const env = makeEnv();
      const p = createPlatform({ loadScript: env.loadScript });
      await p.init();
      expect(env.urls).toEqual([]);
      expect(await p.showRewarded()).toBe('unavailable');
    });

    it('script load failure is degraded and init still resolves', async () => {
      const { env, platform } = make({ loadOk: false });
      await expect(platform.init()).resolves.toBeUndefined();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(env.calls).toEqual([]);
    });

    it('SDK_READY never arriving within readyTimeoutMs is degraded', async () => {
      const { env, platform } = make({ ready: false }, { readyTimeoutMs: 20 });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(env.calls).toEqual([]);
    });

    it('degraded storage still round-trips through localStorage with the gk: prefix', async () => {
      const p = createPlatform({ gameId: '', loadScript: async () => false });
      await p.storage.set('x', '1');
      expect(localStorage.getItem('gk:x')).toBe('1');
      expect(await p.storage.get('x')).toBe('1');
    });
  });

  describe('pause/resume events', () => {
    it('maps SDK_GAME_PAUSE to pause and SDK_GAME_START to resume', async () => {
      const { platform } = make();
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      emit('SDK_GAME_PAUSE');
      emit('SDK_GAME_PAUSE');
      emit('SDK_GAME_START');
      expect(log).toEqual(['pause', 'resume']);
    });

    it('ignores SDK_GAME_START when not paused', async () => {
      const { platform } = make();
      const log: string[] = [];
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      emit('SDK_GAME_START');
      expect(log).toEqual([]);
    });

    it('resumes after an ad even when the SDK never sends SDK_GAME_START', async () => {
      const { platform } = make({ sendStart: false });
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(log).toEqual(['pause', 'resume']);
    });
  });

  describe('interstitial', () => {
    it('resolves shown via gdsdk.showAd()', async () => {
      const { env, platform } = make();
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(env.calls).toEqual(['showAd:interstitial']);
    });

    it('resolves unavailable when showAd rejects', async () => {
      const { platform } = make({ showAd: 'reject' });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
    });

    it('resolves unavailable and resumes when showAd hangs past adTimeoutMs', async () => {
      const { platform } = make({ showAd: 'hang' }, { adTimeoutMs: 20 });
      const log: string[] = [];
      platform.onAdPause(() => log.push('pause'));
      platform.onAdResume(() => log.push('resume'));
      await platform.init();
      expect(await platform.showInterstitial()).toBe('unavailable');
      expect(log).toEqual(['pause', 'resume']);
    });

    it('is gated at 60 s', async () => {
      let t = 0;
      const { env, platform } = make({}, { now: () => t });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      t = 59_999;
      expect(await platform.showInterstitial()).toBe('unavailable');
      t = 60_000;
      expect(await platform.showInterstitial()).toBe('shown');
      expect(env.calls.filter((c) => c === 'showAd:interstitial')).toHaveLength(2);
    });
  });

  describe('rewarded', () => {
    it("is 'rewarded' ONLY when SDK_REWARDED_WATCH_COMPLETE fired during the call", async () => {
      const { env, platform } = make({ watch: true });
      await platform.init();
      expect(await platform.showRewarded()).toBe('rewarded');
      expect(env.calls).toEqual(['preloadAd:rewarded', 'showAd:rewarded']);
    });

    it("is 'skipped' when the ad showed but no WATCH_COMPLETE arrived", async () => {
      const { platform } = make({ watch: false });
      await platform.init();
      expect(await platform.showRewarded()).toBe('skipped');
    });

    it('a WATCH_COMPLETE from outside the call does not leak into the next rewarded call', async () => {
      const { platform } = make({ watch: false });
      await platform.init();
      emit('SDK_REWARDED_WATCH_COMPLETE');
      expect(await platform.showRewarded()).toBe('skipped');
    });

    it('preloadAd rejection is unavailable and showAd is not called', async () => {
      const { env, platform } = make({ preload: 'reject', watch: true });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
      expect(env.calls).toEqual(['preloadAd:rewarded']);
    });

    it('showAd rejection is unavailable', async () => {
      const { platform } = make({ showAd: 'reject', watch: true });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
    });

    it('hanging showAd resolves unavailable after adTimeoutMs', async () => {
      const { platform } = make({ showAd: 'hang' }, { adTimeoutMs: 20 });
      await platform.init();
      expect(await platform.showRewarded()).toBe('unavailable');
    });

    it('is not gated by the interstitial interval', async () => {
      let t = 0;
      const { platform } = make({ watch: true }, { now: () => t });
      await platform.init();
      expect(await platform.showInterstitial()).toBe('shown');
      expect(await platform.showRewarded()).toBe('rewarded');
    });
  });
});
```

Edit `packages/game-kit/src/viteConfig.test.ts` — old_string:
```
    expect(availablePlatforms()).toEqual(expect.arrayContaining(['local', 'site']));
```
new_string:
```
    expect(availablePlatforms()).toEqual(expect.arrayContaining(['local', 'site', 'crazygames', 'gamedistribution']));
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/platform/src/adapters/gamedistribution.test.ts packages/game-kit/src/viteConfig.test.ts`
Expected: FAIL — cannot resolve `./gamedistribution.ts`; the viteConfig adapter-list test fails on the missing `gamedistribution`.

- [ ] **Step 3: Implement the adapter**

`packages/platform/src/adapters/gamedistribution.ts`:
```ts
import { createAdEvents } from '../adEvents.ts';
import { createIntervalGate } from '../intervalGate.ts';
import { loadScript as defaultLoadScript } from '../loadScript.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { AdResult, Platform } from '../types.ts';
import { withTimeout } from '../withTimeout.ts';

export const GD_SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js';

interface GdSdk {
  showAd(type?: string): Promise<unknown>;
  preloadAd(type: string): Promise<unknown>;
}

interface GdGlobals {
  GD_OPTIONS?: { gameId: string; onEvent: (event: { name?: string } | undefined) => void };
  gdsdk?: Partial<GdSdk>;
}

export interface GameDistributionOptions {
  /** Defaults to the build-time define `__GK_GD_GAME_ID__` ('' when the game has no portalIds.gamedistribution). */
  gameId?: string;
  loadScript?: (url: string, timeoutMs: number) => Promise<boolean>;
  loadTimeoutMs?: number;
  /** How long to wait for the SDK_READY event after the script loaded (default 8 s). */
  readyTimeoutMs?: number;
  /** Safety net if showAd/preloadAd never settle (default 60 s). */
  adTimeoutMs?: number;
  interstitialMinIntervalMs?: number;
  now?: () => number;
}

export function createPlatform(opts: GameDistributionOptions = {}): Platform {
  const events = createAdEvents();
  const gate = createIntervalGate(opts.interstitialMinIntervalMs ?? 60_000, opts.now);
  const load = opts.loadScript ?? defaultLoadScript;
  const gameId = opts.gameId ?? __GK_GD_GAME_ID__;
  const adTimeoutMs = opts.adTimeoutMs ?? 60_000;
  const g = globalThis as unknown as GdGlobals;

  let active = false;
  let paused = false;
  let rewardedInFlight = false;
  let rewardCompleted = false;
  let initPromise: Promise<void> | null = null;

  const resume = (): void => {
    if (!paused) return;
    paused = false;
    events.emitResume();
  };

  function onEvent(name: string | undefined): void {
    switch (name) {
      case 'SDK_GAME_PAUSE':
        if (!paused) {
          paused = true;
          events.emitPause();
        }
        break;
      case 'SDK_GAME_START':
        resume();
        break;
      case 'SDK_REWARDED_WATCH_COMPLETE':
        if (rewardedInFlight) rewardCompleted = true;
        break;
      default:
        break;
    }
  }

  async function doInit(): Promise<void> {
    if (gameId === '') return;
    try {
      let markReady!: () => void;
      const ready = new Promise<boolean>((resolve) => {
        markReady = () => resolve(true);
      });
      // GD_OPTIONS must exist BEFORE the SDK script executes.
      g.GD_OPTIONS = {
        gameId,
        onEvent: (event) => {
          try {
            onEvent(event?.name);
            if (event?.name === 'SDK_READY') markReady();
          } catch {
            // never throw back into the SDK
          }
        },
      };
      if (!(await load(GD_SDK_URL, opts.loadTimeoutMs ?? 8000))) return;
      active = await withTimeout(ready, opts.readyTimeoutMs ?? 8000, false);
    } catch {
      active = false;
    }
  }

  const usableSdk = (): GdSdk | null => {
    const sdk = g.gdsdk;
    if (!active || !sdk || typeof sdk.showAd !== 'function' || typeof sdk.preloadAd !== 'function') return null;
    return sdk as GdSdk;
  };

  return {
    id: 'gamedistribution',
    features: { externalLinks: false, leaderboard: false },
    init() {
      initPromise ??= doInit();
      return initPromise;
    },
    loadingProgress() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    async showInterstitial(): Promise<AdResult> {
      const sdk = usableSdk();
      if (!sdk) return 'unavailable';
      if (!gate.tryPass()) return 'unavailable';
      try {
        return await withTimeout(sdk.showAd().then((): AdResult => 'shown'), adTimeoutMs, 'unavailable');
      } catch {
        return 'unavailable';
      } finally {
        resume();
      }
    },
    async showRewarded(): Promise<AdResult> {
      const sdk = usableSdk();
      if (!sdk) return 'unavailable';
      try {
        const preloaded = await withTimeout(sdk.preloadAd('rewarded').then(() => true), adTimeoutMs, false);
        if (!preloaded) return 'unavailable';
        rewardedInFlight = true;
        rewardCompleted = false;
        const finished = await withTimeout(sdk.showAd('rewarded').then(() => true), adTimeoutMs, false);
        if (!finished) return 'unavailable';
        // showAd resolving is NOT proof of reward; only SDK_REWARDED_WATCH_COMPLETE is.
        return rewardCompleted ? 'rewarded' : 'skipped';
      } catch {
        return 'unavailable';
      } finally {
        rewardedInFlight = false;
        resume();
      }
    },
    storage: createSafeLocalStorage('gk:'),
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
```

- [ ] **Step 4: Run tests, typecheck, verify a real GD build**

Run: `npx vitest run packages/platform/src/adapters/gamedistribution.test.ts packages/game-kit/src/viteConfig.test.ts && npm run typecheck && npm test`
Expected: all PASS.

Then:
```bash
GD_GAME_ID=demo-id-123 node scripts/build-games.ts gamedistribution
grep -l "html5.api.gamedistribution.com" dist/gamedistribution/dodge-drop/assets/*.js
grep -l "demo-id-123" dist/gamedistribution/dodge-drop/assets/*.js
grep -L "sdk.crazygames.com" dist/gamedistribution/dodge-drop/assets/*.js
```
Expected: each grep prints the bundle path (GD URL present, the injected id inlined, and no CrazyGames code leaked).

- [ ] **Step 5: Commit and push**

```bash
git add packages/platform/src/adapters/gamedistribution.ts packages/platform/src/adapters/gamedistribution.test.ts packages/game-kit/src/viteConfig.test.ts
git commit -m "$(cat <<'EOF'
feat(platform): add gamedistribution adapter with build-time game id and reward-on-complete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

---

### Task 4: `check-artifact`

**Files:**
- Create: `scripts/check-artifact.ts`, `scripts/check-artifact.test.ts`

**Interfaces:**
- Produces: `type PortalPlatform = 'crazygames' | 'gamedistribution'`; `checkArtifact(dir: string, platform: PortalPlatform): string[]` (empty array = pass); constants `MAX_ARTIFACT_BYTES` (10 MiB), `SDK_HOSTS`, `INERT_HOSTS`. CLI: `node scripts/check-artifact.ts <dir> <platform>` (exit 1 on errors).
- Consumes: nothing from earlier tasks (pure fs).

Rules (spec §7 + decisions): total size ≤ 10 MiB; no symlinks (so every file is physically inside `dir` and paths are relative); `index.html` at root; in `.html/.js/.css/.json` files every absolute `http(s)` URL host must be the platform's SDK host or in `INERT_HOSTS`; the OTHER portal's SDK host must not appear at all; `index.html` must not use root-absolute (`/x`) or protocol-relative (`//x`) `src`/`href`. `INERT_HOSTS` was discovered from a real P1 build of `dodge-drop` (`PLATFORM=site`): the Phaser bundle embeds strings for `opensource.org`, `prunegames.com`, `github.com`, `www.w3.org`, `phaser.io`, `steffe.se` — license/credit/namespace text, never fetched. Keep the list minimal; add a host only after inspecting the surrounding bytes in the bundle (Task 5 step 4 re-verifies against the real portal builds).

- [ ] **Step 1: Write the failing tests**

`scripts/check-artifact.test.ts`:
```ts
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkArtifact, MAX_ARTIFACT_BYTES, SDK_HOSTS } from './check-artifact.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'gk-artifact-'));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const INDEX = '<!doctype html><script type="module" src="./assets/main.js"></script>';

describe('checkArtifact', () => {
  it('passes a clean crazygames build (own SDK host + inert namespace host)', () => {
    const dir = fixture({
      'index.html': INDEX,
      'assets/main.js': `fetch("https://${SDK_HOSTS.crazygames}/crazygames-sdk-v3.js");var ns="http://www.w3.org/2000/svg";`,
    });
    expect(checkArtifact(dir, 'crazygames')).toEqual([]);
  });

  it('passes a clean gamedistribution build', () => {
    const dir = fixture({
      'index.html': INDEX,
      'assets/main.js': `load("https://${SDK_HOSTS.gamedistribution}/main.min.js")`,
    });
    expect(checkArtifact(dir, 'gamedistribution')).toEqual([]);
  });

  it('reports a missing directory', () => {
    expect(checkArtifact(join(tmpdir(), 'gk-does-not-exist-xyz'), 'crazygames')[0]).toMatch(/does not exist/);
  });

  it('requires index.html at the root', () => {
    const dir = fixture({ 'sub/index.html': INDEX });
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/index\.html missing at the artifact root/);
  });

  it('rejects artifacts over 10 MB', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/big.bin': Buffer.alloc(MAX_ARTIFACT_BYTES + 1) });
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/exceeds the 10 MB limit/);
  });

  it('accepts an artifact exactly at the limit', () => {
    const pad = MAX_ARTIFACT_BYTES - INDEX.length;
    const dir = fixture({ 'index.html': INDEX, 'assets/pad.bin': Buffer.alloc(pad) });
    expect(checkArtifact(dir, 'crazygames')).toEqual([]);
  });

  it('rejects external hosts outside the allowlist, naming host and file', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/main.js': 'img.src="https://cdn.evil.test/x.png"' });
    const errors = checkArtifact(dir, 'crazygames');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/cdn\.evil\.test/);
    expect(errors[0]).toMatch(/assets\/main\.js/);
  });

  it('scans css and json too', () => {
    const dir = fixture({
      'index.html': INDEX,
      'a.css': 'body{background:url(https://css.evil.test/b.png)}',
      'b.json': '{"u":"http://json.evil.test/p"}',
    });
    const text = checkArtifact(dir, 'gamedistribution').join('\n');
    expect(text).toMatch(/css\.evil\.test/);
    expect(text).toMatch(/json\.evil\.test/);
  });

  it("rejects the other portal's SDK host with a foreign-SDK message (and no duplicate allowlist error)", () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/main.js': `"https://${SDK_HOSTS.crazygames}/x.js"` });
    const errors = checkArtifact(dir, 'gamedistribution');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/foreign portal SDK/);
    expect(errors[0]).toContain(SDK_HOSTS.crazygames);
  });

  it('rejects the foreign SDK host even when it is not a full URL', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/main.js': `var h="${SDK_HOSTS.gamedistribution}"` });
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/foreign portal SDK/);
  });

  it('rejects root-absolute and protocol-relative paths in index.html', () => {
    const a = fixture({ 'index.html': '<script src="/assets/main.js"></script>' });
    const b = fixture({ 'index.html': '<link href="//cdn.test/x.css">' });
    expect(checkArtifact(a, 'crazygames').join('\n')).toMatch(/root-absolute/);
    expect(checkArtifact(b, 'crazygames').join('\n')).toMatch(/root-absolute/);
  });

  it('rejects symlinks', () => {
    const dir = fixture({ 'index.html': INDEX });
    symlinkSync(tmpdir(), join(dir, 'escape'));
    expect(checkArtifact(dir, 'crazygames').join('\n')).toMatch(/symlink not allowed: escape/);
  });

  it('does not scan binary files for URLs', () => {
    const dir = fixture({ 'index.html': INDEX, 'assets/a.png': Buffer.from('http://binary.evil.test/x') });
    expect(checkArtifact(dir, 'crazygames')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/check-artifact.test.ts`
Expected: FAIL — cannot resolve `./check-artifact.ts`.

- [ ] **Step 3: Implement**

`scripts/check-artifact.ts`:
```ts
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PortalPlatform = 'crazygames' | 'gamedistribution';

export const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

export const SDK_HOSTS: Record<PortalPlatform, string> = {
  crazygames: 'sdk.crazygames.com',
  gamedistribution: 'html5.api.gamedistribution.com',
};

const FOREIGN_SDK_HOST: Record<PortalPlatform, string> = {
  crazygames: SDK_HOSTS.gamedistribution,
  gamedistribution: SDK_HOSTS.crazygames,
};

/**
 * Hosts that appear as inert text inside the bundled Phaser library (license headers, credits, XML/SVG
 * namespaces). Found by scanning a real PLATFORM=site build of dodge-drop; none is ever fetched at runtime.
 * Keep this list minimal: add a host only after inspecting its context in the bundle.
 */
export const INERT_HOSTS: readonly string[] = [
  'www.w3.org',
  'opensource.org',
  'github.com',
  'phaser.io',
  'prunegames.com',
  'steffe.se',
];

const TEXT_EXT = new Set(['.html', '.js', '.css', '.json']);
const URL_RE = /https?:\/\/[^\s"'`<>()\\]+/gi;
const HOST_RE = /^https?:\/\/([^/:?#]+)/i;
const VALID_HOST_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const ROOT_ABSOLUTE_RE = /\b(?:src|href)\s*=\s*["']\/(?:[^/]|\/)/i;

interface FileInfo {
  rel: string;
  abs: string;
  size: number;
}

function walk(root: string, errors: string[]): FileInfo[] {
  const out: FileInfo[] = [];
  const visit = (abs: string): void => {
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name);
      const rel = relative(root, p).split(sep).join('/');
      const st = lstatSync(p);
      if (st.isSymbolicLink()) {
        errors.push(`symlink not allowed: ${rel}`);
        continue;
      }
      if (st.isDirectory()) visit(p);
      else if (st.isFile()) out.push({ rel, abs: p, size: st.size });
    }
  };
  visit(root);
  return out;
}

/** Returns a list of human-readable errors; an empty list means the artifact is acceptable for `platform`. */
export function checkArtifact(dir: string, platform: PortalPlatform): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [`artifact directory does not exist: ${dir}`];
  const errors: string[] = [];
  const files = walk(dir, errors);

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_ARTIFACT_BYTES) {
    errors.push(`total size ${(total / 1024 / 1024).toFixed(2)} MB exceeds the 10 MB limit`);
  }
  if (!files.some((f) => f.rel === 'index.html')) errors.push('index.html missing at the artifact root');

  const allowed = new Set<string>([SDK_HOSTS[platform], ...INERT_HOSTS]);
  const foreign = FOREIGN_SDK_HOST[platform];
  const seen = new Set<string>();

  for (const file of files) {
    if (!TEXT_EXT.has(extname(file.rel).toLowerCase())) continue;
    const text = readFileSync(file.abs, 'utf8');

    if (text.includes(foreign)) errors.push(`foreign portal SDK reference "${foreign}" found in ${file.rel}`);
    if (file.rel === 'index.html' && ROOT_ABSOLUTE_RE.test(text)) {
      errors.push('index.html uses a root-absolute or protocol-relative src/href (use relative paths)');
    }

    for (const url of text.match(URL_RE) ?? []) {
      const host = HOST_RE.exec(url)?.[1]?.toLowerCase();
      if (!host || !VALID_HOST_RE.test(host)) continue;
      if (allowed.has(host) || host === foreign) continue;
      const key = `${host}|${file.rel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push(`external URL host "${host}" is not allowed for ${platform} (in ${file.rel})`);
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, platform] = process.argv.slice(2);
  if (!dir || (platform !== 'crazygames' && platform !== 'gamedistribution')) {
    console.error('usage: node scripts/check-artifact.ts <dir> <crazygames|gamedistribution>');
    process.exit(2);
  }
  const errors = checkArtifact(dir, platform);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[check-artifact] ${e}`);
    process.exit(1);
  }
  console.log(`[check-artifact] ${dir} OK for ${platform}`);
}
```

- [ ] **Step 4: Run tests, typecheck, and check the real builds from Tasks 2–3**

Run: `npx vitest run scripts/check-artifact.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

Then run the CLI against the real portal builds produced in Tasks 2 and 3 (`dist/` is gitignored; rebuild if missing with the commands from those tasks):
```bash
node scripts/check-artifact.ts dist/crazygames/dodge-drop crazygames
GD_GAME_ID=demo-id-123 node scripts/build-games.ts gamedistribution
node scripts/check-artifact.ts dist/gamedistribution/dodge-drop gamedistribution
```
Expected: `[check-artifact] dist/crazygames/dodge-drop OK for crazygames` and `... OK for gamedistribution`. If a real build reports a host not in `INERT_HOSTS`, STOP: inspect it with `grep -o ".\{60\}<host>.\{60\}" dist/<platform>/dodge-drop/assets/*.js`; add it to `INERT_HOSTS` (with a comment) only if it is inert text, otherwise report BLOCKED.

- [ ] **Step 5: Commit and push**

```bash
git add scripts/check-artifact.ts scripts/check-artifact.test.ts
git commit -m "$(cat <<'EOF'
feat(scripts): add checkArtifact build-output gate for portal zips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

---

### Task 5: `build-portals`, zips, and portal smoke with fake SDKs

**Files:**
- Create: `scripts/build-portals.ts`, `scripts/build-portals.test.ts`, `e2e/portals.spec.ts`, `e2e/fixtures/fake-crazygames-sdk.js`, `e2e/fixtures/fake-gd-sdk.js`
- Modify: `scripts/build-games.ts`, `playwright.config.ts`, `package.json`

**Interfaces:**
- Produces: `buildGames(platform, outRoot, layout, opts?: BuildOptions)` where `BuildOptions = { only?: (g: GameManifest) => boolean; env?: (g: GameManifest) => Record<string, string> }` (backward compatible; env vars are set for that game's build and restored afterwards). From `scripts/build-portals.ts`: `PORTALS`, `SMOKE_GD_ID = 'smoke-test-game-id'`, `zipName(slug, platform, version)`, `selectGames(platform, games, { fakeGdId? })`, `gameEnv(platform, game, fakeGdId)`, `zipDirectory(dir, zipPath)`, `buildPortals(opts)`. CLI `node scripts/build-portals.ts [--smoke]`: normal mode writes `dist/portals/<platform>/<slug>` and `dist/release/<slug>-<platform>-v<version>.zip`; `--smoke` writes `dist/portals-smoke/...`, fakes a GD id for games without one, no zips. npm scripts `build:portals`, `test:portals`.
- Consumes: `checkArtifact`/`PortalPlatform` (Task 4), `loadGames`, adapters (Tasks 2–3), `GameManifest.portalIds` (Task 1).

- [ ] **Step 1: Write the failing unit tests**

`scripts/build-portals.test.ts`:
```ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { gameEnv, selectGames, SMOKE_GD_ID, zipDirectory, zipName } from './build-portals.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function game(over: Partial<GameManifest> & { slug: string }): GameManifest {
  return {
    version: '1.2.3',
    title: { en: over.slug },
    description: { en: 'd' },
    instructions: { en: 'i' },
    tags: [],
    orientation: 'any',
    controls: ['mouse'],
    cover: 'cover.svg',
    targets: ['site', 'crazygames', 'gamedistribution'],
    releases: {},
    ...over,
  };
}

describe('zipName', () => {
  it('is <slug>-<platform>-v<version>.zip', () => {
    expect(zipName('dodge-drop', 'crazygames', '1.0.0')).toBe('dodge-drop-crazygames-v1.0.0.zip');
  });
});

describe('selectGames', () => {
  const withId = game({ slug: 'a', portalIds: { gamedistribution: 'gd-a' } });
  const noId = game({ slug: 'b' });
  const siteOnly = game({ slug: 'c', targets: ['site'] });

  it('builds crazygames for every game that targets it', () => {
    const r = selectGames('crazygames', [withId, noId, siteOnly]);
    expect(r.build.map((g) => g.slug)).toEqual(['a', 'b']);
    expect(r.skipped).toEqual([]);
  });

  it('skips gamedistribution games without a gameId, with a clear reason', () => {
    const r = selectGames('gamedistribution', [withId, noId, siteOnly]);
    expect(r.build.map((g) => g.slug)).toEqual(['a']);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]!.slug).toBe('b');
    expect(r.skipped[0]!.reason).toMatch(/portalIds\.gamedistribution/);
  });

  it('fakeGdId (smoke) builds games without a gameId', () => {
    const r = selectGames('gamedistribution', [noId], { fakeGdId: true });
    expect(r.build.map((g) => g.slug)).toEqual(['b']);
    expect(r.skipped).toEqual([]);
  });
});

describe('gameEnv', () => {
  it('passes the per-game GD id only for gamedistribution', () => {
    const g = game({ slug: 'a', portalIds: { gamedistribution: 'gd-a' } });
    expect(gameEnv('gamedistribution', g, false)).toEqual({ GD_GAME_ID: 'gd-a' });
    expect(gameEnv('crazygames', g, false)).toEqual({});
  });

  it('uses the smoke id when faking and the game has none', () => {
    expect(gameEnv('gamedistribution', game({ slug: 'b' }), true)).toEqual({ GD_GAME_ID: SMOKE_GD_ID });
    expect(gameEnv('gamedistribution', game({ slug: 'b' }), false)).toEqual({ GD_GAME_ID: '' });
  });
});

describe('zipDirectory', () => {
  it('puts index.html at the zip root with no directory entries and replaces an existing zip', () => {
    const root = mkdtempSync(join(tmpdir(), 'gk-zip-'));
    dirs.push(root);
    const src = join(root, 'src');
    mkdirSync(join(src, 'assets'), { recursive: true });
    writeFileSync(join(src, 'index.html'), '<html></html>');
    writeFileSync(join(src, 'assets', 'a.js'), 'x');
    const zip = join(root, 'out', 'g.zip');
    zipDirectory(src, zip);
    writeFileSync(join(src, 'assets', 'b.js'), 'y');
    zipDirectory(src, zip);
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
    expect(names).toEqual(['assets/a.js', 'assets/b.js', 'index.html']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/build-portals.test.ts`
Expected: FAIL — cannot resolve `./build-portals.ts`.

- [ ] **Step 3: Extend `buildGames` (backward compatible)**

Replace the whole content of `scripts/build-games.ts` with:
```ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { GAMES_DIR, loadGames } from './lib/games.ts';

export interface BuildOptions {
  /** Extra filter applied after the target filter. */
  only?: (game: GameManifest) => boolean;
  /** Extra env vars set for that game's build only (restored afterwards). */
  env?: (game: GameManifest) => Record<string, string>;
}

export async function buildGames(
  platform: string,
  outRoot: string,
  layout: (slug: string) => string,
  opts: BuildOptions = {},
): Promise<GameManifest[]> {
  const games = loadGames()
    .filter((g) => platform === 'local' || (g.targets as string[]).includes(platform))
    .filter((g) => opts.only?.(g) ?? true);
  for (const game of games) {
    process.env.PLATFORM = platform;
    process.env.GAME_OUT_DIR = resolve(outRoot, layout(game.slug));
    const extra = opts.env?.(game) ?? {};
    const previous = Object.fromEntries(Object.keys(extra).map((k) => [k, process.env[k]]));
    Object.assign(process.env, extra);
    console.log(`[build] ${game.slug} (${platform}) → ${process.env.GAME_OUT_DIR}`);
    try {
      await build({ configFile: resolve(GAMES_DIR, game.slug, 'vite.config.ts'), logLevel: 'warn' });
    } finally {
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }
  return games;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const platform = process.argv[2] ?? 'local';
  const games = await buildGames(platform, resolve('dist', platform), (slug) => slug);
  console.log(`[build] ${games.length} game(s) built for ${platform}`);
}
```

- [ ] **Step 4: Implement `build-portals.ts`**

`scripts/build-portals.ts`:
```ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { buildGames } from './build-games.ts';
import { checkArtifact, type PortalPlatform } from './check-artifact.ts';
import { loadGames } from './lib/games.ts';

export const PORTALS: readonly PortalPlatform[] = ['crazygames', 'gamedistribution'];
/** Placeholder GD id used ONLY by the smoke build (--smoke); never shipped. */
export const SMOKE_GD_ID = 'smoke-test-game-id';

export const zipName = (slug: string, platform: PortalPlatform, version: string): string =>
  `${slug}-${platform}-v${version}.zip`;

export interface Selection {
  build: GameManifest[];
  skipped: Array<{ slug: string; reason: string }>;
}

export function selectGames(
  platform: PortalPlatform,
  games: GameManifest[],
  opts: { fakeGdId?: boolean } = {},
): Selection {
  const build: GameManifest[] = [];
  const skipped: Selection['skipped'] = [];
  for (const g of games) {
    if (!(g.targets as string[]).includes(platform)) continue;
    if (platform === 'gamedistribution' && !g.portalIds?.gamedistribution && !opts.fakeGdId) {
      skipped.push({
        slug: g.slug,
        reason: 'no portalIds.gamedistribution in game.json (register the game in the GameDistribution dashboard first)',
      });
      continue;
    }
    build.push(g);
  }
  return { build, skipped };
}

export function gameEnv(platform: PortalPlatform, game: GameManifest, fakeGdId: boolean): Record<string, string> {
  if (platform !== 'gamedistribution') return {};
  return { GD_GAME_ID: game.portalIds?.gamedistribution ?? (fakeGdId ? SMOKE_GD_ID : '') };
}

/** Zips the CONTENTS of `dir` (index.html at the zip root) using the system zip CLI. Replaces an existing zip. */
export function zipDirectory(dir: string, zipPath: string): void {
  const target = resolve(zipPath);
  rmSync(target, { force: true });
  mkdirSync(dirname(target), { recursive: true });
  execFileSync('zip', ['-q', '-r', '-X', '-D', target, '.'], { cwd: dir });
}

export interface BuildPortalsOptions {
  outRoot: string;
  /** null = do not zip (smoke). */
  releaseDir: string | null;
  fakeGdId?: boolean;
  platforms?: readonly PortalPlatform[];
  games?: GameManifest[];
}

export interface BuildPortalsResult {
  built: Array<{ slug: string; platform: PortalPlatform; dir: string; zip: string | null }>;
  skipped: Array<{ slug: string; platform: PortalPlatform; reason: string }>;
  errors: string[];
}

export async function buildPortals(opts: BuildPortalsOptions): Promise<BuildPortalsResult> {
  const all = opts.games ?? loadGames();
  const fakeGdId = opts.fakeGdId ?? false;
  const result: BuildPortalsResult = { built: [], skipped: [], errors: [] };
  for (const platform of opts.platforms ?? PORTALS) {
    const { build, skipped } = selectGames(platform, all, { fakeGdId });
    for (const s of skipped) result.skipped.push({ ...s, platform });
    if (build.length === 0) continue;
    const slugs = new Set(build.map((g) => g.slug));
    const platformRoot = join(opts.outRoot, platform);
    await buildGames(platform, platformRoot, (slug) => slug, {
      only: (g) => slugs.has(g.slug),
      env: (g) => gameEnv(platform, g, fakeGdId),
    });
    for (const game of build) {
      const dir = join(platformRoot, game.slug);
      const problems = checkArtifact(dir, platform);
      if (problems.length > 0) {
        result.errors.push(...problems.map((p) => `${game.slug} (${platform}): ${p}`));
        continue;
      }
      let zip: string | null = null;
      if (opts.releaseDir) {
        zip = join(opts.releaseDir, zipName(game.slug, platform, game.version));
        zipDirectory(dir, zip);
      }
      result.built.push({ slug: game.slug, platform, dir, zip });
    }
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const smoke = process.argv.includes('--smoke');
  const outRoot = resolve(smoke ? 'dist/portals-smoke' : 'dist/portals');
  const releaseDir = smoke ? null : resolve('dist/release');
  rmSync(outRoot, { recursive: true, force: true });
  if (releaseDir) rmSync(releaseDir, { recursive: true, force: true });
  const result = await buildPortals({ outRoot, releaseDir, fakeGdId: smoke });
  for (const s of result.skipped) console.warn(`[portals] SKIP ${s.slug} (${s.platform}): ${s.reason}`);
  for (const b of result.built) console.log(`[portals] ${b.slug} (${b.platform}) ${b.zip ? `→ ${b.zip}` : '(smoke build, no zip)'}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`[portals] ERROR ${e}`);
    process.exit(1);
  }
}
```

- [ ] **Step 5: Run unit tests and typecheck**

Run: `npx vitest run scripts/build-portals.test.ts && npm run typecheck && npm test`
Expected: PASS (new tests plus the whole suite; `buildGames` callers in `build-site.ts` are unaffected).

- [ ] **Step 6: Add npm scripts**

Edit `package.json` — old_string `    "test:smoke": "npm run build:local && playwright test"` new_string:
```json
    "test:smoke": "npm run build:local && playwright test",
    "build:portals": "node scripts/build-portals.ts",
    "test:portals": "node scripts/build-portals.ts --smoke && playwright test e2e/portals.spec.ts"
```

- [ ] **Step 7: Run the real build and verify zips**

Run:
```bash
npm run build:portals
ls -l dist/release
unzip -Z1 dist/release/dodge-drop-crazygames-v0.1.0.zip | head -5
```
Expected: console shows `[portals] SKIP dodge-drop (gamedistribution): no portalIds.gamedistribution in game.json ...` and `[portals] dodge-drop (crazygames) → .../dist/release/dodge-drop-crazygames-v0.1.0.zip`; exit code 0; `dist/release` holds only the crazygames zip; `unzip -Z1` lists `index.html` as a root entry (no leading directory). No `[portals] ERROR` lines (the check-artifact gate passed on the real build).

- [ ] **Step 8: Write the fake SDK fixtures**

`e2e/fixtures/fake-crazygames-sdk.js`:
```js
// Fake CrazyGames SDK v3 for portal smoke tests. Served in place of https://sdk.crazygames.com/crazygames-sdk-v3.js.
(() => {
  const calls = (window.__fakeSdkCalls = window.__fakeSdkCalls || []);
  const rec = (name) => calls.push(name);
  const store = new Map();
  window.CrazyGames = {
    SDK: {
      environment: 'crazygames',
      async init() {
        rec('init');
      },
      game: {
        loadingStart() { rec('game.loadingStart'); },
        loadingStop() { rec('game.loadingStop'); },
        gameplayStart() { rec('game.gameplayStart'); },
        gameplayStop() { rec('game.gameplayStop'); },
      },
      ad: {
        requestAd(type, cb) {
          rec('ad.requestAd:' + type);
          setTimeout(() => {
            cb.adStarted();
            setTimeout(() => cb.adFinished(), 50);
          }, 0);
        },
      },
      data: {
        getItem(key) { return store.has(key) ? store.get(key) : null; },
        setItem(key, value) { store.set(key, String(value)); rec('data.setItem'); },
      },
    },
  };
})();
```

`e2e/fixtures/fake-gd-sdk.js`:
```js
// Fake GameDistribution SDK for portal smoke tests. Served in place of https://html5.api.gamedistribution.com/main.min.js.
(() => {
  const calls = (window.__fakeSdkCalls = window.__fakeSdkCalls || []);
  const opts = window.GD_OPTIONS;
  calls.push(opts ? 'GD_OPTIONS.gameId=' + opts.gameId : 'GD_OPTIONS.missing');
  const emit = (name) => {
    try {
      window.GD_OPTIONS.onEvent({ name });
    } catch (e) {
      calls.push('onEvent.error');
    }
  };
  window.gdsdk = {
    async preloadAd(type) {
      calls.push('preloadAd:' + type);
    },
    async showAd(type) {
      calls.push('showAd:' + (type || 'interstitial'));
      emit('SDK_GAME_PAUSE');
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (type === 'rewarded') emit('SDK_REWARDED_WATCH_COMPLETE');
      emit('SDK_GAME_START');
    },
  };
  setTimeout(() => {
    calls.push('SDK_READY');
    emit('SDK_READY');
  }, 20);
})();
```

- [ ] **Step 9: Write the portal smoke spec and config**

`e2e/portals.spec.ts`:
```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __fakeSdkCalls?: string[];
  }
}

const ROOT = 'dist/portals-smoke';
const PORTALS = [
  {
    platform: 'crazygames',
    port: 5181,
    host: 'sdk.crazygames.com',
    sdkUrl: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
    fixture: 'e2e/fixtures/fake-crazygames-sdk.js',
  },
  {
    platform: 'gamedistribution',
    port: 5182,
    host: 'html5.api.gamedistribution.com',
    sdkUrl: 'https://html5.api.gamedistribution.com/main.min.js',
    fixture: 'e2e/fixtures/fake-gd-sdk.js',
  },
] as const;

function slugsFor(platform: string): string[] {
  return readdirSync('games')
    .filter((d) => existsSync(join('games', d, 'game.json')))
    .filter((d) => (JSON.parse(readFileSync(join('games', d, 'game.json'), 'utf8')).targets as string[]).includes(platform))
    .sort();
}

for (const portal of PORTALS) {
  for (const slug of slugsFor(portal.platform)) {
    test(`${slug} (${portal.platform}): boots against the fake SDK without errors`, async ({ page }) => {
      test.skip(
        !existsSync(join(ROOT, portal.platform, slug, 'index.html')),
        'portal smoke build missing; run `npm run test:portals`',
      );
      const errors: string[] = [];
      const hosts = new Set<string>();
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });
      page.on('request', (r) => {
        const host = new URL(r.url()).hostname;
        if (host !== '' && host !== 'localhost') hosts.add(host);
      });
      const sdkBody = readFileSync(portal.fixture, 'utf8');
      await page.route(portal.sdkUrl, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: sdkBody }));

      await page.goto(`http://localhost:${portal.port}/${slug}/`);
      const calls = () => page.evaluate(() => window.__fakeSdkCalls ?? []);

      if (portal.platform === 'crazygames') {
        // Preload done => GKTitle is about to show (hooks are off in portal builds, so observe via the SDK).
        await expect.poll(calls, { timeout: 15_000 }).toContain('game.loadingStop');
        expect((await calls())[0]).toBe('init');
      } else {
        await expect.poll(calls, { timeout: 15_000 }).toContain('SDK_READY');
        expect(await calls()).toContain('GD_OPTIONS.gameId=smoke-test-game-id');
      }

      await page.waitForTimeout(500);
      const box = await page.locator('canvas').boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

      if (portal.platform === 'crazygames') {
        await expect.poll(calls, { timeout: 10_000 }).toContain('game.gameplayStart');
      } else {
        await page.waitForTimeout(500);
      }

      expect([...hosts]).toEqual([portal.host]);
      expect(errors).toEqual([]);
    });
  }
}
```

Replace `playwright.config.ts` with:
```ts
import { defineConfig } from '@playwright/test';

const serve = (dir: string, port: number) => ({
  command: `node scripts/serve-static.ts ${dir} ${port}`,
  port,
  reuseExistingServer: !process.env.CI,
});

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  webServer: [
    serve('dist/local', 5180),
    serve('dist/portals-smoke/crazygames', 5181),
    serve('dist/portals-smoke/gamedistribution', 5182),
  ],
  use: { baseURL: 'http://localhost:5180' },
});
```

- [ ] **Step 10: Run the portal smoke**

Run: `npm run test:portals`
Expected: `build-portals --smoke` prints `[portals] dodge-drop (crazygames) (smoke build, no zip)` and `[portals] dodge-drop (gamedistribution) (smoke build, no zip)`, then Playwright reports `2 passed`. Also run the P1 smoke to confirm the config change broke nothing: `npm run test:smoke` → `1 passed` for `dodge-drop` and the two portal tests either pass (dirs exist from the previous command) or are skipped; no failures.

If the CG test cannot observe `game.loadingStop` (e.g. `__fakeSdkCalls` stays empty), debug with `npx playwright test e2e/portals.spec.ts --headed`; do not weaken the assertions.

- [ ] **Step 11: Full gate, commit, push**

Run: `npm run typecheck && npm test` — expected green.
```bash
git add scripts/build-games.ts scripts/build-portals.ts scripts/build-portals.test.ts e2e/portals.spec.ts e2e/fixtures/fake-crazygames-sdk.js e2e/fixtures/fake-gd-sdk.js playwright.config.ts package.json
git commit -m "$(cat <<'EOF'
feat(scripts): build portal artifacts, zip them, and smoke-test them against fake SDKs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

---

### Task 6: CI `release-portals` job

**Files:**
- Create: `scripts/release-portals.ts`, `scripts/release-portals.test.ts`, `scripts/workflow.test.ts`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: `parseZipName(file): { slug, platform, version } | null`, `groupReleases(zipPaths): ReleaseGroup[]` where `ReleaseGroup = { tag: string /* <slug>-v<version> */; slug; version; zips: string[] }`, `releaseNotes(group): string`. CLI `node scripts/release-portals.ts [dir=dist/release]`: for each group, if the GitHub release `<tag>` does not exist, `gh release create <tag> <zips...> --title "<slug> v<version>" --notes ... [--target $GITHUB_SHA]`; if it exists, upload only the zips not yet attached (`gh release upload <tag> <missing zips>`, never `--clobber` — already-attached zips may have been submitted and must stay immutable). `missingZips(group, attachedNames): string[]` is the pure helper. `DRY_RUN=1` prints what would happen without calling `gh`.
- Consumes: zip naming from Task 5 (`<slug>-<platform>-v<version>.zip`).

- [ ] **Step 1: Write the failing tests**

`scripts/release-portals.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { groupReleases, missingZips, parseZipName, releaseNotes } from './release-portals.ts';

describe('parseZipName', () => {
  it('parses slug, platform and version from a path', () => {
    expect(parseZipName('dist/release/dodge-drop-crazygames-v1.2.3.zip')).toEqual({
      slug: 'dodge-drop',
      platform: 'crazygames',
      version: '1.2.3',
    });
    expect(parseZipName('a-b-c-gamedistribution-v0.1.0.zip')?.slug).toBe('a-b-c');
  });

  it.each(['foo.zip', 'x-poki-v1.0.0.zip', 'x-crazygames-v1.0.zip', 'x-crazygames-v1.0.0.tar'])('rejects %s', (f) =>
    expect(parseZipName(f)).toBeNull(),
  );
});

describe('groupReleases', () => {
  it('groups both portals of one slug/version under one tag, sorted', () => {
    const groups = groupReleases([
      'dist/release/zeta-gamedistribution-v1.0.0.zip',
      'dist/release/alpha-gamedistribution-v2.0.0.zip',
      'dist/release/alpha-crazygames-v2.0.0.zip',
      'dist/release/alpha-crazygames-v1.0.0.zip',
      'dist/release/ignore-me.zip',
    ]);
    expect(groups.map((g) => g.tag)).toEqual(['alpha-v1.0.0', 'alpha-v2.0.0', 'zeta-v1.0.0']);
    expect(groups[1]!.zips).toEqual([
      'dist/release/alpha-crazygames-v2.0.0.zip',
      'dist/release/alpha-gamedistribution-v2.0.0.zip',
    ]);
    expect(groups[1]).toMatchObject({ slug: 'alpha', version: '2.0.0' });
  });

  it('returns an empty list when there are no zips', () => expect(groupReleases([])).toEqual([]));
});

describe('missingZips', () => {
  it('returns only zips whose file name is not attached yet', () => {
    const [g] = groupReleases([
      'dist/release/alpha-crazygames-v1.0.0.zip',
      'dist/release/alpha-gamedistribution-v1.0.0.zip',
    ]);
    expect(missingZips(g!, ['alpha-crazygames-v1.0.0.zip'])).toEqual(['dist/release/alpha-gamedistribution-v1.0.0.zip']);
    expect(missingZips(g!, ['alpha-crazygames-v1.0.0.zip', 'alpha-gamedistribution-v1.0.0.zip'])).toEqual([]);
  });
});

describe('releaseNotes', () => {
  it('lists the portal zips for manual upload', () => {
    const [g] = groupReleases(['dist/release/alpha-crazygames-v1.0.0.zip']);
    const notes = releaseNotes(g!);
    expect(notes).toMatch(/alpha v1\.0\.0/);
    expect(notes).toMatch(/alpha-crazygames-v1\.0\.0\.zip/);
  });
});
```

`scripts/workflow.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const yml = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8');
const jobBlock = (name: string): string => {
  const start = yml.indexOf(`\n  ${name}:\n`);
  if (start < 0) return '';
  const next = yml.slice(start + 1).search(/\n {2}[a-z0-9-]+:\n/);
  return next < 0 ? yml.slice(start) : yml.slice(start, start + 1 + next);
};

describe('deploy.yml release-portals job', () => {
  const job = jobBlock('release-portals');

  it('exists and depends on a successful build-platform', () => {
    expect(job).not.toBe('');
    expect(job).toMatch(/needs: \[changes, build-platform\]/);
    expect(job).toMatch(/needs\.build-platform\.result == 'success'/);
  });

  it('has contents: write and uses GITHUB_TOKEN for gh', () => {
    expect(job).toMatch(/permissions:\s+contents: write/);
    expect(job).toMatch(/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  });

  it('runs portal smoke, builds portals and creates releases', () => {
    expect(job).toMatch(/npm run test:portals/);
    expect(job).toMatch(/npm run build:portals/);
    expect(job).toMatch(/node scripts\/release-portals\.ts/);
  });

  it('does not block the pages deploy job', () => {
    const deploy = jobBlock('deploy');
    expect(deploy).not.toMatch(/release-portals/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/release-portals.test.ts scripts/workflow.test.ts`
Expected: FAIL — `./release-portals.ts` unresolved; workflow tests fail (`job` empty).

- [ ] **Step 3: Implement**

`scripts/release-portals.ts`:
```ts
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ParsedZip {
  slug: string;
  platform: 'crazygames' | 'gamedistribution';
  version: string;
}

export interface ReleaseGroup {
  /** GitHub release tag: <slug>-v<version>. */
  tag: string;
  slug: string;
  version: string;
  zips: string[];
}

const ZIP_RE = /^(.+)-(crazygames|gamedistribution)-v(\d+\.\d+\.\d+)\.zip$/;

export function parseZipName(file: string): ParsedZip | null {
  const m = ZIP_RE.exec(basename(file));
  if (!m) return null;
  return { slug: m[1]!, platform: m[2] as ParsedZip['platform'], version: m[3]! };
}

export function groupReleases(zipPaths: string[]): ReleaseGroup[] {
  const groups = new Map<string, ReleaseGroup>();
  for (const path of [...zipPaths].sort()) {
    const parsed = parseZipName(path);
    if (!parsed) continue;
    const tag = `${parsed.slug}-v${parsed.version}`;
    const group = groups.get(tag) ?? { tag, slug: parsed.slug, version: parsed.version, zips: [] };
    group.zips.push(path);
    groups.set(tag, group);
  }
  return [...groups.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

export function releaseNotes(group: ReleaseGroup): string {
  const lines = [
    `Portal upload packages for ${group.slug} v${group.version} (built by CI from this commit).`,
    '',
    'Upload manually in each portal developer dashboard:',
    ...group.zips.map((z) => `- ${basename(z)}`),
  ];
  return lines.join('\n');
}

export function missingZips(group: ReleaseGroup, attachedNames: string[]): string[] {
  const attached = new Set(attachedNames);
  return group.zips.filter((z) => !attached.has(basename(z)));
}

/** Asset names attached to an existing release, or null when the release does not exist. */
function attachedAssets(tag: string): string[] | null {
  try {
    const out = execFileSync('gh', ['release', 'view', tag, '--json', 'assets', '--jq', '.assets[].name'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist/release';
  const dry = process.env.DRY_RUN === '1';
  const zips = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.zip')).map((f) => join(dir, f)) : [];
  const groups = groupReleases(zips);
  if (groups.length === 0) console.log(`[release] no portal zips in ${dir}; nothing to do`);
  for (const group of groups) {
    if (dry) {
      console.log(`[release] would create release ${group.tag} with ${group.zips.length} zip(s) (or upload missing ones if it exists)`);
      continue;
    }
    const attached = attachedAssets(group.tag);
    if (attached !== null) {
      const missing = missingZips(group, attached);
      if (missing.length === 0) {
        console.log(`[release] ${group.tag} already has all zips; nothing to do`);
      } else {
        execFileSync('gh', ['release', 'upload', group.tag, ...missing], { stdio: 'inherit' });
        console.log(`[release] ${group.tag}: uploaded ${missing.length} missing zip(s)`);
      }
      continue;
    }
    const args = ['release', 'create', group.tag, ...group.zips, '--title', `${group.slug} v${group.version}`, '--notes', releaseNotes(group)];
    if (process.env.GITHUB_SHA) args.push('--target', process.env.GITHUB_SHA);
    execFileSync('gh', args, { stdio: 'inherit' });
    console.log(`[release] created ${group.tag}`);
  }
}
```

Edit `.github/workflows/deploy.yml` — old_string:
```
  deploy:
    needs: [changes, build-merge10, build-merge10x, build-pixel-squad, build-platform]
```
new_string:
```
  release-portals:
    needs: [changes, build-platform]
    if: needs.build-platform.result == 'success'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:portals
      - run: npm run build:portals
      - name: Create GitHub Releases for new game versions
        run: node scripts/release-portals.ts

  deploy:
    needs: [changes, build-merge10, build-merge10x, build-pixel-squad, build-platform]
```

- [ ] **Step 4: Run tests and a local dry run**

Run: `npx vitest run scripts/release-portals.test.ts scripts/workflow.test.ts && npm run typecheck && npm test`
Expected: PASS.

Then (zips exist from Task 5; rebuild with `npm run build:portals` if `dist/release` is missing):
```bash
DRY_RUN=1 node scripts/release-portals.ts
```
Expected output: `[release] would create release dodge-drop-v0.1.0 with 1 zip(s) (or upload missing ones if it exists)`.

Do NOT run the script without `DRY_RUN=1` locally.

- [ ] **Step 5: Commit and push**

```bash
git add scripts/release-portals.ts scripts/release-portals.test.ts scripts/workflow.test.ts .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
ci: add release-portals job that publishes portal zips as GitHub Releases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

After pushing, the workflow runs on GitHub (the `.github/workflows/deploy.yml` change triggers `build-platform`). Check it: `gh run list --workflow deploy.yml --limit 1` then `gh run watch <id> --exit-status`. Expected: `release-portals` succeeds and `gh release view dodge-drop-v0.1.0` lists `dodge-drop-crazygames-v0.1.0.zip` (the GD zip is absent until a gameId exists — Task 8). If the run fails, read `gh run view <id> --log-failed`, fix in a follow-up commit, push again.

---

### Task 7: `release-status` and per-platform checklists

**Files:**
- Create: `scripts/release-status.ts`, `scripts/release-status.test.ts`, `scripts/checklists.test.ts`, `docs/specs/game-platform/checklists/crazygames.md`, `docs/specs/game-platform/checklists/gamedistribution.md`
- Modify: `package.json`

**Interfaces:**
- Produces: `compareSemver(a: string, b: string): number`; `renderStatusTable(games: GameManifest[]): string` — one row per game × target (columns GAME, VERSION (game), TARGET, STATUS, RELEASED, SUBMITTED, NOTE); NOTE is `needs resubmission (game is vX)` when `release.version < game.version`, `rejected: <reason>` for rejected; a footer line `N row(s) need resubmission` when N > 0. npm script `release-status`.
- Consumes: `loadGames`, `GameManifest`.

- [ ] **Step 1: Write the failing tests**

`scripts/release-status.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { compareSemver, renderStatusTable } from './release-status.ts';

const game = (over: Partial<GameManifest> & { slug: string; version: string }): GameManifest => ({
  title: { en: over.slug },
  description: { en: 'd' },
  instructions: { en: 'i' },
  tags: [],
  orientation: 'any',
  controls: ['mouse'],
  cover: 'cover.svg',
  targets: ['site', 'crazygames'],
  releases: {},
  ...over,
});

describe('compareSemver', () => {
  it('orders numerically, not lexically', () => {
    expect(compareSemver('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('renderStatusTable', () => {
  it('prints a header and one row per game x target', () => {
    const out = renderStatusTable([
      game({
        slug: 'dodge-drop',
        version: '1.0.0',
        releases: { crazygames: { status: 'submitted', version: '1.0.0', submittedAt: '2026-12-01' } },
      }),
    ]);
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/GAME\s+VERSION\s+TARGET\s+STATUS\s+RELEASED\s+SUBMITTED\s+NOTE/);
    expect(out).toMatch(/dodge-drop\s+1\.0\.0\s+crazygames\s+submitted\s+1\.0\.0\s+2026-12-01/);
    expect(out).toMatch(/dodge-drop\s+1\.0\.0\s+site\s+-\s+-\s+-/);
    expect(out).not.toMatch(/need resubmission/);
  });

  it('flags rows whose released version is older than the game version', () => {
    const out = renderStatusTable([
      game({
        slug: 'a',
        version: '1.1.0',
        releases: { crazygames: { status: 'basic', version: '1.0.0', submittedAt: '2026-12-01' } },
      }),
    ]);
    expect(out).toMatch(/a\s+1\.1\.0\s+crazygames\s+basic\s+1\.0\.0\s+2026-12-01\s+needs resubmission \(game is v1\.1\.0\)/);
    expect(out).toMatch(/1 row\(s\) need resubmission/);
  });

  it('shows the reason for rejected releases', () => {
    const out = renderStatusTable([
      game({ slug: 'a', version: '1.0.0', releases: { crazygames: { status: 'rejected', version: '1.0.0', reason: 'too short' } } }),
    ]);
    expect(out).toMatch(/rejected: too short/);
  });

  it('sorts games by slug and handles no games', () => {
    const out = renderStatusTable([game({ slug: 'b', version: '1.0.0' }), game({ slug: 'a', version: '1.0.0' })]);
    expect(out.indexOf('a ')).toBeLessThan(out.indexOf('\nb '));
    expect(renderStatusTable([])).toBe('(no games)');
  });
});
```

`scripts/checklists.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('../docs/specs/game-platform/checklists/', import.meta.url));

describe.each(['crazygames', 'gamedistribution'])('checklist %s', (platform) => {
  const file = `${dir}${platform}.md`;

  it('exists with Automated and Manual sections', () => {
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(text).toMatch(/^## Automated/m);
    expect(text).toMatch(/^## Manual/m);
  });

  it('points at the automated gate and marks unverified facts explicitly', () => {
    const text = readFileSync(file, 'utf8');
    expect(text).toMatch(/check-artifact/);
    expect(text).toMatch(/UNVERIFIED/);
  });

  it('has at least one unchecked manual item', () => {
    expect(readFileSync(file, 'utf8')).toMatch(/^- \[ \] /m);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/release-status.test.ts scripts/checklists.test.ts`
Expected: FAIL — `./release-status.ts` unresolved; checklist files missing.

- [ ] **Step 3: Implement `release-status.ts`**

`scripts/release-status.ts`:
```ts
import { fileURLToPath } from 'node:url';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { loadGames } from './lib/games.ts';

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const HEADER = ['GAME', 'VERSION', 'TARGET', 'STATUS', 'RELEASED', 'SUBMITTED', 'NOTE'];

export function renderStatusTable(games: GameManifest[]): string {
  if (games.length === 0) return '(no games)';
  const rows: string[][] = [HEADER];
  let stale = 0;
  for (const g of [...games].sort((a, b) => a.slug.localeCompare(b.slug))) {
    for (const target of g.targets) {
      const rel = g.releases[target];
      let note = '';
      if (rel && compareSemver(rel.version, g.version) < 0) {
        note = `needs resubmission (game is v${g.version})`;
        stale++;
      } else if (rel?.status === 'rejected') {
        note = `rejected: ${rel.reason ?? ''}`;
      }
      rows.push([g.slug, g.version, target, rel?.status ?? '-', rel?.version ?? '-', rel?.submittedAt ?? '-', note]);
    }
  }
  const widths = HEADER.map((_, col) => Math.max(...rows.map((r) => r[col]!.length)));
  const lines = rows.map((r) => r.map((cell, col) => cell.padEnd(widths[col]!)).join('  ').trimEnd());
  if (stale > 0) lines.push('', `${stale} row(s) need resubmission`);
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(renderStatusTable(loadGames()));
}
```

Edit `package.json` — old_string `    "build:portals": "node scripts/build-portals.ts",` new_string:
```json
    "build:portals": "node scripts/build-portals.ts",
    "release-status": "node scripts/release-status.ts",
```

- [ ] **Step 4: Write the checklists**

`docs/specs/game-platform/checklists/crazygames.md`:
```markdown
# CrazyGames submission checklist

Source of facts: `.superpowers/sdd/p2-research.md` (fetched 2026-11-21 from docs.crazygames.com). Items marked **UNVERIFIED** were not confirmed from an official page; verify them in the CrazyGames developer dashboard before relying on them.

Per game: copy this list into your notes, work top to bottom, then update `games/<slug>/game.json` `releases.crazygames` and run `npm run release-status`.

## Automated (nothing to do by hand)

Produced by `npm run build:portals` (CI job `release-portals` runs the same command and attaches the zip to the GitHub Release `<slug>-v<version>`):

- Build contains only the CrazyGames adapter; no GameDistribution SDK (`scripts/check-artifact.ts` fails the build otherwise).
- Only external host the game may load at runtime is `sdk.crazygames.com`; no other absolute URLs (`check-artifact`).
- All asset paths are relative (`check-artifact` rejects root-absolute and protocol-relative `src`/`href` in `index.html`).
- Total size is within 10 MB (our own cap; CrazyGames Basic Launch allows up to 50 MB initial / 250 MB total / 1500 files).
- Adapter degrades gracefully: with ads disabled (Basic Launch) or SDK blocked, the game still boots and plays (covered by adapter unit tests and the portal smoke test with fake SDK).
- `gameplayStart` / `gameplayStop` / `loadingStart` / `loadingStop` are wired through the platform adapter.

## Manual: before uploading

- [ ] Zip is `dist/release/<slug>-crazygames-v<version>.zip` (download from the GitHub Release or run `npm run build:portals`). **UNVERIFIED:** whether CrazyGames wants `index.html` at the zip root (we ship it at the root) — confirm on the upload form.
- [ ] Covers rendered and reviewed: `games/<slug>/store/landscape-1920x1080.png`, `portrait-800x1200.png`, `square-800x800.png` (all three required; no borders, only the title text, no store logos or icons). Re-render with `npm run covers -- <slug>` after changing the SVG.
- [ ] Description and controls text entered (taken from `game.json` `description` / `instructions` / `controls`); English is required.
- [ ] Orientation chosen in the form to match `game.json` `orientation` (the dashboard setting, not game logic).
- [ ] Game is playable with mouse + keyboard, and with touch if `controls` lists touch; no custom fullscreen button.
- [ ] Legible at 16:9 iframe sizes from 907x510 up to 1920x1080 and mobile 800x450 (check in the preview).
- [ ] No other portal's branding, no cross-promotion, no store links, no external links (the adapter sets `features.externalLinks = false`; confirm the game shows none).
- [ ] If the game saves progress: tick the **Progress Save** option at submission, otherwise the data module reports `dataModuleDisabled` and saves silently fall back to localStorage. **UNVERIFIED:** exact label and location of this toggle in the dashboard.
- [ ] Mobile: `user-select: none` on body and safe-area padding (check on a phone-sized preview).
- [ ] Time to first gameplay is short (QA checks <= 20 s for externally hosted files; initial size is measured until the first `gameplayStart`).

## Manual: verify in the CrazyGames Preview tool (https://crazygames.com/preview)

- [ ] Midgame ad: game pauses and mutes at `adStarted`, resumes and unmutes at `adFinished` / `adError`; UI is blocked until one fires.
- [ ] Rewarded ad: reward granted only after `adFinished`, never on `adError`; the rewarded button is hidden or clearly unavailable when no ad can show.
- [ ] Game works with an ad blocker on (no freeze, no dead buttons, no adblock popups).
- [ ] Local testing alternative: `localhost` / `127.0.0.1` run the SDK in `local` mode; add `?useLocalSdk=true` on other hosts.

## Manual: after submitting

- [ ] Set `releases.crazygames = { "status": "submitted", "version": "<version>", "submittedAt": "<YYYY-MM-DD>" }` in `game.json`, commit, push.
- [ ] On approval set `status` to `basic` (Basic Launch, no revenue share) or `full`; on rejection set `rejected` with a `reason`.
- [ ] Basic Launch has no ads or monetisation; Full Launch (selected games) requires the SDK integration above. Payout is monthly once the balance reaches EUR 100 (CrazyGames FAQ).

## Unverified facts (do not rely on them)

- Whether the SDK may be bundled instead of CDN-loaded (we load it from the CDN).
- Zip layout expected by the upload form.
- CrazyGames policy on other external network requests (docs only forbid external ads and cross-promo links).
- Sync vs async behaviour of `SDK.data.getItem` (the adapter awaits it, which works for both).
```

`docs/specs/game-platform/checklists/gamedistribution.md`:
```markdown
# GameDistribution submission checklist

Source of facts: `.superpowers/sdd/p2-research.md` (GD-HTML5 GitHub wiki, fetched 2026-11-21). Official size limits, thumbnail specs and revenue terms were NOT found; those items are **UNVERIFIED** and must be read from the dashboard (https://developer.gamedistribution.com).

Per game: work top to bottom, then update `games/<slug>/game.json` `releases.gamedistribution` and run `npm run release-status`.

## Automated (nothing to do by hand)

Produced by `npm run build:portals` (CI job `release-portals` attaches the zip to the GitHub Release `<slug>-v<version>`):

- Build contains only the GameDistribution adapter; no CrazyGames SDK (`scripts/check-artifact.ts`).
- Only external host the game loads at runtime is `html5.api.gamedistribution.com`; no other absolute URLs (`check-artifact`). The GD SDK itself loads ad-network scripts from other domains at runtime; that is outside our bundle and expected.
- All asset paths relative; total size within 10 MB (`check-artifact`).
- `GD_OPTIONS` (gameId + event handler) is set before the SDK script loads; rewards are granted only on `SDK_REWARDED_WATCH_COMPLETE`; pause/mute follows `SDK_GAME_PAUSE` / `SDK_GAME_START` (adapter unit tests + portal smoke with fake SDK).
- **A GameDistribution zip is only built for games that have `portalIds.gamedistribution` in `game.json`.** Until then `npm run build:portals` prints a SKIP warning for that game and CI stays green.

## Manual: getting a gameId and building the zip

- [ ] Create a developer account and register the game in https://developer.gamedistribution.com to obtain its **gameId** (a hash). **UNVERIFIED:** whether the id is issued before the first zip upload; if the dashboard demands a zip first, build a throwaway one with `GD_GAME_ID=placeholder node scripts/build-games.ts gamedistribution` (output in `dist/gamedistribution/<slug>`), upload it, then rebuild with the real id.
- [ ] Add the id to `games/<slug>/game.json`: `"portalIds": { "gamedistribution": "<gameId>" }`, commit, push. CI then builds `<slug>-gamedistribution-v<version>.zip`. CI attaches it to the existing `<slug>-v<version>` release if that tag already exists (missing zips are uploaded; existing ones are never overwritten).
- [ ] Upload the zip on the Upload tab of the developer dashboard. **UNVERIFIED:** whether `index.html` must be at the zip root (we ship it at the root).
- [ ] Rewarded ads: if the game uses rewarded ads, enable the **Rewarded Ads** flag for the game in the dashboard (documented requirement); otherwise `preloadAd('rewarded')` rejects and the adapter resolves `unavailable`.

## Manual: SDK activation and listing

- [ ] Activate the SDK: in the dashboard's iframe preview, watch one video ad all the way through; the SDK flag then turns active. Disable ad blockers while doing this.
- [ ] Local testing: ads generally do not show locally; use `gdsdk.openConsole()` in the browser console (select the right frame when iframed). We never set `advertisementSettings.debug`.
- [ ] Interstitials must be triggered from a user gesture (GD docs: call `showAd()` from a mouseup / touchend handler). Confirm the game's ad moments (game over, retry) follow a tap or key press; otherwise the ad may silently not show.
- [ ] Game title, description, instructions and tags entered (from `game.json`).
- [ ] Thumbnails / screenshots uploaded. **UNVERIFIED:** required sizes (GD docs not found); `games/<slug>/store/` PNGs from `npm run covers -- <slug>` are CrazyGames-sized and may need re-cropping.
- [ ] No other portal's branding, no external links (the adapter sets `features.externalLinks = false`).
- [ ] Game pauses and mutes during ads, and works with ads unavailable.
- [ ] Request publication. **UNVERIFIED / conflicting:** review time is "up to 2 days" (FAQ) vs "up to two weeks" (SDK wiki).

## Manual: after submitting

- [ ] Set `releases.gamedistribution = { "status": "submitted", "version": "<version>", "submittedAt": "<YYYY-MM-DD>" }` in `game.json`, commit, push. Use `live` once it is published, or `rejected` with a `reason`.

## Unverified facts (do not rely on them)

- Revenue share (a third-party source says 33% of net revenue) and payout minimum (EUR 50 per GD FAQ vs EUR 100 per a third party).
- Maximum zip size, accepted thumbnail sizes, any ban on external links.
- Raw type string for interstitial and display ads (the adapter uses the default `showAd()` with no argument for interstitials).
```

- [ ] **Step 5: Run tests and the CLI**

Run: `npx vitest run scripts/release-status.test.ts scripts/checklists.test.ts && npm run typecheck && npm test`
Expected: PASS.

Then: `npm run release-status`
Expected output (column widths may differ):
```
GAME        VERSION  TARGET            STATUS  RELEASED  SUBMITTED  NOTE
dodge-drop  0.1.0    site              -       -         -
dodge-drop  0.1.0    crazygames        -       -         -
dodge-drop  0.1.0    gamedistribution  -       -         -
```
(Task 8 fills in the `todo` entries.)

- [ ] **Step 6: Commit and push**

```bash
git add scripts/release-status.ts scripts/release-status.test.ts scripts/checklists.test.ts docs/specs/game-platform/checklists/crazygames.md docs/specs/game-platform/checklists/gamedistribution.md package.json
git commit -m "$(cat <<'EOF'
feat(scripts): add release-status table and portal submission checklists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

---

### Task 8: `render-covers` and dodge-drop submission prep

**Files:**
- Create: `scripts/render-covers.ts`, `scripts/render-covers.test.ts`, `games/dodge-drop/store/landscape-1920x1080.png`, `games/dodge-drop/store/portrait-800x1200.png`, `games/dodge-drop/store/square-800x800.png`
- Modify: `games/dodge-drop/game.json`, `package.json`, `docs/plans/2026-11-21-game-platform-p2-portals.md` (status line)

**Interfaces:**
- Produces: `COVER_SIZES` (`{ name, width, height }[]`), `extractBackground(svg): string` (first `<rect fill="#hex">`, default `#111111`), `coverHtml(svg, width, height, bg): string`, `readPngSize(buf): { width, height }`, `renderCovers(slug, gamesDir?): Promise<string[]>` (writes into `games/<slug>/store/`). CLI: `npm run covers -- <slug>`.
- Consumes: `loadGames`/`GAMES_DIR`, `chromium` from `@playwright/test` (dynamic import, so unit tests never launch a browser), `games/<slug>/public/<manifest.cover>` (must be `.svg`).

- [ ] **Step 1: Write the failing tests**

`scripts/render-covers.test.ts`:
```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMES_DIR } from './lib/games.ts';
import { COVER_SIZES, coverHtml, extractBackground, readPngSize } from './render-covers.ts';

describe('COVER_SIZES', () => {
  it('lists the three CrazyGames cover formats', () => {
    expect(COVER_SIZES.map((s) => `${s.width}x${s.height}`)).toEqual(['1920x1080', '800x1200', '800x800']);
    expect(COVER_SIZES.map((s) => s.name)).toEqual([
      'landscape-1920x1080.png',
      'portrait-800x1200.png',
      'square-800x800.png',
    ]);
  });
});

describe('extractBackground', () => {
  it('returns the fill of the first rect', () => {
    expect(extractBackground('<svg><rect width="1" height="1" fill="#111827"/><rect fill="#fff"/></svg>')).toBe('#111827');
  });

  it('falls back to #111111', () => {
    expect(extractBackground('<svg><circle r="1"/></svg>')).toBe('#111111');
  });
});

describe('coverHtml', () => {
  const html = coverHtml('<svg xmlns="http://www.w3.org/2000/svg"/>', 800, 1200, '#111827');

  it('sizes the page, centres the image and fills with the background colour', () => {
    expect(html).toContain('width:800px');
    expect(html).toContain('height:1200px');
    expect(html).toContain('background:#111827');
    expect(html).toContain('align-items:center');
    expect(html).toContain('data:image/svg+xml;base64,');
  });
});

describe('readPngSize', () => {
  it('reads width and height from the IHDR chunk', () => {
    const buf = Buffer.alloc(24);
    buf.writeUInt32BE(800, 16);
    buf.writeUInt32BE(1200, 20);
    expect(readPngSize(buf)).toEqual({ width: 800, height: 1200 });
  });
});

describe('committed store covers', () => {
  const slugs = readdirSync(GAMES_DIR).filter((d) => existsSync(join(GAMES_DIR, d, 'store')));
  it.each(slugs)('%s: every committed cover has its exact size', (slug) => {
    for (const size of COVER_SIZES) {
      const file = join(GAMES_DIR, slug, 'store', size.name);
      expect(existsSync(file), `${slug}/store/${size.name} missing`).toBe(true);
      expect(readPngSize(readFileSync(file))).toEqual({ width: size.width, height: size.height });
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/render-covers.test.ts`
Expected: FAIL — `./render-covers.ts` unresolved.

- [ ] **Step 3: Implement**

`scripts/render-covers.ts`:
```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES_DIR, loadGames } from './lib/games.ts';

export const COVER_SIZES = [
  { name: 'landscape-1920x1080.png', width: 1920, height: 1080 },
  { name: 'portrait-800x1200.png', width: 800, height: 1200 },
  { name: 'square-800x800.png', width: 800, height: 800 },
] as const;

/** Background colour of a cover SVG: fill of its first <rect>, else #111111. */
export function extractBackground(svg: string): string {
  return /<rect\b[^>]*\bfill="(#[0-9a-fA-F]{3,8})"/.exec(svg)?.[1] ?? '#111111';
}

export function coverHtml(svg: string, width: number, height: number, bg: string): string {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return (
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    `html,body{margin:0;width:${width}px;height:${height}px;background:${bg};overflow:hidden}` +
    'body{display:flex;align-items:center;justify-content:center}' +
    'img{width:100%;height:auto;max-height:100%;object-fit:contain;display:block}' +
    `</style></head><body><img src="${src}" alt=""></body></html>`
  );
}

export function readPngSize(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Renders games/<slug>/public/<cover>.svg to the three store PNGs in games/<slug>/store/. Returns the file paths. */
export async function renderCovers(slug: string, gamesDir: string = GAMES_DIR): Promise<string[]> {
  const manifest = loadGames(gamesDir).find((g) => g.slug === slug);
  if (!manifest) throw new Error(`Unknown game "${slug}"`);
  if (!manifest.cover.toLowerCase().endsWith('.svg')) throw new Error(`cover "${manifest.cover}" must be an .svg to render store covers`);
  const svg = readFileSync(join(gamesDir, slug, 'public', manifest.cover), 'utf8');
  const bg = extractBackground(svg);
  const outDir = join(gamesDir, slug, 'store');
  mkdirSync(outDir, { recursive: true });

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const written: string[] = [];
    for (const size of COVER_SIZES) {
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
      await page.setContent(coverHtml(svg, size.width, size.height, bg));
      const file = join(outDir, size.name);
      writeFileSync(file, await page.screenshot({ type: 'png' }));
      await page.close();
      written.push(file);
    }
    return written;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: npm run covers -- <slug>');
    process.exit(2);
  }
  for (const file of await renderCovers(slug)) console.log(`[covers] ${file}`);
}
```

Edit `package.json` — old_string `    "release-status": "node scripts/release-status.ts",` new_string:
```json
    "release-status": "node scripts/release-status.ts",
    "covers": "node scripts/render-covers.ts",
```

- [ ] **Step 4: Run unit tests, then render the real covers**

Run: `npx vitest run scripts/render-covers.test.ts && npm run typecheck`
Expected: PASS (the "committed store covers" block has no entries yet, so only the pure tests run).

Render (needs the Playwright chromium from P1; if missing run `npx playwright install chromium`):
```bash
npm run covers -- dodge-drop
file games/dodge-drop/store/*.png
```
Expected: three `[covers] .../games/dodge-drop/store/...png` lines, and `file` reports `PNG image data, 1920 x 1080`, `800 x 1200`, `800 x 800`. Open at least `portrait-800x1200.png` with the Read tool and confirm the "Dodge Drop" art is centred on the `#111827` background with no clipping. Re-run the unit tests: `npx vitest run scripts/render-covers.test.ts` — the committed-covers block now runs for `dodge-drop` and passes.

- [ ] **Step 5: Update dodge-drop's manifest**

`dodge-drop` already lists all three targets and has version `0.1.0` (the template default), so keep the version and targets; add the release entries. Edit `games/dodge-drop/game.json` — old_string `  "releases": {}` new_string:
```json
  "releases": {
    "crazygames": { "status": "todo", "version": "0.1.0" },
    "gamedistribution": { "status": "todo", "version": "0.1.0" }
  }
```

- [ ] **Step 6: Full gate and end-to-end verification**

Run:
```bash
npm run typecheck && npm test
npm run release-status
npm run build:portals
npm run test:portals
```
Expected: typecheck/tests green; `release-status` shows `dodge-drop  0.1.0  crazygames  todo  0.1.0  -` and `... gamedistribution  todo  0.1.0  -` with no "need resubmission" footer; `build:portals` builds the CrazyGames zip and prints the GD SKIP warning (exit 0); `test:portals` reports `2 passed`.

- [ ] **Step 7: Mark this plan done, commit, push**

Edit this file's header: below the `# Game Platform P2 — Portals Implementation Plan` title and the `> **For agentic workers:**` line, add the line `**Status (<today's date>):** All 8 tasks complete (commits <first sha>..<last sha>). Manual submission steps remain with the user (see Task 8 Step 8).` using real values from `git log --oneline -8`.

```bash
git add scripts/render-covers.ts scripts/render-covers.test.ts games/dodge-drop/store/landscape-1920x1080.png games/dodge-drop/store/portrait-800x1200.png games/dodge-drop/store/square-800x800.png games/dodge-drop/game.json package.json docs/plans/2026-11-21-game-platform-p2-portals.md
git commit -m "$(cat <<'EOF'
feat(dodge-drop): render store covers and record todo portal releases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push origin master
```

- [ ] **Step 8: Report what the USER must do manually (do not attempt these)**

The plan ends here for automation. In the final report, tell the user verbatim that the following are manual and cannot be automated:

1. **CrazyGames:** create a developer account, then upload `dodge-drop-crazygames-v0.1.0.zip` (from the GitHub Release `dodge-drop-v0.1.0`, or `npm run build:portals` then `dist/release/`). Upload the three covers from `games/dodge-drop/store/`, enter description/controls, choose orientation (portrait), tick **Progress Save**, and work through `docs/specs/game-platform/checklists/crazygames.md`.
2. **GameDistribution:** register the game in https://developer.gamedistribution.com to get the **gameId**, add `"portalIds": { "gamedistribution": "<gameId>" }` to `games/dodge-drop/game.json`, push; CI builds the GD zip and attaches it to the existing `dodge-drop-v0.1.0` release (missing assets are uploaded, existing ones never overwritten). Upload it, watch one ad in the preview to activate the SDK, enable Rewarded Ads if used, and work through `docs/specs/game-platform/checklists/gamedistribution.md`.
3. After each submission set `releases.<portal>.status` to `submitted` with `submittedAt` in `game.json`, commit and push, then run `npm run release-status`.
4. Decide whether to bump `dodge-drop` to `1.0.0` before the first submission (it is still `0.1.0`).

---

## Self-Review

**Spec / decisions coverage**

| Requirement (p2-decisions.md / spec) | Task |
|---|---|
| `loadScript(url, timeoutMs): Promise<boolean>`, never rejects | 1 |
| CG adapter: URL, `SDK.init` in try/catch, degraded on load fail / init throw / `disabled` | 2 |
| CG ads callback→Promise, pause on `adStarted`, resume only if paused, 60 s safety timeout, gate 60 s | 2 |
| CG loading/gameplay mapping, `SDK.data` only when `environment === 'crazygames'`, `gk:` keys, features | 2 |
| GD adapter: build-time `__GK_GD_GAME_ID__`, `GD_OPTIONS` before script, `SDK_READY` wait/timeout, events, `showAd`/`preloadAd`, reward only on `SDK_REWARDED_WATCH_COMPLETE`, empty id → degraded without loading | 3 |
| Both adapters pass `runPlatformContract` + adapter-specific tests with mock SDKs on `globalThis` | 2, 3 |
| `env.d.ts` declaration, vitest define `'""'`, vite-config define from `GD_GAME_ID` | 1 |
| Manifest `portalIds?: { gamedistribution?: string }` + validation; GD build skipped without id with warning | 1, 5 |
| `checkArtifact(dir, platform): string[]`: ≤ 10 MB, relative paths, index.html root, host allowlist discovered from a real build, foreign SDK marker; temp-dir tests | 4 (+ real-build verification in 4/5) |
| `build-portals.ts` via `buildGames`, per-game `GD_GAME_ID`, `checkArtifact` gate, zips `dist/release/<slug>-<platform>-v<version>.zip` with system `zip`, npm script `build:portals` | 5 |
| Portal smoke: Playwright, `page.route()` fake SDKs in `e2e/fixtures/`, boots, no console errors, CG `gameplayStart`, assertions via fake SDK recording | 5 |
| CI `release-portals` (needs build-platform, create release only if tag missing, `contents: write`, GITHUB_TOKEN) | 6 |
| `release-status` + pure `renderStatusTable`, flags `release.version < game.version` | 7 |
| Checklists (automated + manual, UNVERIFIED marked) | 7 |
| `render-covers` 1920x1080 / 800x1200 / 800x800 into committed `games/<slug>/store/` | 8 |
| dodge-drop: targets, `releases` todo, covers; version unchanged | 8 |
| Final task states user's manual steps | 8 Step 8 |
| Rules test unchanged (adapters may know their id) | Global Constraints |

**Placeholder scan:** no `TBD`/`TODO`/"similar to" in steps; every code step carries full code. The only angle-bracket values (`<slug>`, `<gameId>`, `<today's date>`, `<first sha>`) are runtime values supplied by the executor or user.

**Type consistency:** `PortalPlatform` is defined in `scripts/check-artifact.ts` (Task 4) and imported by `build-portals.ts` (Task 5); `zipName` output matches the `ZIP_RE` in `release-portals.ts` (Task 6) including slugs with dashes; `GameManifest.portalIds` (Task 1) is read in `selectGames`/`gameEnv` (Task 5); `GD_GAME_ID` env → `__GK_GD_GAME_ID__` define (Task 1) → `gameId` default in the GD adapter (Task 3); `SMOKE_GD_ID` (`smoke-test-game-id`) is asserted by `e2e/fixtures/fake-gd-sdk.js` consumers in `portals.spec.ts` (Task 5); `CrazyGamesOptions`/`GameDistributionOptions` field names used in tests match the implementations; `COVER_SIZES` names used by the store-covers test match the files Task 8 renders.

## Open issues for controller

1. **RESOLVED by controller (2026-11-21): existing tag → upload only missing zips (Task 6 updated).** Original note: Decision said "tag exists → skip". The GD zip only appears after the user adds `portalIds.gamedistribution`, usually after the CrazyGames zip already created `dodge-drop-v0.1.0`, so CI never attaches the GD zip to that release (needs a version bump or a local `npm run build:portals`). Implemented as decided and documented in the GD checklist and Task 8 Step 8. Suggested follow-up: `gh release upload` for missing assets on an existing tag.
2. **Allowlist is wider than the decision's example.** A real Phaser bundle contains inert strings for `opensource.org`, `prunegames.com`, `github.com`, `phaser.io`, `steffe.se` besides `www.w3.org` (found by scanning a real build); all are in `INERT_HOSTS` with a documented rationale. Small additions beyond the decision: `checkArtifact` also rejects root-absolute / protocol-relative `src|href` in `index.html` and symlinks; manifest validation rejects unknown `portalIds` keys.
3. **GD smoke cannot assert "reaches GKTitle".** Test hooks are off in non-local builds and the GD adapter makes no SDK call at scene transitions. GD smoke asserts SDK_READY handshake, `GD_OPTIONS.gameId` set before load, canvas present, click without errors, and that the only external host requested is the GD SDK host. CG smoke asserts `loadingStop` (right before Title) and `gameplayStart` (after clicking Title).
4. **GD ads need a user gesture** (research B2). `session.breakpoint()` may call `showInterstitial` outside a gesture; on GD that may yield `unavailable` or a silent no-show. Retry (GameOver tap) is fine. Flagged in the GD checklist; no code change planned.
5. **`buildGames` signature extended** with an optional 4th `opts` parameter (backward compatible) to support per-game env and slug filtering.
6. **dodge-drop version is `0.1.0`, not `1.0.0`**, and it already targets crazygames and gamedistribution; Task 8 only adds `releases` todo entries and covers. The user decides whether to bump to 1.0.0 before submitting.
7. **GD gameId-before-upload order is UNVERIFIED** (research B3); the checklist gives a throwaway-id fallback build.
