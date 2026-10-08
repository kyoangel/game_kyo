import {
  createInitialState,
  slide,
  spawnRandomTile,
  isGameOver,
  type Direction,
  type GameState,
  type EliminatedPair,
  type Rng,
} from "./grid";
import {
  PALETTE_ORDER,
  nextPalette,
  isPaletteId,
  type PaletteId,
} from "./palettes";
import { changedCells } from "./gridDiff";
import { formatScorePopup, isNewRecord } from "./scoring";
import { AudioEngine } from "./audio";
import {
  type PowerupId,
  type PowerupState,
  emptyPowerups,
  computePlayCountAward,
  computeEliminationAward,
  hammerEffect,
  shuffleEffect,
  addOneEffect,
  bombEffect,
} from "./powerups";
import { checkTrophies, loadModalData, getTrophyDef } from "./trophies";
import { BoardRenderer } from "./boardRenderer";
import { getScreen } from "./mode";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";
const POWERUP_KEY = "mathMerge10Powerups";
const PLAY_COUNT_KEY = "mathMerge10PlayCount";
const LIFETIME_ELIM_KEY = "mathMerge10LifetimeElim";
const HUD_HEIGHT = 64;
const CANVAS_PADDING = 16;
const CANVAS_MAX = 500;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const gameOverEl = document.getElementById("game-over") as HTMLDivElement;
const gameOverScoreEl = document.getElementById("game-over-score") as HTMLParagraphElement;
const gameOverBestEl = document.getElementById("game-over-best") as HTMLParagraphElement;
const gameOverBadgeEl = document.getElementById("game-over-badge") as HTMLParagraphElement;
const playAgainEl = document.getElementById("play-again") as HTMLButtonElement;
const paletteToggleEl = document.getElementById("hud-palette-toggle") as HTMLButtonElement;
const hudScoreEl = document.getElementById("hud-score") as HTMLSpanElement;
const hudBestEl = document.getElementById("hud-best") as HTMLSpanElement;
const scorePopupEl = document.getElementById("score-popup") as HTMLDivElement;
const comboBadgeEl = document.getElementById("combo-badge") as HTMLDivElement;

const hudMuteEl = document.getElementById("hud-mute") as HTMLButtonElement;
const hudPowerupInfoEl = document.getElementById("hud-powerup-info") as HTMLButtonElement;
const powerupModalEl = document.getElementById("powerup-modal") as HTMLDivElement;
const powerupModalOverlayEl = document.getElementById("powerup-modal-overlay") as HTMLDivElement;
const powerupModalCloseEl = document.getElementById("powerup-modal-close") as HTMLButtonElement;
const hudTrophyEl = document.getElementById("hud-trophy") as HTMLButtonElement;
const trophyModalEl = document.getElementById("trophy-modal") as HTMLDivElement;
const trophyModalOverlayEl = document.getElementById("trophy-modal-overlay") as HTMLDivElement;
const trophyModalCloseEl = document.getElementById("trophy-modal-close") as HTMLButtonElement;
const trophyModalListEl = document.getElementById("trophy-modal-list") as HTMLUListElement;
const trophyToastEl = document.getElementById("trophy-toast") as HTMLDivElement;
export const audio = new AudioEngine();

function updateMuteButton(): void {
  hudMuteEl.textContent = audio.isMuted ? "🔇" : "🔊";
}

hudMuteEl.addEventListener("click", () => {
  audio.toggleMute();
  updateMuteButton();
});

hudPowerupInfoEl.addEventListener("click", () => {
  powerupModalEl.removeAttribute("hidden");
});
powerupModalOverlayEl.addEventListener("click", () => {
  powerupModalEl.setAttribute("hidden", "");
});
powerupModalCloseEl.addEventListener("click", () => {
  powerupModalEl.setAttribute("hidden", "");
});

hudTrophyEl.addEventListener("click", () => {
  renderTrophyModal();
  trophyModalEl.removeAttribute("hidden");
});
trophyModalOverlayEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});
trophyModalCloseEl.addEventListener("click", () => {
  trophyModalEl.setAttribute("hidden", "");
});

function updateHudScore(): void {
  hudScoreEl.textContent = `Score: ${state.score}`;
  hudBestEl.textContent = `Best: ${bestScore}`;
}

