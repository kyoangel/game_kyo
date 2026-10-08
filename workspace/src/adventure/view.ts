/**
 * The adventure screen (spec 9.3 `view.ts`): wires the pure run/battle layer
 * to the DOM and to the shared `BoardRenderer`. All rules live in run.ts and
 * battle.ts; this file only turns clicks/swipes into `runTurn` / `runCast` /
 * `chooseOffer` calls and plays the returned events back (animation, popups,
 * sound, log lines). Element ids come from index.html.
 *
 * Animation: the rules resolve a whole turn at once. For a slide with
 * eliminations and nothing frozen the endless-mode two-phase animation plays
 * and the spawned tile is held back until it ends; otherwise (no pairs, or
 * frozen walls the animation does not model) the simple slide animation plays.
 */
import type { AudioEngine } from "../audio";
import { BoardRenderer, canAnimateElimination } from "../boardRenderer";
import type { Direction, GameGrid, Rng } from "../grid";
import { changedCells, type CellPosition } from "../gridDiff";
import { PALETTE_ORDER, isPaletteId, type PaletteId } from "../palettes";
import { SPELL_IDS, SPELLS, currentIntent, spellCost, type BattleEvent, type BattleState, type SpellId } from "./battle";
import { getEnemy } from "./enemies";
import { drawEnemyArt } from "./enemyArt";
import { getRelic, mergeRelicHooks } from "./relics";
import { chooseOffer, createRun, runCast, runTurn, type RunState, type RunStep } from "./run";
import { saveRun } from "./save";
import type { KeyValueStore } from "./storage";
import {
  ADVENTURE_TROPHIES,
  checkAdventureTrophies,
  getAdventureTrophy,
  loadAdventureTrophies,
  unlockedRelicIds,
  type AdventureTrophyEvent,
} from "./unlocks";
import {
  KEY_TO_DIRECTION,
  SPELL_HELP,
  boardPixelSize,
  damageTotal,
  heroDamageTotal,
  intentView,
  enemyActionCue,
  logLines,
  STUCK_BANNER_TEXT,
  stuckSpells,
  offerTitle,
  offerView,
  progressPips,
  resultView,
  stageLabel,
  stuckHint,
  swipeDirection,
} from "./viewModel";

const GRID_SIZE = 4;
const PALETTE_KEY = "mathMerge10Palette";

export interface AdventureViewDeps {
  store: KeyValueStore;
  rng: Rng;
  audio: AudioEngine;
  /** Called by the 🏠 button and the result screen. */
  goHome: () => void;
  /** Dev builds only: expose `window.__adv` for the e2e tests. */
  devHooks: boolean;
}

export interface AdventureView {
  /** Begin a fresh run (shows the opening relic pick). */
  startNew(): void;
  /** Continue a run loaded from the save. */
  resume(run: RunState): void;
  /** Hide the screen and stop reacting to input. */
  hide(): void;
  /** Open the adventure-trophy list. */
  openTrophies(): void;
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function emptyGrid(): GameGrid {
  return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));
}

