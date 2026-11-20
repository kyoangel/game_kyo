# Game Platform P1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the npm-workspaces mini-game framework (platform abstraction + Phaser game-kit + game template), ship the first new game `dodge-drop`, and deploy a generated lobby site to GitHub Pages.

**Architecture:** Games call a single `Platform` interface; Vite aliases `@platform/active` to exactly one adapter file chosen by the `PLATFORM` env var, so each build contains only that platform's code. `@gf/game-kit` wraps Phaser 3 with standard Preload → Title → Play → GameOver scenes and a `GameSession` that owns gameplay/ad/best-score state. A Node script renders a static, SEO-friendly lobby plus one wrapper page per game from each `games/<slug>/game.json`.

**Tech Stack:** TypeScript 5.8+, Phaser 3.88, Vite 6, Vitest 3 (+ jsdom), Playwright 1.48+, Node 24 (native TS type-stripping for scripts), GitHub Actions + `JamesIves/github-pages-deploy-action@v4`.

**Spec:** `docs/specs/game-platform/architecture.md` (this plan = spec §8 steps 1–3).
**Next plan (not here):** P2 — `crazygames` / `gamedistribution` adapters, build-artifact checks (no external URLs, ≤ 10 MB, no foreign SDKs), zip → GitHub Release, `release-status`, per-platform checklists, first submission.

## Global Constraints

- Existing games are untouched: `workspace/`, `workspace-merge10x/`, `workspace-pixel-squad/` keep their own `package.json`/lockfiles and CI jobs. The root workspaces list MUST NOT include them.
- Node scripts are run as `node scripts/<name>.ts` (Node 24 type stripping): only erasable TS syntax — no `enum`, no `namespace`, no constructor parameter properties; type-only imports use `import type`. Enforced by `"erasableSyntaxOnly": true`.
- Relative TS imports always include the `.ts` extension.
- Game code and `packages/game-kit/src` MUST NOT branch on platform id (`platform.id`, `id === 'crazygames'` …). Use `platform.features`. Enforced by `scripts/rules.test.ts`.
- Ad calls never reject; failures resolve `'unavailable'`.
- All site and game URLs are relative (`./`, `../`). No hard-coded `/game_kyo/`. `SITE_URL` env (default `https://kyoangel.github.io/game_kyo/`) is used only for `<link rel="canonical">`. This replaces the spec's `SITE_BASE` (same goal: switching to a custom domain is config-only).
- Reserved slugs (collide with existing gh-pages folders or site paths): `merge10`, `merge10x`, `pixel-squad`, `static`, `assets`, `play`.
- Storage keys: adapters prefix with `gk:`; best score key is `<slug>:best` → stored as `gk:<slug>:best` (the lobby reads this).
- Site languages: `en` and `zh-TW`. `en` is mandatory in every localized field.
- Phase 1 site has no ads: the `site` adapter returns `'unavailable'` for every ad.
- Per project memory: after each task's commit, `git push origin master`.

## File Structure

```
package.json                     root, npm workspaces: packages/*, games/*
tsconfig.base.json / tsconfig.json
vitest.config.ts                 unit tests (scoped; never scans workspace*/)
playwright.config.ts             smoke tests against dist/local
packages/platform/
  package.json                   @gf/platform
  src/types.ts                   Platform, AdResult, PlatformId, PlatformFeatures, PlatformStorage
  src/storage.ts                 createSafeLocalStorage(prefix) — localStorage with in-memory fallback
  src/adEvents.ts                createAdEvents() — pause/resume listener hub
  src/intervalGate.ts            createIntervalGate(minMs, now) — interstitial frequency cap
  src/locale.ts                  detectLocale()
  src/index.ts                   re-exports
  src/testing/contract.ts        runPlatformContract(name, factories) — shared adapter contract suite
  src/adapters/local.ts          dev/test adapter (fake ads)
  src/adapters/site.ts           own website adapter (phase 1: no ads)
  src/adapters/*.test.ts
packages/game-kit/
  package.json                   @gf/game-kit
  vite-config.ts                 createGameViteConfig(gameDir) — PLATFORM → adapter alias
  src/env.d.ts                   declare __GK_TEST_HOOKS__
  src/i18n.ts                    Strings, mergeStrings, resolveLocale, createI18n
  src/builtinStrings.ts          kit UI strings (en, zh-TW)
  src/manifest.ts                GameManifest types, validateSlug, validateManifest
  src/session.ts                 GameSession — state machine, best score, ad orchestration
  src/kit.ts                     Kit (scene switching facade), getKit(scene), KIT_KEY
  src/scenes/PreloadScene.ts     'GKPreload'
  src/scenes/TitleScene.ts       'GKTitle'
  src/scenes/GameOverScene.ts    'GKGameOver'
  src/defineGame.ts              defineGame(def) — boots Phaser + platform + session
  src/index.ts                   public exports
templates/game/                  scaffold copied by new-game (placeholders __SLUG__, __TITLE__)
games/dodge-drop/                first game
scripts/
  lib/games.ts                   loadGames(gamesDir), GAMES_DIR
  new-game.ts                    scaffoldGame(slug, opts) + CLI
  build-games.ts                 buildGames(platform, outRoot, layout) + CLI
  build-site.ts                  builds site target + renders lobby/wrapper pages
  serve-static.ts                tiny static server for Playwright
  rules.test.ts                  bans platform-id branching
site/
  src/render.ts                  renderLobby, renderGamePage, escapeHtml
  legacy-games.json              cards for the 3 existing games
  static/site.css
e2e/smoke.spec.ts                one smoke test per game
.github/workflows/deploy.yml     + build-platform job; hub job removed
hub/                             deleted (replaced by site/)
```

---

### Task 1: Root npm workspaces skeleton

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/skeleton.test.ts`
- Modify: `docs/specs/game-platform/architecture.md` (sync deviations)

**Interfaces:**
- Produces: root scripts `typecheck`, `test`, `new-game`, `build:local`, `build:site`, `test:smoke` (later tasks create the scripts they call); TS path alias `@platform/active`; global define `__GK_TEST_HOOKS__` in Vitest = `false`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "game-factory",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "games/*"],
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "new-game": "node scripts/new-game.ts",
    "build:local": "node scripts/build-games.ts local",
    "build:site": "node scripts/build-site.ts",
    "test:smoke": "npm run build:local && playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^24.0.0",
    "jsdom": "^29.1.1",
    "typescript": "^5.8.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json` and `tsconfig.json`**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "types": ["node", "vite/client"],
    "paths": {
      "@platform/active": ["./packages/platform/src/adapters/local.ts"]
    }
  }
}
```

`tsconfig.json`:
```json
{
  "extends": "./tsconfig.base.json",
  "include": ["packages", "games", "site", "scripts", "templates", "e2e", "*.ts"],
  "exclude": ["**/node_modules", "**/dist"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@platform/active': fileURLToPath(new URL('./packages/platform/src/adapters/local.ts', import.meta.url)),
    },
  },
  define: { __GK_TEST_HOOKS__: 'false' },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'games/*/src/**/*.test.ts',
      'site/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write a skeleton test proving legacy projects stay standalone**

`scripts/skeleton.test.ts`:
```ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('workspace skeleton', () => {
  it('does not list legacy game folders as workspaces', () => {
    const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { workspaces: string[] };
    expect(pkg.workspaces).toEqual(['packages/*', 'games/*']);
  });

  it.each(['workspace', 'workspace-merge10x', 'workspace-pixel-squad'])(
    '%s is still its own npm project root',
    (dir) => {
      const prefix = execFileSync('npm', ['prefix'], { cwd: `${root}${dir}`, encoding: 'utf8' }).trim();
      expect(prefix.endsWith(dir)).toBe(true);
    },
  );
});
```

- [ ] **Step 5: Install and run**

Run: `npm install && npm test`
Expected: `npm install` creates root `package-lock.json` and `node_modules/`; Vitest reports 4 passed (scripts/skeleton.test.ts).

- [ ] **Step 6: Confirm legacy CI path still works**

Run: `cd workspace-pixel-squad && npm ci --dry-run >/dev/null && echo OK; cd ..`
Expected: `OK` (npm treats it as an independent project).

- [ ] **Step 7: Sync spec deviations decided during planning**

In `docs/specs/game-platform/architecture.md`:
1. Replace `type AdResult = 'rewarded' | 'skipped' | 'unavailable';` with
   `type AdResult = 'shown' | 'rewarded' | 'skipped' | 'unavailable'; // 'shown' = interstitial played`
2. Replace the table row ``| 標準場景流程 | Boot → Preload（自動回報 loadingProgress）→ 遊戲的 PlayScene → 共用 GameOver（重玩 / 看廣告續命） |`` with
   ``| 標準場景流程 | Preload（自動回報 loadingProgress）→ Title → 遊戲的 PlayScene → 共用 GameOver（重玩）；看廣告續命由遊戲自行以 `kit.showRewarded()` 實作 |``
3. Replace the line starting `` - `site` 部署於 `kyoangel.github.io/game_kyo/`。Vite `base` 一律由環境變數 `SITE_BASE` 控制`` (whole bullet) with
   `` - `site` 部署於 `kyoangel.github.io/game_kyo/`。網站與遊戲內所有連結一律用相對路徑（`./`、`../`），遊戲 build 用 `base: './'`；`SITE_URL` 環境變數只用於 canonical 網址。換網域時只改 `SITE_URL`。``
4. In 第二階段, replace `` `SITE_BASE=/`；`` with `` `SITE_URL=https://<domain>/`；``
5. In §4, replace `- **每款遊戲獨立網址** `/<slug>/`（非 hash 路由），頁面含標題、說明、玩法文字，以利 SEO。` with
   `- **每款遊戲獨立網址** `/<slug>/`（非 hash 路由）：外框頁含標題、說明、玩法文字（SEO），遊戲本體在 `/<slug>/game/` 以 iframe 嵌入。`
6. In §3.2 row `暫停/音效`, replace `分頁隱藏與廣告期間自動暫停並靜音` with `廣告期間暫停 game loop 並靜音；分頁隱藏沿用 Phaser 內建的自動暫停`

- [ ] **Step 8: Typecheck and commit**

Run: `npm run typecheck`
Expected: exits 0.

```bash
git add package.json package-lock.json tsconfig.base.json tsconfig.json vitest.config.ts scripts/skeleton.test.ts docs/specs/game-platform/architecture.md
git commit -m "build: add root npm workspaces skeleton for game platform"
git push origin master
```

---

### Task 2: `@gf/platform` — interface, helpers, contract suite, `local` + `site` adapters

**Files:**
- Create: `packages/platform/package.json`, `packages/platform/src/{types,storage,adEvents,intervalGate,locale,index}.ts`, `packages/platform/src/testing/contract.ts`, `packages/platform/src/adapters/{local,site}.ts`, `packages/platform/src/adapters/{local,site}.test.ts`, `packages/platform/src/helpers.test.ts`

**Interfaces:**
- Produces (exact):
```ts
export type PlatformId = 'local' | 'site' | 'crazygames' | 'gamedistribution';
export type AdResult = 'shown' | 'rewarded' | 'skipped' | 'unavailable';
export interface PlatformFeatures { externalLinks: boolean; leaderboard: boolean }
export interface PlatformStorage { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }
export interface Platform { id; features; init(); loadingProgress(ratio); loadingDone(); gameplayStart(); gameplayStop();
  showInterstitial(): Promise<AdResult>; showRewarded(): Promise<AdResult>; storage: PlatformStorage; locale(): string;
  onAdPause(cb: () => void): void; onAdResume(cb: () => void): void }
// every adapter module: export function createPlatform(opts?): Platform
// '@gf/platform/testing': runPlatformContract(name: string, f: { normal: () => Platform; failingAds: () => Platform }): void
```
- local adapter: `export type LocalAdMode = 'play' | 'skipped' | 'unavailable' | 'throw'`; `export interface LocalOptions { adDurationMs?: number; interstitialMinIntervalMs?: number; now?: () => number; adMode?: () => LocalAdMode }`.