function loadBestScore(): number {
  const value = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function loadPalette(): PaletteId {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isPaletteId(stored) ? stored : PALETTE_ORDER[0];
}

function loadPowerups(): PowerupState {
  try {
    const raw = localStorage.getItem(POWERUP_KEY);
    if (raw) return { ...emptyPowerups(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return emptyPowerups();
}

function savePowerups(): void {
  localStorage.setItem(POWERUP_KEY, JSON.stringify(powerups));
}

const POWERUP_UNLOCK_TIPS: Record<PowerupId, string> = {
  hammer:  "每 2 局隨機獲得",
  shuffle: "每 2 局隨機獲得",
  addOne:  "每 3 局獲得",
  bomb:    "每累計消除 30 對獲得一顆",
};

function renderHudPowerups(): void {
  const container = document.getElementById("hud-powerups")!;
  container.innerHTML = "";
  const defs: Array<{ id: PowerupId; icon: string }> = [
    { id: "hammer",  icon: "🔨" },
    { id: "shuffle", icon: "🔀" },
    { id: "addOne",  icon: "➕" },
    { id: "bomb",    icon: "💣" },
  ];

  defs.forEach(({ id, icon }) => {
    const count = powerups[id];
    const locked = count === 0;
    const btn = document.createElement("button");
    btn.className = "hud-powerup-btn";
    btn.dataset.powerup = id;
    btn.dataset.locked = String(locked);
    btn.dataset.active = String(activePowerup === id);

    const badge = locked
      ? `<span class="hud-powerup-count">🔒</span>`
      : `<span class="hud-powerup-count">${count}</span>`;
    const tooltip = locked
      ? `<span class="powerup-tooltip">${POWERUP_UNLOCK_TIPS[id]}</span>`
      : "";

    btn.innerHTML = `${icon}${badge}${tooltip}`;

    btn.addEventListener("click", (e) => {
      if (locked) {
        e.stopPropagation();
        const isOpen = btn.dataset.tooltipOpen === "true";
        container.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
          (el) => { delete el.dataset.tooltipOpen; },
        );
        if (!isOpen) btn.dataset.tooltipOpen = "true";
        return;
      }
      activePowerup = activePowerup === id ? null : id;
      canvas.style.outline = activePowerup ? "3px solid #f59e0b" : "";
      renderHudPowerups();
    });

    container.appendChild(btn);
  });
}

function applyHammer(row: number, col: number): void {
  const result = hammerEffect(state.grid, row, col);
  if (!result.applied) return;
  setState({ ...state, grid: result.grid });
  powerups.hammer--;
  savePowerups();
  audio.play("hammer");
  renderHudPowerups();
}

function applyShuffle(): void {
  const result = shuffleEffect(state.grid, rng);
  setState({ ...state, grid: result.grid });
  powerups.shuffle--;
  savePowerups();
  audio.play("shuffle");
  renderHudPowerups();
}

function applyAddOne(row: number, col: number): void {
  const result = addOneEffect(state.grid, row, col);
  if (!result.applied) return;
  setState({
    ...state,
    grid: result.grid,
    score: result.pairCleared ? state.score + 10 : state.score,
  });
  powerups.addOne--;
  savePowerups();
  audio.play("addOne");
  renderHudPowerups();
}

function applyBomb(row: number, col: number): void {
  const result = bombEffect(state.grid, row, col);
  setState({ ...state, grid: result.grid });
  powerups.bomb--;
  savePowerups();
  audio.play("bomb");
  renderHudPowerups();
}

function loadPlayCount(): number {
  return parseInt(localStorage.getItem(PLAY_COUNT_KEY) ?? "0", 10);
}

function loadLifetimeElim(): number {
  return parseInt(localStorage.getItem(LIFETIME_ELIM_KEY) ?? "0", 10);
}

// Present only inside the Capacitor-wrapped iOS app (see index.html), never on web.
interface GameCenterPlugin {
  reportScore(opts: { score: number }): Promise<unknown>;
}
function reportBestScoreToGameCenter(score: number): void {
  const gc = (window as unknown as { Capacitor?: { Plugins?: { GameCenter?: GameCenterPlugin } } })
    .Capacitor?.Plugins?.GameCenter;
  gc?.reportScore({ score }).catch(() => {});
}

function updateBestScore(score: number): void {
  if (score <= bestScore) return;
  bestScore = score;
  localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  reportBestScoreToGameCenter(bestScore);
}

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();
let powerups: PowerupState = loadPowerups();

let spawnPending = false;
const board = new BoardRenderer({
  canvas,
  gridSize: GRID_SIZE,
  getPalette: () => currentPalette,
});

let animationFrameId: number | null = null;

function finalizeDeferredSlide(): void {
  if (!spawnPending) return;
  spawnPending = false;

  const postSlideGrid = state.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);
  state = { ...state, grid: newGrid };

  if (isGameOver(newGrid)) {
    setTimeout(() => audio.play("gameOver"), 400);
    const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
    gameOverTrophies.forEach((id) => showTrophyToast(id));
  }

  const spawnedList = changedCells(postSlideGrid, newGrid).filter(
    ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
  );
  board.beginSpawn(spawnedList);
}

function render(): void {
  board.draw(state.grid);

  if (!board.isEliminating) {
    const gameOver = isGameOver(state.grid);
    gameOverEl.hidden = !gameOver;
    if (gameOver) {
      gameOverScoreEl.textContent = `本次分數：${state.score}`;
      gameOverBestEl.textContent = `最高分：${bestScore}`;
      gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
    }
  }
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

function showScorePopup(amount: number): void {
  scorePopupEl.textContent = formatScorePopup(amount);
  scorePopupEl.classList.remove("animate");
  void scorePopupEl.offsetWidth;
  scorePopupEl.classList.add("animate");
}

function showComboBadge(count: number): void {
  audio.play("combo", { comboCount: count });
  comboBadgeEl.textContent = `COMBO ×${count}`;
  comboBadgeEl.classList.remove("animate");
  void comboBadgeEl.offsetWidth;
  comboBadgeEl.classList.add("animate");
  canvas.style.boxShadow = "0 0 30px 8px #f59e0b";
  setTimeout(() => {
    canvas.style.boxShadow = "";
  }, 300);
}

const trophyToastQueue: string[] = [];
let trophyToastTimer: ReturnType<typeof setTimeout> | null = null;

function drainTrophyToastQueue(): void {
  const id = trophyToastQueue.shift();
  if (id === undefined) { trophyToastTimer = null; return; }
  const def = getTrophyDef(id);
  if (!def) { drainTrophyToastQueue(); return; }
  trophyToastEl.textContent = `${def.icon} ${def.name}！`;
  trophyToastEl.classList.remove("animate");
  void trophyToastEl.offsetWidth;
  trophyToastEl.classList.add("animate");
  trophyToastTimer = setTimeout(() => {
    trophyToastEl.classList.remove("animate");
    drainTrophyToastQueue();
  }, 2200);
}

function showTrophyToast(id: string): void {
  trophyToastQueue.push(id);
  if (trophyToastTimer === null) drainTrophyToastQueue();
}

function renderTrophyModal(): void {
  trophyModalListEl.innerHTML = "";
  const sections = loadModalData();

  for (const section of sections) {
    const header = document.createElement("li");
    header.className = "tm-category-header";
    header.textContent = section.categoryLabel;
    trophyModalListEl.appendChild(header);

    for (const group of section.groups) {
      const li = document.createElement("li");

      if (group.type === "single") {
        const { def, unlocked } = group.single!;
        li.className = `tm-single${unlocked ? "" : " locked"}`;
        li.innerHTML = `<span class="tm-single-ico">${def.icon}</span><div class="tm-single-body"><strong>${def.name}</strong><small>${def.description}</small></div>`;
      } else if (group.beyondDiamond) {
        li.className = "tm-prog-row";
        li.innerHTML = `
          <div class="tm-prog-top">
            <span class="tm-prog-label">${group.label}</span>
            <span class="tm-beyond-count">${group.beyondDisplay ?? ""}</span>
          </div>
          <div class="tm-medals">
            ${group.tiers!.map((t) => `<div class="tm-tier"><span class="tm-ico">${t.def.icon}</span></div>`).join("")}
            <span class="tm-beyond-tag">全數解鎖 ✦</span>
          </div>
          <div class="tm-bar"><div class="tm-fill tm-fill-cyan" style="width:100%"></div></div>
          <div class="tm-beyond-sub">${group.beyondSubDisplay ?? ""}</div>
        `;
      } else {
        const pct = Math.min(100, ((group.progressValue ?? 0) / (group.progressCeiling ?? 1)) * 100);
        li.className = "tm-prog-row";
        li.innerHTML = `
          <div class="tm-prog-top">
            <span class="tm-prog-label">${group.label}</span>
            <span class="tm-prog-val">${group.progressDisplay ?? ""}</span>
          </div>
          <div class="tm-medals">
            ${group.tiers!.map((t, i) => `
              <div class="tm-tier${t.unlocked ? "" : " locked"}">
                <span class="tm-ico">${t.def.icon}</span>
                <span class="tm-thr">${group.thresholdDisplays?.[i] ?? ""}</span>
              </div>`).join("")}
          </div>
          <div class="tm-bar"><div class="tm-fill tm-fill-purple" style="width:${pct.toFixed(1)}%"></div></div>
        `;
      }

      trophyModalListEl.appendChild(li);
    }
  }
}

function tick(): void {
  const stillAnimating = board.advance(performance.now(), finalizeDeferredSlide);

  render();

  if (stillAnimating) {
    animationFrameId = requestAnimationFrame(tick);
  } else {
    animationFrameId = null;
  }
}

function startAnimationLoop(): void {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(tick);
  }
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;
  if (getScreen() !== "endless") return; // the menu or the adventure screen is showing

  if (isGameOver(state.grid)) return;
  if (board.isEliminating) return;

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const prevGrid = state.grid;
  const postSlideGrid = outcome.grid;
  const scoreGained = outcome.scoreGained;
  const eliminatedPairs = outcome.eliminatedPairs;
  const comboMultiplier = Math.max(1, eliminatedPairs.length);
  const actualScore = scoreGained * comboMultiplier;

  state = { grid: postSlideGrid, score: state.score + actualScore };

  updateBestScore(state.score);

  updateHudScore();

  if (scoreGained > 0) {
    audio.play("eliminate");
    showScorePopup(actualScore);
  } else {
    audio.play("move");
  }

  audio.play("spawn");

  if (eliminatedPairs.length >= 2) {
    setTimeout(() => showComboBadge(eliminatedPairs.length), 300);
  }

  if (eliminatedPairs.length > 0) {
    const oldElim = loadLifetimeElim();
    const newElim = oldElim + eliminatedPairs.length;
    localStorage.setItem(LIFETIME_ELIM_KEY, String(newElim));
    const bombs = computeEliminationAward(oldElim, newElim);
    if (bombs > 0) {
      powerups.bomb += bombs;
      savePowerups();
      renderHudPowerups();
    }

    board.beginElimination(eliminatedPairs, prevGrid, direction);
    spawnPending = true;

    (window as unknown as {
      __lastAnimationHints: {
        eliminatedPairs: EliminatedPair[];
        spawnedCell: { row: number; col: number } | null;
        movedCells: Array<{ row: number; col: number }>;
        comboCount: number;
      };
    }).__lastAnimationHints = {
      eliminatedPairs,
      spawnedCell: null,
      movedCells: [],
      comboCount: eliminatedPairs.length,
    };

    startAnimationLoop();
  } else {
    const newGrid = spawnRandomTile(postSlideGrid, rng);
    state = { ...state, grid: newGrid };

    const spawnedList = changedCells(postSlideGrid, newGrid).filter(
      ({ row, col }) => newGrid[row][col] !== null && postSlideGrid[row][col] === null,
    );
    const spawnedKeys = new Set(spawnedList.map(({ row, col }) => `${row},${col}`));
    const allChanged = changedCells(prevGrid, newGrid);
    const movedList = allChanged.filter(({ row, col }) => {
      const key = `${row},${col}`;
      return !spawnedKeys.has(key) && newGrid[row][col] !== null;
    });

    board.beginSlide(spawnedList, movedList, direction);

    if (isGameOver(newGrid)) {
      setTimeout(() => audio.play("gameOver"), 400);
      const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
      gameOverTrophies.forEach((id) => showTrophyToast(id));
    }

    (window as unknown as {
      __lastAnimationHints: {
        eliminatedPairs: EliminatedPair[];
        spawnedCell: { row: number; col: number } | null;
        movedCells: Array<{ row: number; col: number }>;
        comboCount: number;
      };
    }).__lastAnimationHints = {
      eliminatedPairs: [],
      spawnedCell: spawnedList[0] ?? null,
      movedCells: movedList,
      comboCount: 0,
    };

    startAnimationLoop();
  }

  const newlyUnlockedTrophies = checkTrophies({
    type: "slide",
    grid: state.grid,
    comboCount: eliminatedPairs.length,
  });
  newlyUnlockedTrophies.forEach((id) => showTrophyToast(id));
}

window.addEventListener("keydown", handleKeydown);

paletteToggleEl.addEventListener("click", () => {
  currentPalette = nextPalette(currentPalette);
  localStorage.setItem(PALETTE_KEY, currentPalette);
  render();
});

document.addEventListener("click", () => {
  document.querySelectorAll<HTMLElement>("[data-tooltip-open]").forEach(
    (el) => { delete el.dataset.tooltipOpen; },
  );
});

// ── Touch swipe ──────────────────────────────────────────────────────────────
let activePowerup: PowerupId | null = null;
let touchStart: { x: number; y: number } | null = null;
const SWIPE_MIN_PX = 30;

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (activePowerup !== null) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;

    if (activePowerup !== null) {
      const rect = canvas.getBoundingClientRect();
      const cs = canvas.width / GRID_SIZE;
      const col = Math.floor((e.changedTouches[0].clientX - rect.left) / cs);
      const row = Math.floor((e.changedTouches[0].clientY - rect.top) / cs);
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        const id = activePowerup;
        activePowerup = null;
        canvas.style.outline = "";
        switch (id) {
          case "hammer":  applyHammer(row, col); break;
          case "addOne":  applyAddOne(row, col); break;
          case "bomb":    applyBomb(row, col); break;
          case "shuffle": applyShuffle(); break;
        }
      }
      return;
    }

    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;
    const direction: Direction =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
    handleKeydown(new KeyboardEvent("keydown", { key: direction === "up" ? "ArrowUp" : direction === "down" ? "ArrowDown" : direction === "left" ? "ArrowLeft" : "ArrowRight" }));
  },
  { passive: true },
);

