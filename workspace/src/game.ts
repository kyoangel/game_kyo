import {
  createInitialState,
  slide,
  spawnRandomTile,
  isGameOver,
  type Direction,
  type GameState,
  type GameGrid,
  type EliminatedPair,
  type Rng,
} from "./grid";
import {
  PALETTES,
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
} from "./powerups";
import { checkTrophies, loadTrophyStatuses, getTrophyDef } from "./trophies";

const GRID_SIZE = 4;
const BEST_SCORE_KEY = "mathMerge10BestScore";
const PALETTE_KEY = "mathMerge10Palette";
const POWERUP_KEY = "mathMerge10Powerups";
const PLAY_COUNT_KEY = "mathMerge10PlayCount";
const LIFETIME_ELIM_KEY = "mathMerge10LifetimeElim";
const ELIMINATE_DURATION_MS = 350;
const MOVE_DURATION_MS = 150;
const SPAWN_DELAY_MS = 350;
const SPAWN_DURATION_MS = 400;
const HUD_HEIGHT = 64;
const CANVAS_PADDING = 16;
const CANVAS_MAX = 500;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
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
const audio = new AudioEngine();

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
  if (state.grid[row][col] === null) return;
  const newGrid = state.grid.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? null : c)),
  );
  setState({ ...state, grid: newGrid });
  powerups.hammer--;
  savePowerups();
  audio.play("hammer");
  renderHudPowerups();
}

function applyShuffle(): void {
  const tiles: Array<{ row: number; col: number; value: number }> = [];
  state.grid.forEach((r, ri) =>
    r.forEach((c, ci) => {
      if (c !== null) tiles.push({ row: ri, col: ci, value: c });
    }),
  );
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i].value, tiles[j].value] = [tiles[j].value, tiles[i].value];
  }
  const newGrid = state.grid.map((r) => r.map(() => null as number | null));
  tiles.forEach(({ row, col, value }) => {
    newGrid[row][col] = value;
  });
  setState({ ...state, grid: newGrid });
  powerups.shuffle--;
  savePowerups();
  audio.play("shuffle");
  renderHudPowerups();
}

function applyAddOne(row: number, col: number): void {
  const value = state.grid[row][col];
  if (value === null) return;
  if (value === 9) {
    const newGrid = state.grid.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? null : c)),
    );
    setState({ ...state, grid: newGrid, score: state.score + 10 });
  } else {
    const newGrid = state.grid.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? value + 1 : c)),
    );
    setState({ ...state, grid: newGrid });
  }
  powerups.addOne--;
  savePowerups();
  audio.play("addOne");
  renderHudPowerups();
}

function applyBomb(row: number, col: number): void {
  const newGrid = state.grid.map((r, ri) =>
    r.map((c, ci) => {
      const isCenter = ri === row && ci === col;
      const isAdjacent =
        (ri === row - 1 && ci === col) ||
        (ri === row + 1 && ci === col) ||
        (ri === row && ci === col - 1) ||
        (ri === row && ci === col + 1);
      return isCenter || isAdjacent ? null : c;
    }),
  );
  setState({ ...state, grid: newGrid });
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

let state: GameState = createInitialState(GRID_SIZE);
let rng: Rng = Math.random;
let bestScore = loadBestScore();
let currentPalette: PaletteId = loadPalette();
let powerups: PowerupState = loadPowerups();

// eliminatingCells: phantom tiles no longer in state.grid
const eliminatingCells = new Map<string, { value: number; startTime: number }>();
// spawnCells: start time for the newly spawned tile (may be future)
const spawnCells = new Map<string, number>();
// moveCells: tiles that slid to a new position (or phantom eliminated tiles sliding to meetA/meetB)
const moveCells = new Map<
  string,
  {
    startTime: number;
    direction: Direction;
    value?: number;
    fromRow?: number;
    fromCol?: number;
    toRow?: number;
    toCol?: number;
  }
>();

let animationFrameId: number | null = null;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawBaseTile(
  value: number,
  x: number,
  y: number,
  cellSize: number,
  padding: number,
  flashAlpha: number,
): void {
  const colors = PALETTES[currentPalette][value];

  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
  ctx.fill();

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.beginPath();
    ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 8);
    ctx.fill();
  }

  ctx.fillStyle = colors.text;
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2);
}