- [ ] **Step 1: Package manifest**

`packages/platform/package.json`:
```json
{
  "name": "@gf/platform",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing/contract.ts"
  }
}
```

- [ ] **Step 2: Types**

`packages/platform/src/types.ts`:
```ts
export type PlatformId = 'local' | 'site' | 'crazygames' | 'gamedistribution';

/** 'shown' = interstitial played; 'rewarded'/'skipped' = rewarded ad outcome; 'unavailable' = no ad (any failure). */
export type AdResult = 'shown' | 'rewarded' | 'skipped' | 'unavailable';

export const AD_RESULTS: readonly AdResult[] = ['shown', 'rewarded', 'skipped', 'unavailable'];

export interface PlatformFeatures {
  externalLinks: boolean;
  leaderboard: boolean;
}

export interface PlatformStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface Platform {
  readonly id: PlatformId;
  readonly features: PlatformFeatures;
  init(): Promise<void>;
  loadingProgress(ratio: number): void;
  loadingDone(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<AdResult>;
  showRewarded(): Promise<AdResult>;
  storage: PlatformStorage;
  locale(): string;
  onAdPause(cb: () => void): void;
  onAdResume(cb: () => void): void;
}
```

- [ ] **Step 3: Write failing helper tests**

`packages/platform/src/helpers.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdEvents } from './adEvents.ts';
import { createIntervalGate } from './intervalGate.ts';
import { createSafeLocalStorage } from './storage.ts';

afterEach(() => vi.unstubAllGlobals());

describe('createSafeLocalStorage', () => {
  it('prefixes keys in localStorage', async () => {
    const s = createSafeLocalStorage('gk:');
    await s.set('a', '1');
    expect(localStorage.getItem('gk:a')).toBe('1');
    expect(await s.get('a')).toBe('1');
  });

  it('returns null for missing keys', async () => {
    expect(await createSafeLocalStorage('gk:').get(`missing-${Math.random()}`)).toBeNull();
  });

  it('falls back to memory when localStorage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
    });
    const s = createSafeLocalStorage('gk:');
    await s.set('b', '2');
    expect(await s.get('b')).toBe('2');
  });
});

describe('createAdEvents', () => {
  it('notifies listeners and survives a throwing listener', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ev = createAdEvents();
    const log: string[] = [];
    ev.onPause(() => { throw new Error('boom'); });
    ev.onPause(() => log.push('pause'));
    ev.onResume(() => log.push('resume'));
    ev.emitPause();
    ev.emitResume();
    expect(log).toEqual(['pause', 'resume']);
    expect(errSpy).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });
});

describe('createIntervalGate', () => {
  it('passes first call, blocks within interval, passes after', () => {
    let t = 1000;
    const gate = createIntervalGate(500, () => t);
    expect(gate.tryPass()).toBe(true);
    t = 1400;
    expect(gate.tryPass()).toBe(false);
    t = 1500;
    expect(gate.tryPass()).toBe(true);
  });

  it('with 0 interval always passes', () => {
    const gate = createIntervalGate(0, () => 5);
    expect(gate.tryPass()).toBe(true);
    expect(gate.tryPass()).toBe(true);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run packages/platform/src/helpers.test.ts`
Expected: FAIL — cannot resolve `./adEvents.ts` etc.

- [ ] **Step 5: Implement helpers**

`packages/platform/src/storage.ts`:
```ts
import type { PlatformStorage } from './types.ts';

/** localStorage-backed storage that never throws; falls back to memory (private mode, blocked storage). */
export function createSafeLocalStorage(prefix: string): PlatformStorage {
  const memory = new Map<string, string>();
  const ls = (): Storage | null => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  };
  return {
    async get(key) {
      const k = prefix + key;
      try {
        const v = ls()?.getItem(k);
        if (v !== null && v !== undefined) return v;
      } catch {
        // fall through to memory
      }
      return memory.get(k) ?? null;
    },
    async set(key, value) {
      const k = prefix + key;
      memory.set(k, value);
      try {
        ls()?.setItem(k, value);
      } catch {
        // memory copy already stored
      }
    },
  };
}
```

`packages/platform/src/adEvents.ts`:
```ts
export interface AdEvents {
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  emitPause(): void;
  emitResume(): void;
}

function safeCall(cb: () => void): void {
  try {
    cb();
  } catch (e) {
    console.error('[platform] ad listener failed', e);
  }
}

export function createAdEvents(): AdEvents {
  const pause: Array<() => void> = [];
  const resume: Array<() => void> = [];
  return {
    onPause: (cb) => { pause.push(cb); },
    onResume: (cb) => { resume.push(cb); },
    emitPause: () => { for (const cb of pause) safeCall(cb); },
    emitResume: () => { for (const cb of resume) safeCall(cb); },
  };
}
```

`packages/platform/src/intervalGate.ts`:
```ts
export interface IntervalGate {
  tryPass(): boolean;
}

export function createIntervalGate(minIntervalMs: number, now: () => number = () => Date.now()): IntervalGate {
  let last = Number.NEGATIVE_INFINITY;
  return {
    tryPass() {
      const t = now();
      if (t - last < minIntervalMs) return false;
      last = t;
      return true;
    },
  };
}
```

`packages/platform/src/locale.ts`:
```ts
export function detectLocale(): string {
  try {
    const lang = globalThis.navigator?.language;
    return typeof lang === 'string' && lang.length > 0 ? lang : 'en';
  } catch {
    return 'en';
  }
}
```

- [ ] **Step 6: Run helper tests**

Run: `npx vitest run packages/platform/src/helpers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Write the shared contract suite**

`packages/platform/src/testing/contract.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AD_RESULTS, type Platform } from '../types.ts';

export interface ContractFactories {
  /** Adapter in its normal environment (ads may or may not be available). */
  normal: () => Platform;
  /** Adapter whose underlying ad SDK fails/throws. */
  failingAds: () => Platform;
}

/** Every adapter MUST pass this suite. Call it from `<adapter>.test.ts` (jsdom environment). */
export function runPlatformContract(name: string, f: ContractFactories): void {
  describe(`${name} adapter contract`, () => {
    afterEach(() => vi.unstubAllGlobals());

    it('init resolves', async () => {
      await expect(f.normal().init()).resolves.toBeUndefined();
    });

    it('exposes boolean features and a non-empty locale', () => {
      const p = f.normal();
      expect(typeof p.features.externalLinks).toBe('boolean');
      expect(typeof p.features.leaderboard).toBe('boolean');
      expect(p.locale().length).toBeGreaterThan(0);
    });

    it('lifecycle calls do not throw', async () => {
      const p = f.normal();
      await p.init();
      expect(() => {
        p.loadingProgress(0.5);
        p.loadingDone();
        p.gameplayStart();
        p.gameplayStop();
      }).not.toThrow();
    });

    it('ad calls resolve to a valid AdResult', async () => {
      const p = f.normal();
      await p.init();
      expect(AD_RESULTS).toContain(await p.showInterstitial());
      expect(AD_RESULTS).toContain(await p.showRewarded());
    });

    it('interstitial never resolves rewarded/skipped; rewarded never resolves shown', async () => {
      const p = f.normal();
      await p.init();
      expect(['shown', 'unavailable']).toContain(await p.showInterstitial());
      expect(['rewarded', 'skipped', 'unavailable']).toContain(await p.showRewarded());
    });

    it('ad failures resolve unavailable and never reject', async () => {
      const p = f.failingAds();
      await p.init();
      await expect(p.showInterstitial()).resolves.toBe('unavailable');
      await expect(p.showRewarded()).resolves.toBe('unavailable');
    });

    it('emits pause before and resume after any ad that plays', async () => {
      const p = f.normal();
      const log: string[] = [];
      p.onAdPause(() => log.push('pause'));
      p.onAdResume(() => log.push('resume'));
      await p.init();
      const r = await p.showRewarded();
      expect(log).toEqual(r === 'unavailable' ? [] : ['pause', 'resume']);
    });

    it('storage round-trips and returns null for missing keys', async () => {
      const p = f.normal();
      const key = `contract-${Math.random()}`;
      expect(await p.storage.get(key)).toBeNull();
      await p.storage.set(key, 'v1');
      expect(await p.storage.get(key)).toBe('v1');
    });

    it('storage keeps working when localStorage throws', async () => {
      vi.stubGlobal('localStorage', {
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); },
      });
      const p = f.normal();
      await p.storage.set('k', 'v');
      expect(await p.storage.get('k')).toBe('v');
    });
  });
}
```

- [ ] **Step 8: Write failing adapter tests**

`packages/platform/src/adapters/local.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { createPlatform } from './local.ts';

runPlatformContract('local', {
  normal: () => createPlatform({ adDurationMs: 0 }),
  failingAds: () => createPlatform({ adDurationMs: 0, adMode: () => 'throw' }),
});

describe('local adapter specifics', () => {
  it('is id local with all features on', () => {
    const p = createPlatform();
    expect(p.id).toBe('local');
    expect(p.features).toEqual({ externalLinks: true, leaderboard: true });
  });

  it('interstitial resolves shown, rewarded resolves rewarded by default', async () => {
    const p = createPlatform({ adDurationMs: 0 });
    expect(await p.showInterstitial()).toBe('shown');
    expect(await p.showRewarded()).toBe('rewarded');
  });

  it('honours adMode skipped / unavailable', async () => {
    expect(await createPlatform({ adDurationMs: 0, adMode: () => 'skipped' }).showRewarded()).toBe('skipped');
    expect(await createPlatform({ adDurationMs: 0, adMode: () => 'unavailable' }).showInterstitial()).toBe('unavailable');
  });

  it('frequency-caps interstitials', async () => {
    let t = 0;
    const p = createPlatform({ adDurationMs: 0, interstitialMinIntervalMs: 1000, now: () => t });
    expect(await p.showInterstitial()).toBe('shown');
    t = 500;
    expect(await p.showInterstitial()).toBe('unavailable');
    t = 1000;
    expect(await p.showInterstitial()).toBe('shown');
  });

  it('reads window.__GK_LOCAL_AD__ when no adMode is given', async () => {
    (globalThis as { __GK_LOCAL_AD__?: string }).__GK_LOCAL_AD__ = 'unavailable';
    try {
      expect(await createPlatform({ adDurationMs: 0 }).showRewarded()).toBe('unavailable');
    } finally {
      delete (globalThis as { __GK_LOCAL_AD__?: string }).__GK_LOCAL_AD__;
    }
  });
});
```

`packages/platform/src/adapters/site.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { runPlatformContract } from '../testing/contract.ts';
import { createPlatform } from './site.ts';

runPlatformContract('site', { normal: () => createPlatform(), failingAds: () => createPlatform() });

describe('site adapter (phase 1)', () => {
  it('has no ads yet and allows external links', async () => {
    const p = createPlatform();
    expect(p.id).toBe('site');
    expect(p.features).toEqual({ externalLinks: true, leaderboard: false });
    expect(await p.showInterstitial()).toBe('unavailable');
    expect(await p.showRewarded()).toBe('unavailable');
  });

  it('stores under the gk: prefix (lobby reads gk:<slug>:best)', async () => {
    await createPlatform().storage.set('demo:best', '42');
    expect(localStorage.getItem('gk:demo:best')).toBe('42');
  });
});
```

- [ ] **Step 9: Run to verify failure**

Run: `npx vitest run packages/platform/src/adapters`
Expected: FAIL — `./local.ts` / `./site.ts` not found.

- [ ] **Step 10: Implement adapters and index**

`packages/platform/src/adapters/local.ts`:
```ts
import { createAdEvents } from '../adEvents.ts';
import { createIntervalGate } from '../intervalGate.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { AdResult, Platform } from '../types.ts';

/** 'play' = an ad plays (interstitial → shown, rewarded → rewarded). */
export type LocalAdMode = 'play' | 'skipped' | 'unavailable' | 'throw';

export interface LocalOptions {
  adDurationMs?: number;
  interstitialMinIntervalMs?: number;
  now?: () => number;
  adMode?: () => LocalAdMode;
}