export function createAdventureView(deps: AdventureViewDeps): AdventureView {
  const { store, rng, audio } = deps;

  const screenEl = el<HTMLDivElement>("adv-screen");
  const boardCanvas = el<HTMLCanvasElement>("adv-board");
  const enemyCanvas = el<HTMLCanvasElement>("adv-enemy");
  const stageEl = el<HTMLDivElement>("adv-stage");
  const progressEl = el<HTMLDivElement>("adv-progress");
  const enemyNameEl = el<HTMLDivElement>("adv-enemy-name");
  const hpFillEl = el<HTMLDivElement>("adv-enemy-hpfill");
  const hpTextEl = el<HTMLSpanElement>("adv-enemy-hptext");
  const shieldEl = el<HTMLSpanElement>("adv-enemy-shield");
  const intentEl = el<HTMLDivElement>("adv-intent");
  const enemyPopEl = el<HTMLDivElement>("adv-enemy-pop");
  const heroPopEl = el<HTMLDivElement>("adv-hero-pop");
  const hpEl = el<HTMLSpanElement>("adv-hp");
  const manaEl = el<HTMLSpanElement>("adv-mana");
  const flashEl = el<HTMLDivElement>("adv-board-flash");
  const spellsEl = el<HTMLDivElement>("adv-spells");
  const relicsEl = el<HTMLDivElement>("adv-relics");
  const relicInfoEl = el<HTMLDivElement>("adv-relic-info");
  const logEl = el<HTMLDivElement>("adv-log");
  const cueEl = el<HTMLDivElement>("adv-cue");
  const stuckEl = el<HTMLDivElement>("adv-stuck");
  const cueCellsEl = el<HTMLDivElement>("adv-cue-cells");
  const toastEl = el<HTMLDivElement>("adv-toast");
  const offersEl = el<HTMLDivElement>("adv-offers");
  const offersTitleEl = el<HTMLHeadingElement>("adv-offers-title");
  const offersListEl = el<HTMLDivElement>("adv-offers-list");
  const resultEl = el<HTMLDivElement>("adv-result");
  const resultTitleEl = el<HTMLHeadingElement>("adv-result-title");
  const resultLinesEl = el<HTMLDivElement>("adv-result-lines");
  const trophyModalEl = el<HTMLDivElement>("adv-trophy-modal");
  const trophyListEl = el<HTMLUListElement>("adv-trophy-list");
  const muteEl = el<HTMLButtonElement>("adv-mute");

  let run: RunState | null = null;
  let active = false;
  let activeSpell: SpellId | null = null;
  let hiddenCells = new Set<string>();
  let pendingSpawn: CellPosition[] = [];
  let frameId: number | null = null;
  let touchStart: { x: number; y: number } | null = null;

  function palette(): PaletteId {
    const stored = store.getItem(PALETTE_KEY);
    return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
  }

  const board = new BoardRenderer({ canvas: boardCanvas, gridSize: GRID_SIZE, getPalette: palette });
  const enemyCtx = enemyCanvas.getContext("2d") as CanvasRenderingContext2D;

  const hooks = () => mergeRelicHooks(run?.relics ?? []);

  // ── drawing ───────────────────────────────────────────────────────────────

  function displayGrid(): GameGrid {
    const battle = run?.battle;
    if (!battle) return emptyGrid();
    if (hiddenCells.size === 0) return battle.grid;
    return battle.grid.map((row, r) => row.map((cell, c) => (hiddenCells.has(`${r},${c}`) ? null : cell)));
  }

  function drawEnemy(now: number): void {
    enemyCtx.clearRect(0, 0, enemyCanvas.width, enemyCanvas.height);
    const enemy = getEnemy(run?.battle?.enemyId ?? "");
    if (!enemy) return;
    const dead = run?.battle?.status === "victory";
    enemyCtx.globalAlpha = dead ? 0.25 : 1;
    drawEnemyArt(enemyCtx, enemy.shape, enemy.color, enemyCanvas.width, dead ? 0 : now);
    enemyCtx.globalAlpha = 1;
  }

  function drawFrame(now: number = performance.now()): void {
    board.setFrozenCells(run?.battle?.freezes ?? []);
    board.draw(displayGrid(), now);
    drawEnemy(now);
  }

  function resizeBoard(): void {
    const size = boardPixelSize(window.innerWidth, window.innerHeight);
    boardCanvas.width = size;
    boardCanvas.height = size;
    boardCanvas.style.width = `${size}px`;
    boardCanvas.style.height = `${size}px`;
    drawFrame();
  }

  // ── HUD (rebuilt only when the run changes) ────────────────────────────────

  function updateHud(): void {
    if (!run) return;
    const battle = run.battle;
    screenEl.dataset.phase = run.phase;
    screenEl.dataset.battleIndex = String(run.battleIndex);

    stageEl.textContent = `${stageLabel(run.battleIndex)}${run.phase === "relicPick" ? " · 準備出發" : ""}`;
    progressEl.innerHTML = "";
    progressPips(run).forEach((pip) => {
      const div = document.createElement("div");
      div.className = "adv-pip";
      div.dataset.state = pip.state;
      div.dataset.boss = String(pip.boss);
      progressEl.appendChild(div);
    });

    hpEl.textContent = `❤ ${run.heroHp}/${run.heroMaxHp}`;
    manaEl.textContent = `🔷 ${battle?.mana ?? 0}`;

    if (battle) {
      const enemy = getEnemy(battle.enemyId)!;
      enemyNameEl.textContent = `${enemy.boss ? "👑 " : ""}${enemy.name}`;
      hpFillEl.style.width = `${Math.max(0, (battle.enemyHp / battle.enemyMaxHp) * 100)}%`;
      hpTextEl.textContent = `${battle.enemyHp}/${battle.enemyMaxHp}`;
      shieldEl.textContent = battle.enemyShield > 0 ? `🛡 ${battle.enemyShield}` : "";
      if (battle.status === "ongoing") {
        const view = intentView(currentIntent(battle));
        intentEl.textContent = `${view.icon} ${view.text} · ${battle.countdown}`;
        intentEl.dataset.kind = currentIntent(battle).kind;
      } else {
        intentEl.textContent = battle.status === "victory" ? "已擊敗" : "—";
        intentEl.dataset.kind = "";
      }
    } else {
      enemyNameEl.textContent = "";
      hpTextEl.textContent = "";
      shieldEl.textContent = "";
      intentEl.textContent = "";
    }

    updateSpellBar(battle);
    relicsEl.innerHTML = "";
    run.relics.forEach((id) => {
      const relic = getRelic(id);
      if (!relic) return;
      const button = document.createElement("button");
      button.className = "adv-relic";
      button.dataset.relic = id;
      button.title = `${relic.name}：${relic.description}`;
      button.textContent = relic.icon;
      button.addEventListener("click", () => {
        relicInfoEl.textContent = `${relic.icon} ${relic.name}：${relic.description}`;
      });
      relicsEl.appendChild(button);
    });
    muteEl.textContent = audio.isMuted ? "🔇" : "🔊";
  }

  function updateSpellBar(battle: BattleState | null): void {
    const inBattle = run?.phase === "battle" && battle !== null;
    spellsEl.querySelectorAll<HTMLButtonElement>(".adv-spell").forEach((button) => {
      const spell = button.dataset.spell as SpellId;
      const cost = battle ? spellCost(battle, spell, hooks()) : SPELLS[spell].cost;
      const costEl = button.querySelector(".adv-spell-cost");
      if (costEl) costEl.textContent = String(cost);
      button.disabled = !inBattle || battle.mana < cost;
      button.dataset.active = String(activeSpell === spell);
    });
    const stuck = battle && inBattle ? stuckSpells(battle, hooks()) : [];
    stuckEl.hidden = stuck.length === 0;
    stuckEl.textContent = stuck.length > 0 ? STUCK_BANNER_TEXT : "";
    spellsEl.querySelectorAll<HTMLButtonElement>(".adv-spell").forEach((button) => {
      button.classList.toggle("suggested", stuck.includes(button.dataset.spell as SpellId));
    });
    boardCanvas.dataset.targeting = String(activeSpell !== null);
  }

  function setLog(lines: string[]): void {
    const hint = run?.battle ? stuckHint(run.battle, hooks()) : null;
    logEl.textContent = [...lines.slice(-3), ...(hint ? [hint] : [])].join("　");
  }

  // ── feedback: popups, sound, toasts ────────────────────────────────────────

  function pop(target: HTMLElement, text: string): void {
    target.textContent = text;
    target.classList.remove("animate");
    void target.offsetWidth;
    target.classList.add("animate");
  }

  function flashBoard(): void {
    flashEl.classList.remove("animate");
    void flashEl.offsetWidth;
    flashEl.classList.add("animate");
  }

  /** Banner plus a brief outline on the cells the enemy's action touched. */
  function showCue(events: BattleEvent[]): void {
    const cue = enemyActionCue(events);
    if (!cue) return;
    cueEl.textContent = cue.text;
    cueEl.classList.remove("animate");
    void cueEl.offsetWidth;
    cueEl.classList.add("animate");
    cueCellsEl.innerHTML = "";
    cueCellsEl.style.left = `${boardCanvas.offsetLeft}px`;
    cueCellsEl.style.top = `${boardCanvas.offsetTop}px`;
    cueCellsEl.style.width = `${boardCanvas.offsetWidth}px`;
    cueCellsEl.style.height = `${boardCanvas.offsetHeight}px`;
    const pct = 100 / GRID_SIZE;
    cue.cells.forEach(({ row, col }) => {
      const cell = document.createElement("div");
      cell.className = "adv-cue-cell";
      cell.style.left = `${col * pct}%`;
      cell.style.top = `${row * pct}%`;
      cell.style.width = `${pct}%`;
      cell.style.height = `${pct}%`;
      cueCellsEl.appendChild(cell);
    });
  }

  function playSounds(events: BattleEvent[]): void {
    const slid = events.find((e) => e.type === "slid");
    if (slid && slid.type === "slid") audio.play(slid.eliminatedPairs.length > 0 ? "eliminate" : "move");
    const chain = events.find((e) => e.type === "pairCleared" && e.chain);
    if (chain && chain.type === "pairCleared") audio.play("combo", { comboCount: chain.count });
    const cast = events.find((e) => e.type === "spellCast");
    if (cast && cast.type === "spellCast") audio.play(cast.spell);
    if (events.some((e) => e.type === "overload")) audio.play("bomb");
    if (events.some((e) => e.type === "tileSpawned")) audio.play("spawn");
    if (events.some((e) => e.type === "battleEnded" && e.result === "defeat")) {
      setTimeout(() => audio.play("gameOver"), 400);
    }
  }

  function feedback(events: BattleEvent[]): void {
    const dealt = damageTotal(events);
    if (dealt > 0) pop(enemyPopEl, `-${dealt}`);
    const hurt = heroDamageTotal(events);
    if (hurt > 0) {
      pop(heroPopEl, `-${hurt}`);
      flashBoard();
    }
    playSounds(events);
    showCue(events);
    setLog(logLines(events));
  }

  const toastQueue: string[] = [];
  let toastBusy = false;

  function drainToasts(): void {
    const text = toastQueue.shift();
    if (text === undefined) {
      toastBusy = false;
      return;
    }
    toastBusy = true;
    toastEl.textContent = text;
    toastEl.classList.remove("animate");
    void toastEl.offsetWidth;
    toastEl.classList.add("animate");
    setTimeout(drainToasts, 2500);
  }

  function processTrophies(events: AdventureTrophyEvent[]): void {
    events.forEach((event) => {
      checkAdventureTrophies(event, store).forEach((id) => {
        const trophy = getAdventureTrophy(id);
        const relic = trophy ? getRelic(trophy.relicId) : undefined;
        if (!trophy) return;
        toastQueue.push(`🏆 ${trophy.icon} ${trophy.name}！解鎖遺物「${relic?.name ?? ""}」（下一局起）`);
      });
    });
    if (!toastBusy && toastQueue.length > 0) drainToasts();
  }

  // ── the animation loop ─────────────────────────────────────────────────────

  function onEliminationDone(): void {
    hiddenCells = new Set();
    board.beginSpawn(pendingSpawn);
    pendingSpawn = [];
  }

  function tick(): void {
    frameId = null;
    const now = performance.now();
    const animating = board.advance(now, onEliminationDone);
    drawFrame(now);
    if (animating) frameId = requestAnimationFrame(tick);
    else syncPhase();
  }

  function startLoop(): void {
    if (frameId === null) frameId = requestAnimationFrame(tick);
  }

  function isBusy(): boolean {
    return board.isEliminating || frameId !== null;
  }

  function animateSlide(events: BattleEvent[], frozenBefore: number): void {
    const slid = events.find((e) => e.type === "slid");
    board.reset();
    hiddenCells = new Set();
    pendingSpawn = [];
    if (!slid || slid.type !== "slid" || !run?.battle) return;
    const spawned = events.flatMap((e) => (e.type === "tileSpawned" ? [e.cell] : []));
    if (slid.eliminatedPairs.length > 0 && canAnimateElimination(frozenBefore)) {
      spawned.forEach(({ row, col }) => hiddenCells.add(`${row},${col}`));
      pendingSpawn = spawned;
      board.beginElimination(slid.eliminatedPairs, slid.prevGrid, slid.direction);
    } else {
      const spawnedKeys = new Set(spawned.map(({ row, col }) => `${row},${col}`));
      const grid = run.battle.grid;
      const moved = changedCells(slid.prevGrid, grid).filter(
        ({ row, col }) => grid[row][col] !== null && !spawnedKeys.has(`${row},${col}`),
      );
      board.beginSlide(spawned, moved, slid.direction);
    }
  }

  // ── one step of the run ────────────────────────────────────────────────────

  function commit(step: RunStep, frozenBefore = 0): void {
    run = step.run;
    processTrophies(step.trophyEvents); // trophies first: a crash between the two must not lose them
    saveRun(store, run);
    feedback(step.events);
    animateSlide(step.events, frozenBefore);
    updateHud();
    drawFrame();
    startLoop();
  }

  function onDirection(direction: Direction): void {
    if (!active || !run || run.phase !== "battle" || isBusy()) return;
    const frozenBefore = run.battle?.freezes.length ?? 0;
    const step = runTurn(run, direction, rng);
    if (!step.applied) return;
    activeSpell = null;
    commit(step, frozenBefore);
  }

  function castSelected(spell: SpellId, target: CellPosition | null): void {
    if (!run) return;
    const step = runCast(run, spell, target, rng);
    activeSpell = null;
    if (!step.applied) {
      setLog([step.reason === "notEnoughMana" ? "魔力不足" : "這裡不能施放"]);
      updateSpellBar(run.battle);
      return;
    }
    commit(step, run.battle?.freezes.length ?? 0);
  }

  function onSpellClick(spell: SpellId): void {
    if (!active || !run || run.phase !== "battle" || isBusy() || !run.battle) return;
    if (run.battle.mana < spellCost(run.battle, spell, hooks())) return;
    if (spell === "shuffle") {
      castSelected(spell, null);
      return;
    }
    activeSpell = activeSpell === spell ? null : spell;
    setLog(activeSpell ? [`${SPELLS[spell].name}：${SPELL_HELP[spell]}`] : []);
    updateSpellBar(run.battle);
  }

  function onBoardClick(event: MouseEvent): void {
    if (!active || activeSpell === null || isBusy()) return;
    const rect = boardCanvas.getBoundingClientRect();
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * GRID_SIZE);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * GRID_SIZE);
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
    castSelected(activeSpell, { row, col });
  }

  // ── modals: reward pick and result ─────────────────────────────────────────

  function renderOffers(): void {
    if (!run) return;
    offersTitleEl.textContent = offerTitle(run);
    offersListEl.innerHTML = "";
    run.offers.forEach((option, index) => {
      const view = offerView(option);
      const button = document.createElement("button");
      button.className = "adv-offer";
      button.dataset.index = String(index);
      button.dataset.kind = option.kind;
      button.innerHTML = `<span class="adv-offer-icon">${view.icon}</span><span class="adv-offer-body"><strong>${view.title}</strong><small>${view.desc}</small></span>`;
      button.addEventListener("click", () => {
        if (!run) return;
        const step = chooseOffer(run, index, rng);
        if (!step.applied) return;
        offersEl.hidden = true;
        commit(step);
        syncPhase();
      });
      offersListEl.appendChild(button);
    });
  }

  function renderResult(): void {
    if (!run) return;
    const view = resultView(run);
    resultTitleEl.textContent = view.title;
    resultLinesEl.innerHTML = "";
    view.lines.forEach((line) => {
      const div = document.createElement("div");
      div.textContent = line;
      resultLinesEl.appendChild(div);
    });
  }

  /** Show the modal that matches the run's phase (called when no animation is running). */
  function syncPhase(): void {
    if (!active || !run) return;
    const picking = run.phase === "relicPick" || run.phase === "reward";
    const finished = run.phase === "victory" || run.phase === "defeat";
    if (picking && offersEl.hidden) renderOffers();
    offersEl.hidden = !picking;
    if (finished && resultEl.hidden) renderResult();
    resultEl.hidden = !finished;
  }

  function showScreen(): void {
    active = true;
    screenEl.hidden = false;
    offersEl.hidden = true;
    resultEl.hidden = true;
    activeSpell = null;
    board.reset();
    hiddenCells = new Set();
    pendingSpawn = [];
    relicInfoEl.textContent = "";
    resizeBoard();
    updateHud();
    setLog([]);
    drawFrame();
    syncPhase();
  }

  // ── trophies list ──────────────────────────────────────────────────────────

  function openTrophies(): void {
    const unlocked = loadAdventureTrophies(store);
    trophyListEl.innerHTML = "";
    ADVENTURE_TROPHIES.forEach((trophy) => {
      const got = trophy.id in unlocked;
      const relic = getRelic(trophy.relicId);
      const li = document.createElement("li");
      li.className = `tm-single${got ? "" : " locked"}`;
      li.dataset.trophy = trophy.id;
      li.dataset.unlocked = String(got);
      li.innerHTML = `<span class="tm-single-ico">${trophy.icon}</span><div class="tm-single-body"><strong>${trophy.name}</strong><small>${trophy.description}</small><small>解鎖遺物：${relic?.icon ?? ""} ${relic?.name ?? ""}</small></div>`;
      trophyListEl.appendChild(li);
    });
    trophyModalEl.hidden = false;
  }

  // ── events ─────────────────────────────────────────────────────────────────

  window.addEventListener("keydown", (event) => {
    const direction = KEY_TO_DIRECTION[event.key];
    if (!direction || !active) return;
    event.preventDefault();
    onDirection(direction);
  });

  boardCanvas.addEventListener(
    "touchstart",
    (event) => {
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    },
    { passive: true },
  );
  boardCanvas.addEventListener(
    "touchend",
    (event) => {
      if (!touchStart) return;
      const direction = swipeDirection(
        event.changedTouches[0].clientX - touchStart.x,
        event.changedTouches[0].clientY - touchStart.y,
      );
      touchStart = null;
      if (direction && activeSpell === null) onDirection(direction);
    },
    { passive: true },
  );
  boardCanvas.addEventListener("touchcancel", () => {
    touchStart = null;
  });
  boardCanvas.addEventListener("click", onBoardClick);
  spellsEl.querySelectorAll<HTMLButtonElement>(".adv-spell").forEach((button) => {
    button.addEventListener("click", () => onSpellClick(button.dataset.spell as SpellId));
  });
  el<HTMLButtonElement>("adv-home").addEventListener("click", () => deps.goHome());
  el<HTMLButtonElement>("adv-offers-home").addEventListener("click", () => deps.goHome());
  muteEl.addEventListener("click", () => {
    audio.toggleMute();
    muteEl.textContent = audio.isMuted ? "🔇" : "🔊";
  });
  el<HTMLButtonElement>("adv-result-home").addEventListener("click", () => deps.goHome());
  el<HTMLButtonElement>("adv-result-again").addEventListener("click", () => startNew());
  el<HTMLButtonElement>("adv-trophy-close").addEventListener("click", () => {
    trophyModalEl.hidden = true;
  });
  el<HTMLDivElement>("adv-trophy-overlay").addEventListener("click", () => {
    trophyModalEl.hidden = true;
  });
  window.addEventListener("resize", () => {
    if (active) resizeBoard();
  });

  // ── public API ─────────────────────────────────────────────────────────────

  function startNew(): void {
    run = createRun(rng, unlockedRelicIds(store));
    saveRun(store, run);
    showScreen();
  }

  function resume(saved: RunState): void {
    run = saved;
    showScreen();
  }

  function hide(): void {
    active = false;
    screenEl.hidden = true;
    offersEl.hidden = true;
    resultEl.hidden = true;
  }

  if (deps.devHooks) {
    (window as unknown as { __adv: unknown }).__adv = {
      getRun: () => run,
      isBusy,
      /** Replace the whole run (e2e builds states with the pure run layer). */
      setRun: (next: RunState) => {
        run = next;
        saveRun(store, run);
        showScreen();
      },
      /** Merge changes into the current battle (e.g. lower the enemy's HP so a test can win quickly). */
      patchBattle: (changes: Partial<BattleState>) => {
        if (!run?.battle) return;
        const battle = { ...run.battle, ...changes };
        run = { ...run, battle, heroHp: changes.heroHp !== undefined ? changes.heroHp : run.heroHp };
        saveRun(store, run);
        updateHud();
        drawFrame();
      },
      spells: SPELL_IDS,
    };
  }

  return { startNew, resume, hide, openTrophies };
}