function render(): void {
  const cellSize = canvas.width / GRID_SIZE;
  const padding = 4;
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      ctx.strokeStyle = "#444";
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }

  // Draw tiles from state.grid with per-type animations
  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === null) return;

      const key = `${rowIndex},${colIndex}`;
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;

      if (spawnCells.has(key)) {
        const startTime = spawnCells.get(key)!;
        const elapsed = now - startTime;
        if (elapsed < 0) return; // not started yet — tile stays invisible

        const t = Math.min(1, elapsed / SPAWN_DURATION_MS);
        let dy: number;
        let scale: number;
        let opacity: number;
        let glowAlpha: number;

        if (t <= 0.5) {
          const p = t / 0.5;
          dy = lerp(-64, 6, p);
          scale = lerp(0.4, 1.1, p);
          opacity = p;
          glowAlpha = p;
        } else if (t <= 0.75) {
          const p = (t - 0.5) / 0.25;
          dy = lerp(6, -3, p);
          scale = lerp(1.1, 0.97, p);
          opacity = 1;
          glowAlpha = lerp(1, 0, p);
        } else {
          const p = (t - 0.75) / 0.25;
          dy = lerp(-3, 0, p);
          scale = lerp(0.97, 1.0, p);
          opacity = 1;
          glowAlpha = 0;
        }

        const cx = x + cellSize / 2;
        const cy = y + dy + cellSize / 2;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
        if (glowAlpha > 0) {
          ctx.shadowColor = "#4ade80";
          ctx.shadowBlur = 20 * glowAlpha;
        }
        drawBaseTile(cell, x, y + dy, cellSize, padding, 0);
        ctx.restore();
      } else if (moveCells.has(key)) {
        const { startTime, direction } = moveCells.get(key)!;
        const t = Math.min(1, (now - startTime) / MOVE_DURATION_MS);
        const p = 1 - Math.pow(1 - t, 2); // ease-out
        const scale = lerp(0.65, 1.0, p);
        const offset = lerp(16, 0, p);

        let dx = 0;
        let dy = 0;
        if (direction === "left") dx = offset;
        else if (direction === "right") dx = -offset;
        else if (direction === "up") dy = offset;
        else dy = -offset;

        const cx = x + dx + cellSize / 2;
        const cy = y + dy + cellSize / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
        drawBaseTile(cell, x + dx, y + dy, cellSize, padding, 0);
        ctx.restore();
      } else {
        drawBaseTile(cell, x, y, cellSize, padding, 0);
      }
    });
  });

  // Draw phantom tiles for eliminated cells during their slide phase (phase 1)
  moveCells.forEach(({ value, startTime, fromRow, fromCol, toRow, toCol }) => {
    if (value === undefined || fromRow === undefined) return;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / MOVE_DURATION_MS);
    if (t >= 1) return;
    const p = 1 - Math.pow(1 - t, 2); // ease-out
    const x = lerp(fromCol! * cellSize, toCol! * cellSize, p);
    const y = lerp(fromRow * cellSize, toRow! * cellSize, p);
    const scale = lerp(0.8, 1.0, p);
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    drawBaseTile(value, x, y, cellSize, padding, 0);
    ctx.restore();
  });

  // Draw elimination flash phantoms (phase 2, at meeting position)
  eliminatingCells.forEach(({ value, startTime }, key) => {
    const [rowIndex, colIndex] = key.split(",").map(Number);
    const x = colIndex * cellSize;
    const y = rowIndex * cellSize;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / ELIMINATE_DURATION_MS);

    const T1 = 60 / ELIMINATE_DURATION_MS;
    const T2 = 200 / ELIMINATE_DURATION_MS;
    if (t >= T2) return;

    let scale: number;
    let opacity: number;
    let flashAlpha: number;

    if (t < T1) {
      const p = t / T1;
      scale = 1 + 0.15 * p;
      flashAlpha = 0.5 * p;
      opacity = 1;
    } else {
      const p = (t - T1) / (T2 - T1);
      scale = 1.15 * (1 - p);
      flashAlpha = 0.5 * (1 - p);
      opacity = 1 - p;
    }

    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 40 * flashAlpha;
    drawBaseTile(value, x, y, cellSize, padding, flashAlpha);
    ctx.restore();
  });

  const gameOver = isGameOver(state.grid);
  gameOverEl.hidden = !gameOver;
  if (gameOver) {
    gameOverScoreEl.textContent = `本次分數：${state.score}`;
    gameOverBestEl.textContent = `最高分：${bestScore}`;
    gameOverBadgeEl.classList.toggle("hidden", !isNewRecord(state.score, bestScore));
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
  loadTrophyStatuses().forEach(({ def, unlocked }) => {
    const li = document.createElement("li");
    if (!unlocked) li.classList.add("tm-locked");
    li.innerHTML = `<span class="tm-icon">${def.icon}</span><span class="tm-body"><strong>${def.name}</strong>${unlocked ? '<span class="tm-check">✓</span>' : ""}<small>${def.description}</small></span>`;
    trophyModalListEl.appendChild(li);
  });
}