/** Dev/test override: window.__GK_LOCAL_AD__ = 'rewarded' | 'skipped' | 'unavailable' | 'throw'. */
function readGlobalMode(): LocalAdMode {
  const v = (globalThis as { __GK_LOCAL_AD__?: unknown }).__GK_LOCAL_AD__;
  if (v === 'skipped' || v === 'unavailable' || v === 'throw') return v;
  return 'play';
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createPlatform(opts: LocalOptions = {}): Platform {
  const events = createAdEvents();
  const gate = createIntervalGate(opts.interstitialMinIntervalMs ?? 0, opts.now);
  const duration = opts.adDurationMs ?? 300;
  const adMode = opts.adMode ?? readGlobalMode;

  async function fakeAd(kind: 'interstitial' | 'rewarded'): Promise<AdResult> {
    try {
      const mode = adMode();
      if (mode === 'throw') throw new Error('simulated ad failure');
      if (mode === 'unavailable') return 'unavailable';
      if (kind === 'interstitial' && mode === 'skipped') return 'unavailable';
      events.emitPause();
      try {
        await delay(duration);
      } finally {
        events.emitResume();
      }
      if (kind === 'interstitial') return 'shown';
      return mode === 'skipped' ? 'skipped' : 'rewarded';
    } catch {
      return 'unavailable';
    }
  }

  return {
    id: 'local',
    features: { externalLinks: true, leaderboard: true },
    async init() {},
    loadingProgress() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    async showInterstitial() {
      if (!gate.tryPass()) return 'unavailable';
      return fakeAd('interstitial');
    },
    showRewarded: () => fakeAd('rewarded'),
    storage: createSafeLocalStorage('gk:'),
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
```

`packages/platform/src/adapters/site.ts`:
```ts
import { createAdEvents } from '../adEvents.ts';
import { detectLocale } from '../locale.ts';
import { createSafeLocalStorage } from '../storage.ts';
import type { Platform } from '../types.ts';

/** Own website. Phase 1: no ads (AdSense H5 comes with the custom domain, spec §5.1 phase 2). */
export function createPlatform(): Platform {
  const events = createAdEvents();
  return {
    id: 'site',
    features: { externalLinks: true, leaderboard: false },
    async init() {},
    loadingProgress() {},
    loadingDone() {},
    gameplayStart() {},
    gameplayStop() {},
    showInterstitial: async () => 'unavailable',
    showRewarded: async () => 'unavailable',
    storage: createSafeLocalStorage('gk:'),
    locale: detectLocale,
    onAdPause: events.onPause,
    onAdResume: events.onResume,
  };
}
```

`packages/platform/src/index.ts`:
```ts
export type { AdResult, Platform, PlatformFeatures, PlatformId, PlatformStorage } from './types.ts';
export { AD_RESULTS } from './types.ts';
export { createAdEvents, type AdEvents } from './adEvents.ts';
export { createIntervalGate, type IntervalGate } from './intervalGate.ts';
export { createSafeLocalStorage } from './storage.ts';
export { detectLocale } from './locale.ts';
```

- [ ] **Step 11: Run all platform tests + typecheck**

Run: `npm install && npx vitest run packages/platform && npm run typecheck`
Expected: all PASS (6 helper + 9 contract×2 + 5 local + 2 site = 31 tests); typecheck exits 0.

- [ ] **Step 12: Commit**

```bash
git add packages/platform package-lock.json
git commit -m "feat(platform): add Platform interface, contract suite, local and site adapters"
git push origin master
```

---

### Task 3: `@gf/game-kit` pure logic — i18n, manifest validation, GameSession

**Files:**
- Create: `packages/game-kit/package.json`, `packages/game-kit/src/{i18n,builtinStrings,manifest,session}.ts`, `packages/game-kit/src/{i18n,manifest,session}.test.ts`

**Interfaces:**
- Consumes: `Platform`, `AdResult` from `@gf/platform`; `createPlatform` from `packages/platform/src/adapters/local.ts` (tests only).
- Produces (exact):
```ts
// i18n.ts
export type Strings = Record<string, Record<string, string>>;   // locale -> key -> text
export function mergeStrings(...sets: Strings[]): Strings;
export function resolveLocale(available: string[], requested: string): string;
export function createI18n(strings: Strings, locale: string): (key: string) => string;
// builtinStrings.ts
export const BUILTIN_STRINGS: Strings;   // keys: gk.loading gk.tapToStart gk.score gk.best gk.retry gk.gameOver
// manifest.ts
export const KNOWN_TARGETS: readonly ['site','crazygames','gamedistribution'];
export const RELEASE_STATUSES: readonly ['todo','submitted','basic','live','full','rejected'];
export const RESERVED_SLUGS: readonly string[];
export type Target; export type ReleaseStatus; export interface Release; export interface GameManifest;
export function validateSlug(slug: unknown): string | null;          // null = valid
export function validateManifest(raw: unknown): { ok: true; manifest: GameManifest } | { ok: false; errors: string[] };
// session.ts
export type SessionState = 'ready' | 'playing' | 'over';
export class GameSession {
  constructor(platform: Platform, slug: string);
  state: SessionState; lastScore: number; best: number; readonly paused: boolean;
  onPauseChange(cb: (paused: boolean) => void): void;
  loadBest(): Promise<void>; start(): void; gameOver(score: number): Promise<boolean>;
  breakpoint(): Promise<AdResult>; retry(): Promise<void>; rewarded(): Promise<AdResult>;
}
```

- [ ] **Step 1: Package manifest**

`packages/game-kit/package.json`:
```json
{
  "name": "@gf/game-kit",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@gf/platform": "*",
    "phaser": "^3.88.0"
  }
}
```

Run: `npm install`
Expected: `node_modules/@gf/game-kit` and `node_modules/phaser` exist.

- [ ] **Step 2: Write failing i18n test**

`packages/game-kit/src/i18n.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createI18n, mergeStrings, resolveLocale } from './i18n.ts';

describe('resolveLocale', () => {
  const avail = ['en', 'zh-TW'];
  it('exact match', () => expect(resolveLocale(avail, 'zh-TW')).toBe('zh-TW'));
  it('base-language match', () => expect(resolveLocale(avail, 'zh-HK')).toBe('zh-TW'));
  it('case-insensitive base match', () => expect(resolveLocale(avail, 'EN-us')).toBe('en'));
  it('falls back to en', () => expect(resolveLocale(avail, 'fr-FR')).toBe('en'));
});

describe('mergeStrings', () => {
  it('later sets override earlier per key, per locale', () => {
    const merged = mergeStrings({ en: { a: '1', b: '2' } }, { en: { b: 'B' }, 'zh-TW': { a: '一' } });
    expect(merged).toEqual({ en: { a: '1', b: 'B' }, 'zh-TW': { a: '一' } });
  });
});

describe('createI18n', () => {
  const t = createI18n({ en: { hi: 'Hi', only: 'EN only' }, 'zh-TW': { hi: '嗨' } }, 'zh-TW');
  it('uses the resolved locale', () => expect(t('hi')).toBe('嗨'));
  it('falls back to en for missing keys', () => expect(t('only')).toBe('EN only'));
  it('returns the key when nothing matches', () => expect(t('nope')).toBe('nope'));
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run packages/game-kit/src/i18n.test.ts`
Expected: FAIL — `./i18n.ts` not found.

- [ ] **Step 4: Implement i18n + builtin strings**

`packages/game-kit/src/i18n.ts`:
```ts
export type Strings = Record<string, Record<string, string>>;

export function mergeStrings(...sets: Strings[]): Strings {
  const out: Strings = {};
  for (const set of sets) {
    for (const [locale, dict] of Object.entries(set)) {
      out[locale] = { ...(out[locale] ?? {}), ...dict };
    }
  }
  return out;
}

export function resolveLocale(available: string[], requested: string): string {
  if (available.includes(requested)) return requested;
  const base = requested.split('-')[0]?.toLowerCase() ?? '';
  const byBase = available.find((l) => l.split('-')[0]?.toLowerCase() === base);
  return byBase ?? 'en';
}

export function createI18n(strings: Strings, locale: string): (key: string) => string {
  const loc = resolveLocale(Object.keys(strings), locale);
  return (key) => strings[loc]?.[key] ?? strings.en?.[key] ?? key;
}
```

`packages/game-kit/src/builtinStrings.ts`:
```ts
import type { Strings } from './i18n.ts';

export const BUILTIN_STRINGS: Strings = {
  en: {
    'gk.loading': 'Loading…',
    'gk.tapToStart': 'Tap to start',
    'gk.score': 'Score',
    'gk.best': 'Best',
    'gk.retry': 'Retry',
    'gk.gameOver': 'Game Over',
  },
  'zh-TW': {
    'gk.loading': '載入中…',
    'gk.tapToStart': '點擊開始',
    'gk.score': '分數',
    'gk.best': '最高分',
    'gk.retry': '再玩一次',
    'gk.gameOver': '遊戲結束',
  },
};
```

Run: `npx vitest run packages/game-kit/src/i18n.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Write failing manifest test**

`packages/game-kit/src/manifest.test.ts`:
```ts
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
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run packages/game-kit/src/manifest.test.ts`
Expected: FAIL — `./manifest.ts` not found.

- [ ] **Step 7: Implement manifest**

`packages/game-kit/src/manifest.ts`:
```ts
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
```

Run: `npx vitest run packages/game-kit/src/manifest.test.ts`
Expected: PASS.

- [ ] **Step 8: Write failing session test**

`packages/game-kit/src/session.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createPlatform, type LocalAdMode } from '../../platform/src/adapters/local.ts';
import { GameSession } from './session.ts';

let n = 0;
const setup = (adMode: LocalAdMode = 'play') => {
  const platform = createPlatform({ adDurationMs: 0, adMode: () => adMode });
  const slug = `test-${++n}`;
  return { platform, slug, session: new GameSession(platform, slug) };
};

describe('GameSession', () => {
  it('starts ready with best 0', async () => {
    const { session } = setup();
    await session.loadBest();
    expect(session.state).toBe('ready');
    expect(session.best).toBe(0);
  });

  it('loads a stored best and ignores garbage', async () => {
    const a = setup();
    await a.platform.storage.set(`${a.slug}:best`, '17');
    await a.session.loadBest();
    expect(a.session.best).toBe(17);
    const b = setup();
    await b.platform.storage.set(`${b.slug}:best`, 'NaN-ish');
    await b.session.loadBest();
    expect(b.session.best).toBe(0);
  });

  it('start() calls gameplayStart once', () => {
    const { platform, session } = setup();
    const spy = vi.spyOn(platform, 'gameplayStart');
    session.start();
    session.start();
    expect(session.state).toBe('playing');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('gameOver() stops gameplay and persists a new best only when higher', async () => {
    const { platform, slug, session } = setup();
    const stop = vi.spyOn(platform, 'gameplayStop');
    session.start();
    expect(await session.gameOver(10)).toBe(true);
    expect(session.state).toBe('over');
    expect(stop).toHaveBeenCalledOnce();
    expect(session.best).toBe(10);
    expect(await platform.storage.get(`${slug}:best`)).toBe('10');
    await session.retry();
    await session.gameOver(5);
    expect(session.best).toBe(10);
    expect(session.lastScore).toBe(5);
  });

  it('gameOver() is ignored unless playing', async () => {
    const { session } = setup();
    expect(await session.gameOver(3)).toBe(false);
    expect(session.state).toBe('ready');
  });

  it('breakpoint() stops gameplay around the interstitial and emits pause changes', async () => {
    const { platform, session } = setup();
    const calls: string[] = [];
    vi.spyOn(platform, 'gameplayStop').mockImplementation(() => calls.push('stop'));
    vi.spyOn(platform, 'gameplayStart').mockImplementation(() => calls.push('start'));
    const paused: boolean[] = [];
    session.onPauseChange((p) => paused.push(p));
    session.start();
    expect(await session.breakpoint()).toBe('shown');
    expect(calls).toEqual(['start', 'stop', 'start']);
    expect(paused).toEqual([true, false]);
    expect(session.paused).toBe(false);
  });

  it('breakpoint() does nothing unless playing', async () => {
    const { platform, session } = setup();
    const ad = vi.spyOn(platform, 'showInterstitial');
    expect(await session.breakpoint()).toBe('unavailable');
    expect(ad).not.toHaveBeenCalled();
  });

  it('retry() from over shows an interstitial then plays', async () => {
    const { platform, session } = setup();
    const ad = vi.spyOn(platform, 'showInterstitial');
    session.start();
    await session.gameOver(1);
    await session.retry();
    expect(ad).toHaveBeenCalledOnce();
    expect(session.state).toBe('playing');
  });

  it('rewarded() returns the ad result and resumes gameplay', async () => {
    const { platform, session } = setup('skipped');
    const start = vi.spyOn(platform, 'gameplayStart');
    session.start();
    expect(await session.rewarded()).toBe('skipped');
    expect(start).toHaveBeenCalledTimes(2);
    expect(session.state).toBe('playing');
  });

  it('a failing ad SDK never breaks the flow', async () => {
    const { session } = setup('throw');
    session.start();
    expect(await session.breakpoint()).toBe('unavailable');
    expect(await session.rewarded()).toBe('unavailable');
    expect(session.state).toBe('playing');
  });
});
```

- [ ] **Step 9: Run to verify failure**

Run: `npx vitest run packages/game-kit/src/session.test.ts`
Expected: FAIL — `./session.ts` not found.

- [ ] **Step 10: Implement GameSession**

`packages/game-kit/src/session.ts`:
```ts
import type { AdResult, Platform } from '@gf/platform';

export type SessionState = 'ready' | 'playing' | 'over';

/** Owns gameplay state, best score and ad orchestration. No Phaser dependency (unit-testable). */
export class GameSession {
  state: SessionState = 'ready';
  lastScore = 0;
  best = 0;
  private readonly platform: Platform;
  private readonly bestKey: string;
  private adPaused = false;
  private readonly listeners: Array<(paused: boolean) => void> = [];

  constructor(platform: Platform, slug: string) {
    this.platform = platform;
    this.bestKey = `${slug}:best`;
    platform.onAdPause(() => this.setAdPaused(true));
    platform.onAdResume(() => this.setAdPaused(false));
  }

  get paused(): boolean {
    return this.adPaused;
  }

  onPauseChange(cb: (paused: boolean) => void): void {
    this.listeners.push(cb);
  }

  async loadBest(): Promise<void> {
    const raw = await this.platform.storage.get(this.bestKey);
    const value = raw === null ? 0 : Number(raw);
    this.best = Number.isFinite(value) && value > 0 ? value : 0;
  }

  start(): void {
    if (this.state === 'playing') return;
    this.state = 'playing';
    this.platform.gameplayStart();
  }

  async gameOver(score: number): Promise<boolean> {
    if (this.state !== 'playing') return false;
    this.state = 'over';
    this.lastScore = score;
    this.platform.gameplayStop();
    if (score > this.best) {
      this.best = score;
      await this.platform.storage.set(this.bestKey, String(score));
    }
    return true;
  }

  /** Natural pause point during play (e.g. between levels). The adapter decides whether an ad runs. */
  async breakpoint(): Promise<AdResult> {
    if (this.state !== 'playing') return 'unavailable';
    this.platform.gameplayStop();
    try {
      return await this.platform.showInterstitial();
    } finally {
      this.platform.gameplayStart();
    }
  }

  async retry(): Promise<void> {
    if (this.state !== 'over') return;
    await this.platform.showInterstitial();
    this.start();
  }

  async rewarded(): Promise<AdResult> {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) this.platform.gameplayStop();
    try {
      return await this.platform.showRewarded();
    } finally {
      if (wasPlaying) this.platform.gameplayStart();
    }
  }

  private setAdPaused(paused: boolean): void {
    if (this.adPaused === paused) return;
    this.adPaused = paused;
    for (const cb of this.listeners) cb(paused);
  }
}
```

- [ ] **Step 11: Run all game-kit tests + typecheck**

Run: `npx vitest run packages/game-kit && npm run typecheck`
Expected: PASS; typecheck exits 0.

- [ ] **Step 12: Commit**

```bash
git add packages/game-kit package-lock.json
git commit -m "feat(game-kit): add i18n, manifest validation and GameSession"
git push origin master
```

---

### Task 4: `@gf/game-kit` Phaser glue, Vite config factory, platform-branch rule

**Files:**
- Create: `packages/game-kit/src/env.d.ts`, `packages/game-kit/src/kit.ts`, `packages/game-kit/src/scenes/{PreloadScene,TitleScene,GameOverScene}.ts`, `packages/game-kit/src/defineGame.ts`, `packages/game-kit/src/index.ts`, `packages/game-kit/vite-config.ts`, `packages/game-kit/src/viteConfig.test.ts`, `scripts/rules.test.ts`

**Interfaces:**
- Consumes: `GameSession`, `createI18n`, `mergeStrings`, `Strings`, `BUILTIN_STRINGS` (Task 3); `createPlatform` via alias `@platform/active` (Task 2).
- Produces (exact):
```ts
// defineGame.ts
export interface GameDefinition {
  manifest: { slug: string; title: Record<string, string> };   // pass the imported game.json
  width: number; height: number;
  playScene: new () => Phaser.Scene;                          // its scene key MUST be 'Play'
  strings?: Strings; backgroundColor?: string;
  preload?: (scene: Phaser.Scene) => void; parent?: string;   // parent default 'game'
}
export function defineGame(def: GameDefinition): Promise<Phaser.Game>;
// kit.ts
export const KIT_KEY = 'gk:kit';
export class Kit { readonly game; readonly session: GameSession; readonly platform: Platform; readonly def: GameDefinition;
  t(key: string): string; start(): void; gameOver(score: number): Promise<void>; breakpoint(): Promise<AdResult>;
  retry(): Promise<void>; showRewarded(): Promise<AdResult>; activeScenes(): string[] }
export function getKit(scene: Phaser.Scene): Kit;
// scene keys: 'GKPreload', 'GKTitle', 'Play' (game), 'GKGameOver'
// local builds expose window.__gk = { state, best, lastScore, activeScenes, endRound(score?) }
// vite-config.ts
export function availablePlatforms(): string[];
export function resolveAdapter(platform: string): string;   // throws on unknown
export function createGameViteConfig(gameDir: string, env?: NodeJS.ProcessEnv): UserConfig;
//   env.PLATFORM (default 'local'), env.GAME_OUT_DIR (default <gameDir>/dist/<platform>)
```

- [ ] **Step 1: Write failing vite-config test**

`packages/game-kit/src/viteConfig.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { availablePlatforms, createGameViteConfig, resolveAdapter } from '../vite-config.ts';

describe('vite-config', () => {
  it('lists implemented adapters', () => {
    expect(availablePlatforms()).toEqual(expect.arrayContaining(['local', 'site']));
    expect(availablePlatforms().some((p) => p.endsWith('.test'))).toBe(false);
  });

  it('throws on unknown or unsafe PLATFORM, listing valid values', () => {
    expect(() => resolveAdapter('poki')).toThrow(/Unknown PLATFORM "poki". Available: .*local/);
    expect(() => resolveAdapter('../types')).toThrow(/Unknown PLATFORM/);
  });

  it('aliases @platform/active and sets test hooks only for local', () => {
    const local = createGameViteConfig('/tmp/g', { PLATFORM: 'local' });
    const site = createGameViteConfig('/tmp/g', { PLATFORM: 'site', GAME_OUT_DIR: '/tmp/out' });
    const alias = (c: typeof local) => (c.resolve?.alias as Record<string, string>)['@platform/active'];
    expect(alias(local)).toMatch(/adapters\/local\.ts$/);
    expect(alias(site)).toMatch(/adapters\/site\.ts$/);
    expect(local.define?.__GK_TEST_HOOKS__).toBe('true');
    expect(site.define?.__GK_TEST_HOOKS__).toBe('false');
    expect(local.build?.outDir).toBe('/tmp/g/dist/local');
    expect(site.build?.outDir).toBe('/tmp/out');
    expect(site.base).toBe('./');
  });

  it('defaults PLATFORM to local', () => {
    expect(createGameViteConfig('/tmp/g', {}).define?.__GK_TEST_HOOKS__).toBe('true');
  });
});
```

Run: `npx vitest run packages/game-kit/src/viteConfig.test.ts`
Expected: FAIL — `../vite-config.ts` not found.

- [ ] **Step 2: Implement vite-config**

`packages/game-kit/vite-config.ts`:
```ts
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const ADAPTERS_DIR = resolve(here, '../platform/src/adapters');

export function availablePlatforms(): string[] {
  return readdirSync(ADAPTERS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => f.slice(0, -3))
    .sort();
}

export function resolveAdapter(platform: string): string {
  const file = resolve(ADAPTERS_DIR, `${platform}.ts`);
  if (!/^[a-z0-9-]+$/.test(platform) || !existsSync(file)) {
    throw new Error(`Unknown PLATFORM "${platform}". Available: ${availablePlatforms().join(', ')}`);
  }
  return file;
}

export function createGameViteConfig(gameDir: string, env: NodeJS.ProcessEnv = process.env): UserConfig {
  const platform = env.PLATFORM ?? 'local';
  const adapter = resolveAdapter(platform);
  return {
    root: gameDir,
    base: './',
    publicDir: resolve(gameDir, 'public'),
    resolve: { alias: { '@platform/active': adapter } },
    define: { __GK_TEST_HOOKS__: JSON.stringify(platform === 'local') },
    build: {
      outDir: env.GAME_OUT_DIR ?? resolve(gameDir, 'dist', platform),
      emptyOutDir: true,
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 2000,
    },
  };
}
```

Run: `npx vitest run packages/game-kit/src/viteConfig.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Write the failing platform-branch rule test**

`scripts/rules.test.ts`:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const SCANNED = ['packages/game-kit/src', 'games', 'templates/game/src'];
const BANNED: RegExp[] = [
  /\bplatform\.id\b/,
  /\bid\s*[!=]==?\s*['"](local|site|crazygames|gamedistribution)['"]/,
  /['"](local|site|crazygames|gamedistribution)['"]\s*[!=]==?\s*\w*\.?id\b/,
];

function tsFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('architecture rules', () => {
  it('game code and game-kit never branch on platform id (use platform.features)', () => {
    const violations: string[] = [];
    for (const dir of SCANNED) {
      for (const file of tsFiles(join(root, dir))) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (BANNED.some((re) => re.test(line))) violations.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(violations).toEqual([]);
  });

  it('the rule itself detects a violation', () => {
    expect(BANNED.some((re) => re.test("if (platform.id === 'crazygames') {"))).toBe(true);
    expect(BANNED.some((re) => re.test("if (p.features.externalLinks) {"))).toBe(false);
  });
});
```

Run: `npx vitest run scripts/rules.test.ts`
Expected: PASS already (no game code yet) — this test is a guard, its self-check proves the regex works.

- [ ] **Step 4: Implement kit, scenes, defineGame, index**

`packages/game-kit/src/env.d.ts`:
```ts
/** true only in PLATFORM=local builds; enables window.__gk test hooks. */
declare const __GK_TEST_HOOKS__: boolean;
```

`packages/game-kit/src/kit.ts`:
```ts
import type Phaser from 'phaser';
import type { AdResult, Platform } from '@gf/platform';
import type { GameDefinition } from './defineGame.ts';
import type { GameSession } from './session.ts';

export const KIT_KEY = 'gk:kit';

/** Facade handed to scenes via getKit(scene). Scene switching lives here; state lives in GameSession. */
export class Kit {
  readonly game: Phaser.Game;
  readonly session: GameSession;
  readonly platform: Platform;
  readonly def: GameDefinition;
  private readonly translate: (key: string) => string;

  constructor(game: Phaser.Game, session: GameSession, platform: Platform, t: (key: string) => string, def: GameDefinition) {
    this.game = game;
    this.session = session;
    this.platform = platform;
    this.translate = t;
    this.def = def;
  }

  t(key: string): string {
    return this.translate(key);
  }

  start(): void {
    this.session.start();
    this.switchTo('Play');
  }

  async gameOver(score: number): Promise<void> {
    if (!(await this.session.gameOver(score))) return;
    this.switchTo('GKGameOver', { score });
  }

  breakpoint(): Promise<AdResult> {
    return this.session.breakpoint();
  }

  async retry(): Promise<void> {
    await this.session.retry();
    this.switchTo('Play');
  }

  showRewarded(): Promise<AdResult> {
    return this.session.rewarded();
  }

  activeScenes(): string[] {
    return this.game.scene.getScenes(true).map((s) => s.scene.key);
  }

  private switchTo(key: string, data?: object): void {
    for (const s of this.game.scene.getScenes(true)) this.game.scene.stop(s.scene.key);
    this.game.scene.start(key, data);
  }
}

export function getKit(scene: Phaser.Scene): Kit {
  const kit = scene.registry.get(KIT_KEY) as Kit | undefined;
  if (!kit) throw new Error('game-kit not initialised: create the game with defineGame()');
  return kit;
}
```

`packages/game-kit/src/scenes/PreloadScene.ts`:
```ts
import Phaser from 'phaser';
import { getKit } from '../kit.ts';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('GKPreload');
  }

  preload(): void {
    const kit = getKit(this);
    const { width, height } = this.scale;
    const barWidth = width * 0.6;
    this.add.text(width / 2, height / 2 - 40, kit.t('gk.loading'), { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.add.rectangle(width / 2, height / 2, barWidth, 12, 0x333333);
    const bar = this.add.rectangle(width / 2 - barWidth / 2, height / 2, 0, 12, 0xfacc15).setOrigin(0, 0.5);
    this.load.on('progress', (ratio: number) => {
      bar.setSize(barWidth * ratio, 12);
      kit.platform.loadingProgress(ratio);
    });
    kit.def.preload?.(this);
  }

  create(): void {
    getKit(this).platform.loadingDone();
    this.scene.start('GKTitle');
  }
}
```

`packages/game-kit/src/scenes/TitleScene.ts`:
```ts
import Phaser from 'phaser';
import { getKit } from '../kit.ts';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('GKTitle');
  }

  create(): void {
    const kit = getKit(this);
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height * 0.35, kit.t('title'), {
        fontSize: '56px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: width * 0.9 },
      })
      .setOrigin(0.5);
    this.add.text(width / 2, height * 0.55, kit.t('gk.tapToStart'), { fontSize: '32px', color: '#facc15' }).setOrigin(0.5);
    if (kit.session.best > 0) {
      this.add
        .text(width / 2, height * 0.63, `${kit.t('gk.best')}: ${kit.session.best}`, { fontSize: '26px', color: '#9ca3af' })
        .setOrigin(0.5);
    }
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      kit.start();
    };
    this.input.once('pointerdown', go);
    this.input.keyboard?.once('keydown', go);
  }
}
```

`packages/game-kit/src/scenes/GameOverScene.ts`:
```ts
import Phaser from 'phaser';
import { getKit } from '../kit.ts';

export class GameOverScene extends Phaser.Scene {
  private score = 0;

  constructor() {
    super('GKGameOver');
  }

  init(data: { score?: number }): void {
    this.score = data.score ?? 0;
  }

  create(): void {
    const kit = getKit(this);
    const { width, height } = this.scale;
    this.add.text(width / 2, height * 0.3, kit.t('gk.gameOver'), { fontSize: '56px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.42, `${kit.t('gk.score')}: ${this.score}`, { fontSize: '36px', color: '#facc15' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.5, `${kit.t('gk.best')}: ${kit.session.best}`, { fontSize: '28px', color: '#9ca3af' }).setOrigin(0.5);
    const button = this.add.rectangle(width / 2, height * 0.65, 280, 80, 0x4ade80).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.65, kit.t('gk.retry'), { fontSize: '32px', color: '#111111' }).setOrigin(0.5);

    let retrying = false;
    const retry = () => {
      if (retrying) return;
      retrying = true;
      void kit.retry();
    };
    // Short delay so the tap that ended the round does not instantly retry.
    this.time.delayedCall(400, () => {
      button.once('pointerdown', retry);
      this.input.keyboard?.once('keydown-ENTER', retry);
      this.input.keyboard?.once('keydown-SPACE', retry);
    });
  }
}
```

`packages/game-kit/src/defineGame.ts`:
```ts
import Phaser from 'phaser';
import { createPlatform } from '@platform/active';
import { BUILTIN_STRINGS } from './builtinStrings.ts';
import { createI18n, mergeStrings, type Strings } from './i18n.ts';
import { KIT_KEY, Kit } from './kit.ts';
import { GameOverScene } from './scenes/GameOverScene.ts';
import { PreloadScene } from './scenes/PreloadScene.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import { GameSession } from './session.ts';

export interface GameDefinition {
  manifest: { slug: string; title: Record<string, string> };
  width: number;
  height: number;
  playScene: new () => Phaser.Scene;
  strings?: Strings;
  backgroundColor?: string;
  preload?: (scene: Phaser.Scene) => void;
  parent?: string;
}

function titleStrings(title: Record<string, string>): Strings {
  const out: Strings = {};
  for (const [locale, text] of Object.entries(title)) out[locale] = { title: text };
  return out;
}

export async function defineGame(def: GameDefinition): Promise<Phaser.Game> {
  const platform = createPlatform();
  await platform.init();
  const t = createI18n(mergeStrings(BUILTIN_STRINGS, titleStrings(def.manifest.title), def.strings ?? {}), platform.locale());
  const session = new GameSession(platform, def.manifest.slug);
  await session.loadBest();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: def.parent ?? 'game',
    width: def.width,
    height: def.height,
    backgroundColor: def.backgroundColor ?? '#111111',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [PreloadScene, TitleScene, def.playScene, GameOverScene],
  });
  const kit = new Kit(game, session, platform, t, def);
  game.registry.set(KIT_KEY, kit);

  // Ads: freeze the loop and mute. Tab hidden: Phaser's built-in auto-pause handles it.
  session.onPauseChange((paused) => {
    game.sound.mute = paused;
    if (paused) game.loop.sleep();
    else game.loop.wake();
  });

  if (__GK_TEST_HOOKS__) {
    (window as unknown as { __gk: unknown }).__gk = {
      get state() { return session.state; },
      get best() { return session.best; },
      get lastScore() { return session.lastScore; },
      get activeScenes() { return kit.activeScenes(); },
      endRound: (score = 0) => kit.gameOver(score),
    };
  }
  return game;
}
```

`packages/game-kit/src/index.ts`:
```ts
export { defineGame, type GameDefinition } from './defineGame.ts';
export { getKit, Kit, KIT_KEY } from './kit.ts';
export { GameSession, type SessionState } from './session.ts';
export { createI18n, mergeStrings, resolveLocale, type Strings } from './i18n.ts';
export type { GameManifest } from './manifest.ts';
```

- [ ] **Step 5: Typecheck + all unit tests**

Run: `npm run typecheck && npm test`
Expected: typecheck exits 0; all tests PASS. (Phaser glue is exercised by the smoke test in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add packages/game-kit scripts/rules.test.ts
git commit -m "feat(game-kit): add Phaser scenes, defineGame, vite config factory and platform-branch rule"
git push origin master
```

---

### Task 5: Game template, `new-game`, build script, static server, smoke test (first game scaffolded)

**Files:**
- Create: `templates/game/{package.json,vite.config.ts,index.html,game.json,public/cover.svg,src/main.ts,src/PlayScene.ts,src/strings.ts}`, `scripts/lib/games.ts`, `scripts/lib/games.test.ts`, `scripts/new-game.ts`, `scripts/new-game.test.ts`, `scripts/build-games.ts`, `scripts/serve-static.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`
- Create (generated): `games/dodge-drop/**`

**Interfaces:**
- Consumes: `defineGame`, `getKit` (Task 4); `validateSlug`, `validateManifest`, `GameManifest` (Task 3); `createGameViteConfig` (Task 4).
- Produces:
```ts
// scripts/lib/games.ts
export const GAMES_DIR: string;
export function loadGames(gamesDir?: string): GameManifest[];   // throws aggregated error on any invalid game
// scripts/new-game.ts
export function titleFromSlug(slug: string): string;
export function scaffoldGame(slug: string, opts: { templateDir: string; gamesDir: string }): string; // returns dest dir
// scripts/build-games.ts
export function buildGames(platform: string, outRoot: string, layout: (slug: string) => string): Promise<GameManifest[]>;
//   local → every game; other platforms → games whose targets include it. CLI: node scripts/build-games.ts <platform>  → dist/<platform>/<slug>/
```

- [ ] **Step 1: Create the template**

`templates/game/package.json`:
```json
{
  "name": "@gf-game/__SLUG__",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@gf/game-kit": "*",
    "phaser": "^3.88.0"
  }
}
```

`templates/game/vite.config.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { createGameViteConfig } from '../../packages/game-kit/vite-config.ts';

export default createGameViteConfig(fileURLToPath(new URL('.', import.meta.url)));
```

`templates/game/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>__TITLE__</title>
    <style>
      html, body { margin: 0; height: 100%; background: #000; overflow: hidden; touch-action: none; }
      #game { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

`templates/game/game.json`:
```json
{
  "slug": "__SLUG__",
  "version": "0.1.0",
  "title": { "en": "__TITLE__", "zh-TW": "__TITLE__" },
  "description": { "en": "Tap the circles before they disappear.", "zh-TW": "在圓圈消失前點擊它們。" },
  "instructions": { "en": "Tap or click each circle. Miss three and the round ends.", "zh-TW": "點擊每個圓圈，漏掉三個就結束。" },
  "tags": ["arcade"],
  "orientation": "portrait",
  "controls": ["mouse", "touch"],
  "cover": "cover.svg",
  "targets": ["site", "crazygames", "gamedistribution"],
  "releases": {}
}
```

`templates/game/public/cover.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#1f2937"/>
  <text x="320" y="195" font-family="system-ui, sans-serif" font-size="44" fill="#facc15" text-anchor="middle">__TITLE__</text>
</svg>
```

`templates/game/src/strings.ts`:
```ts
import type { Strings } from '@gf/game-kit';

/** Game-specific UI text. Kit keys (gk.*) and `title` (from game.json) are already provided. */
export const strings: Strings = {
  en: {},
  'zh-TW': {},
};
```

`templates/game/src/main.ts`:
```ts
import { defineGame } from '@gf/game-kit';
import manifest from '../game.json';
import { PlayScene } from './PlayScene.ts';
import { strings } from './strings.ts';

void defineGame({ manifest, width: 720, height: 1280, strings, playScene: PlayScene });
```

`templates/game/src/PlayScene.ts`:
```ts
import Phaser from 'phaser';
import { getKit } from '@gf/game-kit';

const MAX_MISSES = 3;
const RADIUS = 48;

/** Template mechanic: tap circles before they vanish. Replace with your game. Scene key MUST be 'Play'. */
export class PlayScene extends Phaser.Scene {
  private score = 0;
  private misses = 0;
  private target?: Phaser.GameObjects.Arc;
  private timer?: Phaser.Time.TimerEvent;
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super('Play');
  }

  create(): void {
    this.score = 0;
    this.misses = 0;
    this.hud = this.add.text(24, 24, '', { fontSize: '32px', color: '#ffffff' });
    this.updateHud();
    this.spawn();
  }

  private spawn(): void {
    this.target?.destroy();
    this.timer?.remove();
    const { width, height } = this.scale;
    const x = Phaser.Math.Between(RADIUS, width - RADIUS);
    const y = Phaser.Math.Between(RADIUS + 100, height - RADIUS);
    const target = this.add.circle(x, y, RADIUS, 0xfacc15).setInteractive({ useHandCursor: true });
    target.once('pointerdown', () => {
      this.score += 1;
      this.updateHud();
      this.spawn();
    });
    this.target = target;
    this.timer = this.time.delayedCall(Math.max(450, 1200 - this.score * 25), () => this.miss());
  }

  private miss(): void {
    this.misses += 1;
    this.updateHud();
    if (this.misses >= MAX_MISSES) {
      this.target?.destroy();
      void getKit(this).gameOver(this.score);
      return;
    }
    this.spawn();
  }

  private updateHud(): void {
    const lives = '●'.repeat(MAX_MISSES - this.misses);
    this.hud.setText(`${getKit(this).t('gk.score')}: ${this.score}   ${lives}`);
  }
}
```

- [ ] **Step 2: Write failing tests for loadGames and new-game**

`scripts/lib/games.test.ts`:
```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGames } from './games.ts';

const manifest = (slug: string) => ({
  slug,
  version: '0.1.0',
  title: { en: 'T' },
  description: { en: 'D' },
  instructions: { en: 'I' },
  tags: [],
  orientation: 'any',
  controls: ['mouse'],
  cover: 'cover.svg',
  targets: ['site'],
  releases: {},
});

function gamesDir(entries: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'gf-games-'));
  for (const [name, content] of Object.entries(entries)) {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, 'game.json'), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

describe('loadGames', () => {
  it('loads valid games sorted by directory', () => {
    const dir = gamesDir({ 'b-game': manifest('b-game'), 'a-game': manifest('a-game') });
    expect(loadGames(dir).map((g) => g.slug)).toEqual(['a-game', 'b-game']);
  });

  it('skips directories without game.json and missing games dir', () => {
    const dir = gamesDir({ 'a-game': manifest('a-game') });
    mkdirSync(join(dir, 'not-a-game'));
    expect(loadGames(dir)).toHaveLength(1);
    expect(loadGames(join(dir, 'nope'))).toEqual([]);
  });

  it('aggregates errors: invalid JSON, invalid manifest, slug/dir mismatch', () => {
    const dir = gamesDir({ broken: '{', bad: { ...manifest('bad'), version: 'x' }, wrong: manifest('other') });
    expect(() => loadGames(dir)).toThrow(/bad: version[\s\S]*broken: invalid JSON[\s\S]*wrong: slug "other"/);
  });
});
```

`scripts/new-game.test.ts`:
```ts
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../packages/game-kit/src/manifest.ts';
import { scaffoldGame, titleFromSlug } from './new-game.ts';

const templateDir = fileURLToPath(new URL('../templates/game', import.meta.url));
const freshGamesDir = () => mkdtempSync(join(tmpdir(), 'gf-new-'));

describe('new-game', () => {
  it('titleFromSlug', () => expect(titleFromSlug('dodge-drop')).toBe('Dodge Drop'));

  it('scaffolds a valid game with placeholders replaced', () => {
    const gamesDir = freshGamesDir();
    const dest = scaffoldGame('sky-hop', { templateDir, gamesDir });
    const manifest = JSON.parse(readFileSync(join(dest, 'game.json'), 'utf8'));
    expect(validateManifest(manifest).ok).toBe(true);
    expect(manifest.slug).toBe('sky-hop');
    expect(manifest.title.en).toBe('Sky Hop');
    expect(readFileSync(join(dest, 'package.json'), 'utf8')).toContain('"@gf-game/sky-hop"');
    expect(readFileSync(join(dest, 'public/cover.svg'), 'utf8')).toContain('Sky Hop');
    expect(existsSync(join(dest, 'src/PlayScene.ts'))).toBe(true);
  });

  it('refuses invalid, reserved or existing slugs', () => {
    const gamesDir = freshGamesDir();
    expect(() => scaffoldGame('Bad_Slug', { templateDir, gamesDir })).toThrow(/kebab-case/);
    expect(() => scaffoldGame('pixel-squad', { templateDir, gamesDir })).toThrow(/reserved/);
    scaffoldGame('twice', { templateDir, gamesDir });
    expect(() => scaffoldGame('twice', { templateDir, gamesDir })).toThrow(/already exists/);
  });
});
```

Run: `npx vitest run scripts/lib/games.test.ts scripts/new-game.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement loadGames and new-game**

`scripts/lib/games.ts`:
```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, type GameManifest } from '../../packages/game-kit/src/manifest.ts';

export const GAMES_DIR = fileURLToPath(new URL('../../games', import.meta.url));

export function loadGames(gamesDir: string = GAMES_DIR): GameManifest[] {
  if (!existsSync(gamesDir)) return [];
  const games: GameManifest[] = [];
  const problems: string[] = [];
  for (const dir of readdirSync(gamesDir).sort()) {
    const file = join(gamesDir, dir, 'game.json');
    if (!existsSync(file)) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      problems.push(`${dir}: invalid JSON (${(e as Error).message})`);
      continue;
    }
    const result = validateManifest(raw);
    if (!result.ok) {
      problems.push(...result.errors.map((err) => `${dir}: ${err}`));
      continue;
    }
    if (result.manifest.slug !== dir) {
      problems.push(`${dir}: slug "${result.manifest.slug}" must equal its directory name`);
      continue;
    }
    games.push(result.manifest);
  }
  if (problems.length > 0) throw new Error(`Invalid games:\n${problems.join('\n')}`);
  return games;
}
```

`scripts/new-game.ts`:
```ts
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSlug } from '../packages/game-kit/src/manifest.ts';

const TEXT_FILE = /\.(ts|json|html|svg|md|css)$/;

export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function replaceInTree(dir: string, replacements: Record<string, string>): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      replaceInTree(path, replacements);
      continue;
    }
    if (!TEXT_FILE.test(name)) continue;
    let text = readFileSync(path, 'utf8');
    for (const [from, to] of Object.entries(replacements)) text = text.split(from).join(to);
    writeFileSync(path, text);
  }
}

export function scaffoldGame(slug: string, opts: { templateDir: string; gamesDir: string }): string {
  const err = validateSlug(slug);
  if (err) throw new Error(err);
  const dest = join(opts.gamesDir, slug);
  if (existsSync(dest)) throw new Error(`games/${slug} already exists`);
  cpSync(opts.templateDir, dest, {
    recursive: true,
    filter: (src) => !/[/\\](node_modules|dist)([/\\]|$)/.test(src),
  });
  replaceInTree(dest, { __SLUG__: slug, __TITLE__: titleFromSlug(slug) });
  return dest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npm run new-game -- <slug>');
    process.exit(1);
  }
  try {
    const dest = scaffoldGame(slug, { templateDir: resolve('templates/game'), gamesDir: resolve('games') });
    console.log(`Created ${dest}\nNext: npm install && npm run dev -w @gf-game/${slug}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
```

Run: `npx vitest run scripts/lib/games.test.ts scripts/new-game.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 4: Scaffold the first game and install**

Run: `npm run new-game -- dodge-drop && npm install`
Expected: prints `Created .../games/dodge-drop`; `node_modules/@gf-game/dodge-drop` is a symlink.

- [ ] **Step 5: Implement build-games and serve-static**

`scripts/build-games.ts`:
```ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { GameManifest } from '../packages/game-kit/src/manifest.ts';
import { GAMES_DIR, loadGames } from './lib/games.ts';

export async function buildGames(
  platform: string,
  outRoot: string,
  layout: (slug: string) => string,
): Promise<GameManifest[]> {
  const games = loadGames().filter((g) => platform === 'local' || (g.targets as string[]).includes(platform));
  for (const game of games) {
    process.env.PLATFORM = platform;
    process.env.GAME_OUT_DIR = resolve(outRoot, layout(game.slug));
    console.log(`[build] ${game.slug} (${platform}) → ${process.env.GAME_OUT_DIR}`);
    await build({ configFile: resolve(GAMES_DIR, game.slug, 'vite.config.ts'), logLevel: 'warn' });
  }
  return games;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const platform = process.argv[2] ?? 'local';
  const games = await buildGames(platform, resolve('dist', platform), (slug) => slug);
  console.log(`[build] ${games.length} game(s) built for ${platform}`);
}
```

`scripts/serve-static.ts`:
```ts
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

const root = resolve(process.argv[2] ?? 'dist/local');
const port = Number(process.argv[3] ?? 5180);

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    let file = normalize(join(root, urlPath));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
```

Run: `npm run build:local`
Expected: `[build] dodge-drop (local) → .../dist/local/dodge-drop` and `[build] 1 game(s) built for local`; `dist/local/dodge-drop/index.html` exists and contains no `/src/main.ts` reference.

- [ ] **Step 6: Write the smoke test**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  webServer: {
    command: 'node scripts/serve-static.ts dist/local 5180',
    port: 5180,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5180' },
});
```

`e2e/smoke.spec.ts`:
```ts
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

