/**
 * The start menu (spec 2): 冒險 (default) / 繼續冒險 (only when a valid save
 * exists) / 修練 (the unchanged endless mode) / 冒險獎盃. Also owns switching
 * between the three screens through `setScreen`.
 */
import { setScreen } from "../mode";
import { continueSummary } from "./viewModel";
import { loadRun } from "./save";
import type { KeyValueStore } from "./storage";
import type { AdventureView } from "./view";

export interface MenuDeps {
  store: KeyValueStore;
  adventure: AdventureView;
  /**
   * Dev builds only: skip the menu and open this mode at startup. The 54
   * existing endless e2e specs rely on it (playwright.config.ts seeds it).
   */
  devStart: "endless" | null;
}

export interface Menu {
  /** Go to the start menu (also the 🏠 buttons). */
  showMenu(): void;
  /** First screen after page load. */
  start(): void;
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function initMenu(deps: MenuDeps): Menu {
  const { store, adventure } = deps;
  const menuEl = el<HTMLDivElement>("mode-menu");
  const continueEl = el<HTMLButtonElement>("mode-continue");
  const continueInfoEl = el<HTMLElement>("mode-continue-info");
  const endlessHomeEl = el<HTMLButtonElement>("endless-home");

  function showMenu(): void {
    adventure.hide();
    setScreen("menu");
    endlessHomeEl.hidden = true;
    const saved = loadRun(store); // an invalid save is deleted here and reads as "no save"
    continueEl.hidden = saved === null;
    if (saved) continueInfoEl.textContent = continueSummary(saved);
    menuEl.hidden = false;
  }

  function enterEndless(): void {
    menuEl.hidden = true;
    adventure.hide();
    setScreen("endless");
    endlessHomeEl.hidden = false;
  }

  function enterAdventure(): void {
    menuEl.hidden = true;
    endlessHomeEl.hidden = true;
    setScreen("adventure");
  }

  el<HTMLButtonElement>("mode-adventure").addEventListener("click", () => {
    enterAdventure();
    adventure.startNew();
  });
  continueEl.addEventListener("click", () => {
    const saved = loadRun(store);
    if (!saved) {
      showMenu();
      return;
    }
    enterAdventure();
    adventure.resume(saved);
  });
  el<HTMLButtonElement>("mode-endless").addEventListener("click", enterEndless);
  el<HTMLButtonElement>("mode-trophies").addEventListener("click", () => adventure.openTrophies());
  endlessHomeEl.addEventListener("click", showMenu);

  return {
    showMenu,
    start: () => (deps.devStart === "endless" ? enterEndless() : showMenu()),
  };
}