canvas.addEventListener("click", (e) => {
  if (activePowerup === null) return;
  const rect = canvas.getBoundingClientRect();
  const cs = canvas.width / GRID_SIZE;
  const col = Math.floor((e.clientX - rect.left) / cs);
  const row = Math.floor((e.clientY - rect.top) / cs);
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;

  const id = activePowerup;
  activePowerup = null;
  canvas.style.outline = "";

  switch (id) {
    case "hammer":  applyHammer(row, col); break;
    case "addOne":  applyAddOne(row, col); break;
    case "bomb":    applyBomb(row, col); break;
    case "shuffle": applyShuffle(); break;
  }
});

// ── Responsive resize ─────────────────────────────────────────────────────────
function resizeCanvas(): void {
  const available = Math.min(
    window.innerWidth - CANVAS_PADDING,
    window.innerHeight - HUD_HEIGHT - CANVAS_PADDING,
  );
  const size = Math.min(available, CANVAS_MAX);
  canvas.width = size;
  canvas.height = size;
  render();
}

window.addEventListener("resize", resizeCanvas);

function setState(newState: GameState): void {
  state = newState;
  board.reset();
  spawnPending = false;
  trophyToastQueue.length = 0;
  if (trophyToastTimer !== null) {
    clearTimeout(trophyToastTimer);
    trophyToastTimer = null;
    trophyToastEl.classList.remove("animate");
  }

  updateBestScore(state.score);

  if (newState.score === 0) {
    const newCount = loadPlayCount() + 1;
    localStorage.setItem(PLAY_COUNT_KEY, String(newCount));
    const award = computePlayCountAward(newCount);
    if (award) {
      powerups[award]++;
      savePowerups();
    }
  }

  updateHudScore();
  render();
}

playAgainEl.addEventListener("click", () => {
  setState(createInitialState(GRID_SIZE, rng));
});

(window as unknown as { __getGameState: () => GameState }).__getGameState = () => state;

(window as unknown as {
  __setTestState: (s: GameState, testRng?: Rng) => void;
}).__setTestState = (s, testRng) => {
  if (testRng) rng = testRng;
  setState(s);
};

(window as unknown as { __getCurrentPalette: () => PaletteId }).__getCurrentPalette = () =>
  currentPalette;

(window as unknown as { __setPowerups: (p: PowerupState) => void }).__setPowerups = (p) => {
  powerups = p;
  renderHudPowerups();
};

(window as unknown as { __setLifetimeElim: (n: number) => void }).__setLifetimeElim = (n) => {
  localStorage.setItem(LIFETIME_ELIM_KEY, String(n));
};

updateMuteButton();
updateHudScore();
renderHudPowerups();
resizeCanvas();