type GkHooks = { state: string; best: number; activeScenes: string[]; endRound(score?: number): Promise<void> };
declare global {
  interface Window {
    __gk?: GkHooks;
  }
}

const slugs = readdirSync('games')
  .filter((d) => existsSync(join('games', d, 'game.json')))
  .sort();

for (const slug of slugs) {
  test(`${slug}: boots, plays, reaches game over without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });

    await page.goto(`/${slug}/`);
    await page.waitForFunction(() => window.__gk?.activeScenes.includes('GKTitle') === true);

    const box = await page.locator('canvas').boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box!;
    await page.mouse.click(x + width / 2, y + height / 2);
    await page.waitForFunction(() => window.__gk?.state === 'playing');

    const keys = ['ArrowLeft', 'ArrowRight', 'Space'];
    for (let i = 0; i < 15; i++) {
      await page.mouse.click(x + ((i * 37) % 100) / 100 * width, y + ((i * 53) % 100) / 100 * height);
      await page.keyboard.press(keys[i % keys.length]!);
      await page.waitForTimeout(150);
    }

    await page.evaluate(async () => {
      if (window.__gk?.state === 'playing') await window.__gk.endRound(7);
    });
    await page.waitForFunction(
      () => window.__gk?.state === 'over' && window.__gk.activeScenes.includes('GKGameOver'),
    );
    expect(await page.evaluate(() => window.__gk?.best ?? -1)).toBeGreaterThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
```

- [ ] **Step 7: Run the smoke test**

Run: `npx playwright install chromium && npm run test:smoke`
Expected: `1 passed` (`dodge-drop: boots, plays, reaches game over without errors`).

- [ ] **Step 8: Typecheck, unit tests, commit**

Run: `npm run typecheck && npm test`
Expected: both exit 0.

```bash
git add templates scripts/lib scripts/new-game.ts scripts/new-game.test.ts scripts/build-games.ts scripts/serve-static.ts playwright.config.ts e2e games/dodge-drop package-lock.json
git commit -m "feat(game-platform): add game template, new-game, build and smoke test; scaffold dodge-drop"
git push origin master
```

---

### Task 6: `dodge-drop` gameplay

**Files:**
- Create: `games/dodge-drop/src/difficulty.ts`, `games/dodge-drop/src/difficulty.test.ts`
- Modify: `games/dodge-drop/src/PlayScene.ts` (replace whole file), `games/dodge-drop/game.json`, `games/dodge-drop/public/cover.svg`

**Interfaces:**
- Consumes: `getKit(scene).gameOver(score)`, `getKit(scene).t('gk.score')`.
- Produces: `spawnInterval(elapsedSec: number): number`, `fallSpeed(elapsedSec: number): number`, `PLAYER_SPEED: number`.

- [ ] **Step 1: Write failing difficulty test**

`games/dodge-drop/src/difficulty.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fallSpeed, spawnInterval } from './difficulty.ts';

describe('dodge-drop difficulty', () => {
  it('spawn interval starts at 0.9s and floors at 0.25s', () => {
    expect(spawnInterval(0)).toBeCloseTo(0.9);
    expect(spawnInterval(10)).toBeCloseTo(0.7);
    expect(spawnInterval(100)).toBe(0.25);
  });

  it('fall speed starts at 260px/s and caps at 900px/s', () => {
    expect(fallSpeed(0)).toBe(260);
    expect(fallSpeed(10)).toBe(380);
    expect(fallSpeed(60)).toBe(900);
  });
});
```

Run: `npx vitest run games/dodge-drop`
Expected: FAIL — `./difficulty.ts` not found.

- [ ] **Step 2: Implement difficulty**

`games/dodge-drop/src/difficulty.ts`:
```ts
export const PLAYER_SPEED = 520; // px/s for keyboard movement

export function spawnInterval(elapsedSec: number): number {
  return Math.max(0.25, 0.9 - elapsedSec * 0.02);
}

export function fallSpeed(elapsedSec: number): number {
  return Math.min(900, 260 + elapsedSec * 12);
}
```

Run: `npx vitest run games/dodge-drop`
Expected: PASS (2 tests).

- [ ] **Step 3: Replace PlayScene with the dodge mechanic**

`games/dodge-drop/src/PlayScene.ts`:
```ts
import Phaser from 'phaser';
import { getKit } from '@gf/game-kit';
import { fallSpeed, PLAYER_SPEED, spawnInterval } from './difficulty.ts';

const PLAYER_W = 90;
const PLAYER_H = 28;

export class PlayScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private blocks: Phaser.GameObjects.Rectangle[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private hud!: Phaser.GameObjects.Text;
  private elapsed = 0;
  private spawnIn = 0;
  private dodged = 0;
  private over = false;

  constructor() {
    super('Play');
  }

  create(): void {
    const { width, height } = this.scale;
    this.blocks = [];
    this.elapsed = 0;
    this.spawnIn = 0;
    this.dodged = 0;
    this.over = false;
    this.player = this.add.rectangle(width / 2, height - 80, PLAYER_W, PLAYER_H, 0x4ade80);
    this.hud = this.add.text(24, 24, '', { fontSize: '32px', color: '#ffffff' });
    this.cursors = this.input.keyboard?.createCursorKeys();
    const follow = (p: Phaser.Input.Pointer) => this.movePlayerTo(p.x);
    this.input.on('pointerdown', follow);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) follow(p);
    });
  }

  update(_time: number, deltaMs: number): void {
    if (this.over) return;
    const dt = deltaMs / 1000;
    const { width, height } = this.scale;
    this.elapsed += dt;

    if (this.cursors?.left.isDown) this.movePlayerTo(this.player.x - PLAYER_SPEED * dt);
    if (this.cursors?.right.isDown) this.movePlayerTo(this.player.x + PLAYER_SPEED * dt);

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      const w = Phaser.Math.Between(60, 160);
      this.blocks.push(this.add.rectangle(Phaser.Math.Between(w / 2, width - w / 2), -30, w, 40, 0xf87171));
      this.spawnIn = spawnInterval(this.elapsed);
    }

    const speed = fallSpeed(this.elapsed);
    const playerBounds = this.player.getBounds();
    for (const block of [...this.blocks]) {
      block.y += speed * dt;
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, block.getBounds())) {
        this.over = true;
        void getKit(this).gameOver(this.dodged);
        return;
      }
      if (block.y - block.height / 2 > height) {
        block.destroy();
        this.blocks.splice(this.blocks.indexOf(block), 1);
        this.dodged += 1;
      }
    }
    this.hud.setText(`${getKit(this).t('gk.score')}: ${this.dodged}`);
  }

  private movePlayerTo(x: number): void {
    this.player.x = Phaser.Math.Clamp(x, PLAYER_W / 2, this.scale.width - PLAYER_W / 2);
  }
}
```

- [ ] **Step 4: Update game.json and cover**

`games/dodge-drop/game.json`:
```json
{
  "slug": "dodge-drop",
  "version": "0.1.0",
  "title": { "en": "Dodge Drop", "zh-TW": "閃避落塊" },
  "description": { "en": "Blocks rain from the sky. Slide left and right to survive as long as you can.", "zh-TW": "方塊從天而降，左右閃避，撐得越久越好。" },
  "instructions": { "en": "Drag or tap to move. Arrow keys work too. Every block you dodge scores a point; one hit ends the round.", "zh-TW": "拖曳或點擊移動，也可以用方向鍵。每閃過一個方塊得 1 分，被打中就結束。" },
  "tags": ["arcade", "reflex"],
  "orientation": "portrait",
  "controls": ["mouse", "touch", "keyboard"],
  "cover": "cover.svg",
  "targets": ["site", "crazygames", "gamedistribution"],
  "releases": {}
}
```

`games/dodge-drop/public/cover.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#111827"/>
  <rect x="120" y="60" width="110" height="34" fill="#f87171"/>
  <rect x="380" y="120" width="140" height="34" fill="#f87171"/>
  <rect x="250" y="20" width="80" height="34" fill="#f87171"/>
  <rect x="270" y="290" width="100" height="30" fill="#4ade80"/>
  <text x="320" y="230" font-family="system-ui, sans-serif" font-size="48" font-weight="700" fill="#ffffff" text-anchor="middle">Dodge Drop</text>
</svg>
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test && npm run test:smoke`
Expected: all pass; smoke `1 passed`.

Manual check: `npm run dev -w @gf-game/dodge-drop`, open the printed URL, play one round (title → play → hit → Game Over → Retry works).

- [ ] **Step 6: Commit**

```bash
git add games/dodge-drop
git commit -m "feat(dodge-drop): implement dodge gameplay with difficulty ramp"
git push origin master
```

---

### Task 7: Static site renderer and `build:site`

**Files:**
- Create: `site/src/render.ts`, `site/src/render.test.ts`, `site/legacy-games.json`, `site/static/site.css`, `scripts/build-site.ts`

**Interfaces:**
- Consumes: `GameManifest` (Task 3), `buildGames` (Task 5).
- Produces:
```ts
export interface LegacyGame { href: string; icon: string; title: Record<string, string>; description: Record<string, string> }
export interface RenderOptions { siteUrl: string; siteName: string }   // siteUrl ends with '/'
export function escapeHtml(s: string): string;
export function renderLobby(games: GameManifest[], legacy: LegacyGame[], opts: RenderOptions): string;  // → dist/site/index.html
export function renderGamePage(game: GameManifest, opts: RenderOptions): string;                        // → dist/site/<slug>/index.html
// dist/site layout: index.html, static/site.css, <slug>/index.html (wrapper), <slug>/game/ (game build)
```

- [ ] **Step 1: Write failing render tests**

`site/src/render.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../../packages/game-kit/src/manifest.ts';
import { escapeHtml, renderGamePage, renderLobby, type LegacyGame } from './render.ts';

const game = (over: Partial<GameManifest> = {}): GameManifest => ({
  slug: 'dodge-drop',
  version: '0.1.0',
  title: { en: 'Dodge Drop', 'zh-TW': '閃避落塊' },
  description: { en: 'Dodge <blocks> & win' },
  instructions: { en: 'Move left and right.' },
  tags: ['arcade', 'reflex'],
  orientation: 'portrait',
  controls: ['mouse'],
  cover: 'cover.svg',
  targets: ['site'],
  releases: {},
  ...over,
});
const legacy: LegacyGame[] = [
  { href: './merge10/', icon: '🔢', title: { en: 'Math Merge 10' }, description: { en: 'Make 10' } },
];
const opts = { siteUrl: 'https://example.test/root/', siteName: 'Game Kyo' };

describe('escapeHtml', () => {
  it('escapes the five special characters', () => expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'));
});

describe('renderLobby', () => {
  const html = renderLobby([game()], legacy, opts);
  it('links each game with a relative URL and cover', () => {
    expect(html).toContain('href="./dodge-drop/"');
    expect(html).toContain('src="./dodge-drop/game/cover.svg"');
    expect(html).toContain('data-slug="dodge-drop"');
    expect(html).toContain('data-tags="arcade reflex"');
  });
  it('renders both languages, falling back to en', () => {
    expect(html).toContain('<span lang="zh-TW" data-l="zh-TW">閃避落塊</span>');
    expect(html).toContain('<span lang="zh-TW" data-l="zh-TW">Dodge &lt;blocks&gt; &amp; win</span>');
  });
  it('escapes manifest text', () => expect(html).not.toContain('<blocks>'));
  it('includes legacy cards and tag filters', () => {
    expect(html).toContain('href="./merge10/"');
    expect(html).toContain('data-filter="arcade"');
    expect(html).toContain('data-filter="reflex"');
  });
  it('sets canonical to siteUrl and never hard-codes /game_kyo/', () => {
    expect(html).toContain('<link rel="canonical" href="https://example.test/root/">');
    expect(html).not.toContain('/game_kyo/');
  });
});

describe('renderGamePage', () => {
  const html = renderGamePage(game(), opts);
  it('embeds the game build in an iframe', () => expect(html).toContain('src="./game/index.html"'));
  it('uses an orientation class for the frame', () => expect(html).toContain('class="frame portrait"'));
  it('links back to the lobby and the shared stylesheet', () => {
    expect(html).toContain('href="../"');
    expect(html).toContain('href="../static/site.css"');
  });
  it('has SEO title, description and canonical', () => {
    expect(html).toContain('<title>Dodge Drop · Game Kyo</title>');
    expect(html).toContain('<meta name="description" content="Dodge &lt;blocks&gt; &amp; win">');
    expect(html).toContain('<link rel="canonical" href="https://example.test/root/dodge-drop/">');
  });
  it('shows instructions', () => expect(html).toContain('Move left and right.'));
});
```

Run: `npx vitest run site`
Expected: FAIL — `./render.ts` not found.

- [ ] **Step 2: Implement the renderer**

`site/src/render.ts`:
```ts
import type { GameManifest } from '../../packages/game-kit/src/manifest.ts';

export interface LegacyGame {
  href: string;
  icon: string;
  title: Record<string, string>;
  description: Record<string, string>;
}

export interface RenderOptions {
  siteUrl: string;
  siteName: string;
}

const LANGS = ['en', 'zh-TW'] as const;

const UI: Record<string, Record<string, string>> = {
  tagline: { en: 'Free mini games — play instantly in your browser', 'zh-TW': '免費小遊戲，打開瀏覽器就能玩' },
  all: { en: 'All', 'zh-TW': '全部' },
  best: { en: 'Best', 'zh-TW': '最高分' },
  howTo: { en: 'How to play', 'zh-TW': '玩法' },
  back: { en: '← All games', 'zh-TW': '← 所有遊戲' },
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

function pick(map: Record<string, string>, lang: string): string {
  return map[lang] ?? map.en ?? '';
}

function bilingual(map: Record<string, string>): string {
  return LANGS.map((l) => `<span lang="${l}" data-l="${l}">${escapeHtml(pick(map, l))}</span>`).join('');
}

const LANG_BOOT =
  "(function(){var l;try{l=localStorage.getItem('gk:lang')}catch(e){}" +
  "if(l!=='en'&&l!=='zh-TW'){l=/^zh/i.test(navigator.language)?'zh-TW':'en'}" +
  'document.documentElement.setAttribute(\'data-lang\',l);document.documentElement.lang=l;})();';

const LANG_TOGGLE =
  "document.querySelectorAll('[data-set-lang]').forEach(function(b){b.addEventListener('click',function(){" +
  "var l=b.getAttribute('data-set-lang');document.documentElement.setAttribute('data-lang',l);document.documentElement.lang=l;" +
  "try{localStorage.setItem('gk:lang',l)}catch(e){}});});";

const LOBBY_SCRIPT =
  "document.querySelectorAll('[data-filter]').forEach(function(b){b.addEventListener('click',function(){" +
  "var t=b.getAttribute('data-filter');document.querySelectorAll('.card').forEach(function(c){" +
  "var tags=(c.getAttribute('data-tags')||'').split(' ');c.hidden=t!=='*'&&tags.indexOf(t)<0;});});});" +
  "document.querySelectorAll('[data-slug]').forEach(function(c){var v=null;" +
  "try{v=localStorage.getItem('gk:'+c.getAttribute('data-slug')+':best')}catch(e){}" +
  "if(v){var el=c.querySelector('.best');el.hidden=false;el.querySelector('b').textContent=v;}});";

function shell(o: { title: string; description: string; canonical: string; root: string; body: string; script?: string }): string {
  return `<!doctype html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description)}">