function tick(): void {
  const now = performance.now();
  let stillAnimating = false;

  eliminatingCells.forEach((data, key) => {
    if (now - data.startTime >= ELIMINATE_DURATION_MS) {
      eliminatingCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

  spawnCells.forEach((startTime, key) => {
    if (startTime > now) {
      stillAnimating = true;
    } else if (now - startTime >= SPAWN_DURATION_MS) {
      spawnCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

  moveCells.forEach((data, key) => {
    if (now - data.startTime >= MOVE_DURATION_MS) {
      moveCells.delete(key);
    } else {
      stillAnimating = true;
    }
  });

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

function startAnimations(
  prevGrid: GameGrid,
  eliminatedPairs: EliminatedPair[],
  spawnedCells: Array<{ row: number; col: number }>,
  movedCellsList: Array<{ row: number; col: number }>,
  direction: Direction,
): void {
  const now = performance.now();

  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  // Regular moved tiles (non-eliminated): spring animation from their destination
  movedCellsList.forEach(({ row, col }) => {
    moveCells.set(`${row},${col}`, { startTime: now, direction });
  });

  // Eliminated tiles: phase 1 = slide phantom from original → meetA/meetB
  //                   phase 2 = flash at meeting position (delayed by MOVE_DURATION_MS)
  eliminatedPairs.forEach(({ a, b, meetA, meetB }) => {
    const valA = prevGrid[a.row][a.col];
    const valB = prevGrid[b.row][b.col];
    if (valA !== null) {
      moveCells.set(`${a.row},${a.col}`, {
        startTime: now,
        direction,
        value: valA,
        fromRow: a.row,
        fromCol: a.col,
        toRow: meetA.row,
        toCol: meetA.col,
      });
      eliminatingCells.set(`${meetA.row},${meetA.col}`, {
        value: valA,
        startTime: now + MOVE_DURATION_MS,
      });
    }
    if (valB !== null) {
      moveCells.set(`${b.row},${b.col}`, {
        startTime: now,
        direction,
        value: valB,
        fromRow: b.row,
        fromCol: b.col,
        toRow: meetB.row,
        toCol: meetB.col,
      });
      eliminatingCells.set(`${meetB.row},${meetB.col}`, {
        value: valB,
        startTime: now + MOVE_DURATION_MS,
      });
    }
  });

  spawnedCells.forEach(({ row, col }) => {
    spawnCells.set(`${row},${col}`, now + SPAWN_DELAY_MS);
  });
}

function handleKeydown(event: KeyboardEvent): void {
  const direction = KEY_TO_DIRECTION[event.key];
  if (!direction) return;

  if (isGameOver(state.grid)) return;

  const outcome = slide(state.grid, direction);
  if (!outcome.moved) return;

  const prevGrid = state.grid;
  const postSlideGrid = outcome.grid;
  const newGrid = spawnRandomTile(postSlideGrid, rng);
  const scoreGained = outcome.scoreGained;

  const spawnedCells = changedCells(postSlideGrid, newGrid);

  const eliminatedPositionKeys = new Set(
    outcome.eliminatedPairs.flatMap((p) => [
      `${p.a.row},${p.a.col}`,
      `${p.b.row},${p.b.col}`,
    ])
  );
  const spawnedKeys = new Set(spawnedCells.map((c) => `${c.row},${c.col}`));
  const allChanged = changedCells(prevGrid, newGrid);
  const movedCells = allChanged.filter((c) => {
    const key = `${c.row},${c.col}`;
    return (
      !eliminatedPositionKeys.has(key) &&
      !spawnedKeys.has(key) &&
      newGrid[c.row][c.col] !== null
    );
  });

  state = { grid: newGrid, score: state.score + scoreGained };

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

  updateHudScore();

  if (scoreGained > 0) {
    audio.play("eliminate");
    showScorePopup(scoreGained);
  } else {
    audio.play("move");
  }

  audio.play("spawn");

  if (isGameOver(newGrid)) {
    setTimeout(() => audio.play("gameOver"), 400);
    const gameOverTrophies = checkTrophies({ type: "gameOver", score: state.score });
    gameOverTrophies.forEach((id) => showTrophyToast(id));
  }

  const eliminatedPairs = outcome.eliminatedPairs;

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
  }

  (window as unknown as {
    __lastAnimationHints: {
      eliminatedPairs: EliminatedPair[];
      spawnedCell: { row: number; col: number } | null;
      movedCells: Array<{ row: number; col: number }>;
      comboCount: number;
    };
  }).__lastAnimationHints = {
    eliminatedPairs,
    spawnedCell: spawnedCells[0] ?? null,
    movedCells,
    comboCount: eliminatedPairs.length,
  };

  if (eliminatedPairs.length >= 2) {
    setTimeout(() => showComboBadge(eliminatedPairs.length), 300);
  }

  startAnimations(prevGrid, eliminatedPairs, spawnedCells, movedCells, direction);
  startAnimationLoop();
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
  eliminatingCells.clear();
  spawnCells.clear();
  moveCells.clear();

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }

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