<link rel="canonical" href="${escapeHtml(o.canonical)}">
<link rel="stylesheet" href="${o.root}static/site.css">
<script>${LANG_BOOT}</script>
</head>
<body>
<div class="lang-switch"><button data-set-lang="en">EN</button><button data-set-lang="zh-TW">繁中</button></div>
${o.body}
<script>${LANG_TOGGLE}${o.script ?? ''}</script>
</body>
</html>
`;
}

function gameCard(g: GameManifest): string {
  return `<a class="card" href="./${g.slug}/" data-slug="${g.slug}" data-tags="${escapeHtml(g.tags.join(' '))}">
<img src="./${g.slug}/game/${escapeHtml(g.cover)}" alt="" loading="lazy" width="320" height="180">
<h2>${bilingual(g.title)}</h2>
<p>${bilingual(g.description)}</p>
<p class="best" hidden>${bilingual(UI.best!)}: <b></b></p>
</a>`;
}

function legacyCard(g: LegacyGame): string {
  return `<a class="card legacy" href="${escapeHtml(g.href)}" data-tags="">
<div class="icon">${escapeHtml(g.icon)}</div>
<h2>${bilingual(g.title)}</h2>
<p>${bilingual(g.description)}</p>
</a>`;
}

export function renderLobby(games: GameManifest[], legacy: LegacyGame[], opts: RenderOptions): string {
  const tags = [...new Set(games.flatMap((g) => g.tags))].sort();
  const filters = [`<button data-filter="*">${bilingual(UI.all!)}</button>`]
    .concat(tags.map((t) => `<button data-filter="${escapeHtml(t)}">${escapeHtml(t)}</button>`))
    .join('');
  const body = `<header><h1>${escapeHtml(opts.siteName)}</h1><p class="tagline">${bilingual(UI.tagline!)}</p></header>
<nav class="filters">${filters}</nav>
<main class="grid">
${games.map(gameCard).join('\n')}
${legacy.map(legacyCard).join('\n')}
</main>`;
  return shell({
    title: opts.siteName,
    description: pick(UI.tagline!, 'en'),
    canonical: opts.siteUrl,
    root: './',
    body,
    script: LOBBY_SCRIPT,
  });
}

export function renderGamePage(game: GameManifest, opts: RenderOptions): string {
  const body = `<header class="game-header"><a class="back" href="../">${bilingual(UI.back!)}</a><h1>${bilingual(game.title)}</h1></header>
<div class="frame ${game.orientation}"><iframe src="./game/index.html" title="${escapeHtml(game.title.en)}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>
<section class="about"><p>${bilingual(game.description)}</p><h2>${bilingual(UI.howTo!)}</h2><p>${bilingual(game.instructions)}</p></section>`;
  return shell({
    title: `${game.title.en} · ${opts.siteName}`,
    description: game.description.en,
    canonical: `${opts.siteUrl}${game.slug}/`,
    root: '../',
    body,
  });
}
```

Run: `npx vitest run site`
Expected: PASS (11 tests).

- [ ] **Step 3: Legacy cards and stylesheet**

`site/legacy-games.json`:
```json
[
  { "href": "./merge10/", "icon": "🔢", "title": { "en": "Math Merge 10" }, "description": { "en": "Slide tiles so numbers add up to 10.", "zh-TW": "滑動格子，讓數字相加為 10 來消除" } },
  { "href": "./merge10x/", "icon": "✖️", "title": { "en": "Math Merge 10X" }, "description": { "en": "Clear 2, 3 or 4 tiles that sum to 10 on a 4×4 or 5×5 board.", "zh-TW": "2·3·4 個格子加總 = 10 即消除，可選 4×4 或 5×5 盤面" } },
  { "href": "./pixel-squad/", "icon": "⚔️", "title": { "en": "Pixel Squad" }, "description": { "en": "Turn-based wasteland RPG: build a squad and take on enemy stages.", "zh-TW": "末日廢土回合制 RPG，組建小隊挑戰敵方關卡" } }
]
```

`site/static/site.css`:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg: #111; --card: #1f2937; --text: #e5e7eb; --muted: #9ca3af; --accent: #facc15; }
body { min-height: 100vh; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; padding: 32px 16px 64px; }
[data-l] { display: none; }
html[data-lang="en"] [data-l="en"], html[data-lang="zh-TW"] [data-l="zh-TW"] { display: revert; }
.lang-switch { position: absolute; top: 12px; right: 16px; display: flex; gap: 6px; }
button { background: var(--card); color: var(--text); border: 1px solid #374151; border-radius: 6px; padding: 4px 10px; cursor: pointer; font: inherit; }
header { text-align: center; margin-bottom: 24px; }
h1 { font-size: 2rem; }
.tagline { color: var(--muted); margin-top: 6px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
.card { display: block; background: var(--card); border-radius: 12px; overflow: hidden; color: inherit; text-decoration: none; transition: transform .15s; }
.card:hover { transform: translateY(-3px); }
.card[hidden] { display: none; }
.card img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: #000; }
.card .icon { font-size: 3rem; text-align: center; padding: 28px 0 8px; }
.card h2 { font-size: 1.1rem; padding: 12px 14px 4px; }
.card p { font-size: .9rem; color: var(--muted); padding: 0 14px 12px; }
.card .best { color: var(--accent); }
.game-header { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.back { color: var(--muted); text-decoration: none; align-self: flex-start; }
.frame { margin: 0 auto; max-width: 100%; background: #000; border-radius: 12px; overflow: hidden; }
.frame iframe { width: 100%; height: 100%; border: 0; display: block; }
.frame.portrait { aspect-ratio: 9 / 16; height: min(80vh, 900px); }
.frame.landscape { aspect-ratio: 16 / 9; width: min(100%, 1100px); }
.frame.any { aspect-ratio: 4 / 3; width: min(100%, 900px); }
.about { max-width: 720px; margin: 24px auto 0; line-height: 1.6; }
.about h2 { font-size: 1.1rem; margin: 16px 0 4px; }
```

- [ ] **Step 4: Implement build-site**

`scripts/build-site.ts`:
```ts
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderGamePage, renderLobby, type LegacyGame } from '../site/src/render.ts';
import { buildGames } from './build-games.ts';

const out = resolve('dist/site');
const siteUrl = process.env.SITE_URL ?? 'https://kyoangel.github.io/game_kyo/';
const opts = { siteUrl: siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`, siteName: 'Game Kyo' };

rmSync(out, { recursive: true, force: true });
const games = await buildGames('site', out, (slug) => `${slug}/game`);
const legacy = JSON.parse(readFileSync('site/legacy-games.json', 'utf8')) as LegacyGame[];

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), renderLobby(games, legacy, opts));
for (const game of games) writeFileSync(join(out, game.slug, 'index.html'), renderGamePage(game, opts));
cpSync('site/static', join(out, 'static'), { recursive: true });
console.log(`[site] ${games.length} game(s) + ${legacy.length} legacy card(s) → ${out}`);
```

- [ ] **Step 5: Build and inspect the site locally**

Run: `npm run build:site && ls dist/site dist/site/dodge-drop`
Expected: `[site] 1 game(s) + 3 legacy card(s) → .../dist/site`; `dist/site` has `index.html static dodge-drop`; `dist/site/dodge-drop` has `index.html game`.

Run: `node scripts/serve-static.ts dist/site 5181` (background), open `http://localhost:5181/`, click Dodge Drop, play a round, return to lobby → card shows "Best". Toggle EN/繁中. Legacy cards 404 locally (expected — they exist only on gh-pages). Stop the server.

- [ ] **Step 6: Typecheck, tests, commit**

Run: `npm run typecheck && npm test`
Expected: both exit 0.

```bash
git add site scripts/build-site.ts
git commit -m "feat(site): generate static lobby and per-game pages from game.json"
git push origin master
```

---

### Task 8: CI — build, test and deploy the site; retire `hub/`

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Delete: `hub/index.html` (the generated lobby replaces it at the gh-pages root)

**Interfaces:**
- Consumes: root scripts `typecheck`, `test`, `test:smoke`, `build:site` (Tasks 1–7); artifact path `dist/site`.

- [ ] **Step 1: Replace the `hub` path filter with a `platform` filter**

In `.github/workflows/deploy.yml`, in `jobs.changes.outputs` replace
```yaml
      hub: ${{ steps.filter.outputs.hub }}
```
with
```yaml
      platform: ${{ steps.filter.outputs.platform }}
```
and in the `dorny/paths-filter` `filters` block replace
```yaml
            hub:
              - 'hub/**'
```
with
```yaml
            platform:
              - 'packages/**'
              - 'games/**'
              - 'site/**'
              - 'scripts/**'
              - 'templates/**'
              - 'e2e/**'
              - 'package.json'
              - 'package-lock.json'
              - 'tsconfig*.json'
              - 'vitest.config.ts'
              - 'playwright.config.ts'
```

- [ ] **Step 2: Add the `build-platform` job (insert before `deploy:`)**

```yaml
  build-platform:
    needs: changes
    if: needs.changes.outputs.platform == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:smoke
      - run: npm run build:site
      - uses: actions/upload-artifact@v4
        with:
          name: dist-site
          path: dist/site
```

- [ ] **Step 3: Wire it into `deploy`**

Replace the `deploy` job header (`needs:` and `if:`) with:
```yaml
  deploy:
    needs: [changes, build-merge10, build-merge10x, build-pixel-squad, build-platform]
    if: |
      always() && !failure() && !cancelled() &&
      (
        needs.build-merge10.result == 'success' ||
        needs.build-merge10x.result == 'success' ||
        needs.build-pixel-squad.result == 'success' ||
        needs.build-platform.result == 'success'
      )
```
Replace the final `Deploy hub` step with:
```yaml
      - uses: actions/download-artifact@v4
        if: needs.build-platform.result == 'success'
        with:
          name: dist-site
          path: dist/site
      - name: Deploy site (lobby + new games)
        if: needs.build-platform.result == 'success'
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist/site
          target-folder: .
          branch: gh-pages
          clean: false
```
(`clean: false` keeps `merge10/`, `merge10x/`, `pixel-squad/` on gh-pages; reserved slugs guarantee no new game overwrites them.)

- [ ] **Step 4: Remove hub and validate the workflow file**

Run: `git rm hub/index.html && grep -n "hub" .github/workflows/deploy.yml; python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml ok')"`
Expected: grep prints nothing; `yaml ok`.

- [ ] **Step 5: Full local verification (same commands as CI)**

Run: `npm ci && npm run typecheck && npm test && npm run test:smoke && npm run build:site`
Expected: every command exits 0.

- [ ] **Step 6: Commit, push, verify the deploy**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build, test and deploy generated site; retire hub"
git push origin master
```

Run: `gh run watch --exit-status $(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')`
Expected: run succeeds; jobs `build-platform` and `deploy` green, legacy build jobs skipped.

Run: `curl -sf https://kyoangel.github.io/game_kyo/ | grep -c 'dodge-drop' && curl -sf -o /dev/null -w '%{http_code}\n' https://kyoangel.github.io/game_kyo/dodge-drop/game/index.html && curl -sf -o /dev/null -w '%{http_code}\n' https://kyoangel.github.io/game_kyo/pixel-squad/`
Expected: a count ≥ 1, then `200`, then `200` (legacy game still served). GitHub Pages can take ~1 minute to refresh after the deploy job.

---

## Out of scope for this plan (P2+)

- `crazygames` / `gamedistribution` adapters (they must pass `runPlatformContract`).
- Build-artifact checks: no non-allowlisted external URLs, no foreign SDKs, zip ≤ 10 MB.
- Per-target zips attached to a GitHub Release; `npm run release-status`; `docs/specs/game-platform/checklists/<platform>.md`; first submission.
- Phase 2 domain + AdSense (`site` adapter ads, `ads.txt`, `SITE_URL`).
